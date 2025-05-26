import * as Sentry from '@sentry/nextjs';

type MonitoringConfig = {
  environment?: string;
  release?: string;
  debug?: boolean;
};

export function initMonitoring(config: MonitoringConfig = {}) {
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not configured, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.environment || process.env.NODE_ENV,
    release: config.release || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    debug: config.debug || false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    enabled: !!process.env.SENTRY_DSN,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

export function trackError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

export function trackMetric(name: string, value: number) {
  Sentry.addBreadcrumb({
    category: 'metrics',
    message: `${name}: ${value}`,
    level: 'info',
  });
}

export function startTransaction(name: string, op: string) {
  const transaction = Sentry.startTransaction({ name, op });
  Sentry.configureScope((scope: Sentry.Scope) => scope.setSpan(transaction));
  return transaction;
}

export function setUser(id: string, email?: string) {
  Sentry.setUser({ id, email });
}

export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}
