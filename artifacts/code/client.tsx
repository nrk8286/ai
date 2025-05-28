import { Artifact } from '@/components/create-artifact';
import { CodeEditor } from '@/components/code-editor';
import { PlayIcon } from '@/components/icons';
import { generateUUID } from '@/lib/utils';
import { Console } from '@/components/console';
import type { ConsoleOutput, ConsoleOutputContent } from '@/components/console';

// Pre-defined output handlers for different Python use cases
const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            try:
                if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                    print("Warning: Plot size too large, reducing quality")
                    plt.gcf().set_dpi(100)

                png_buf = io.BytesIO()
                plt.savefig(png_buf, format='png', bbox_inches='tight')
                png_buf.seek(0)
                png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
                print(f'data:image/png;base64,{png_base64}')
            except Exception as e:
                print(f"Error generating plot: {str(e)}")
            finally:
                if 'png_buf' in locals():
                    png_buf.close()
                plt.clf()
                plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup with error handling
    import sys
    from io import StringIO
    
    class SafeStringIO(StringIO):
        def write(self, s):
            try:
                super().write(s)
            except Exception as e:
                super().write(f"Error writing output: {str(e)}")
    
    sys.stdout = SafeStringIO()
    sys.stderr = SafeStringIO()
  `,
};

// Detect which output handlers are needed for the code
function detectRequiredHandlers(code: string): string[] {
  try {
    const handlers: string[] = ['basic'];

    if (code.includes('matplotlib') || code.includes('plt.')) {
      handlers.push('matplotlib');
    }

    return handlers;
  } catch (error) {
    console.error('Error detecting handlers:', error);
    return ['basic'];
  }
}

interface Metadata {
  outputs: Array<ConsoleOutput>;
}

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description:
    'Useful for code generation; Code execution is only available for python code.',
  toolbar: true,
  initialize: async ({ setMetadata }) => {
    setMetadata({
      outputs: [],
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'code-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible:
          draftArtifact.status === 'streaming' &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    return (
      <>
        <div className="px-1">
          <CodeEditor {...props} />
        </div>

        {metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: 'Run',
      description: 'Execute code',
      onClick: async ({ content, setMetadata }) => {
        const runId = generateUUID();
        const outputContent: Array<ConsoleOutputContent> = [];

        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs,
            {
              id: runId,
              contents: [],
              status: 'in_progress',
            },
          ],
        }));

        try {
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith('data:image/png;base64')
                  ? 'image'
                  : 'text',
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              setMetadata((metadata) => ({
                ...metadata,
                outputs: [
                  ...metadata.outputs.filter((output) => output.id !== runId),
                  {
                    id: runId,
                    contents: [{ type: 'text', value: message }],
                    status: 'loading_packages',
                  },
                ],
              }));
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
              );

              if (handler === 'matplotlib') {
                await currentPyodideInstance.runPythonAsync(`
                  import atexit
                  atexit._run_exitfuncs()
                `);
              }
            }
          }

          const result = await currentPyodideInstance.runPythonAsync(content);

          outputContent.push({
            type: 'text',
            value: `Execution completed. Result: ${result}`,
          });
        } catch (error) {
          outputContent.push({
            type: 'text',
            value: `Error: ${(error as Error).message}`,
          });
        } finally {
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: outputContent,
                status: 'completed',
              },
            ],
          }));
        }
      },
    },
  ],
});
