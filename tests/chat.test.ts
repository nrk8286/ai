import { ChatPage } from './pages/chat';
import { test, expect } from '@playwright/test';

test.describe('chat activity', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('send a user message and receive response', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is grass green?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");
  });

  test('reload restores PostgreSQL JSON messages', async ({ page }) => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is grass green?'),
    ]);
    await chatPage.hasChatIdInUrl();
    await page.reload();
    await expect(page.getByTestId('message-user')).toContainText(
      'Why is grass green?',
    );
    await expect(page.getByTestId('message-assistant')).toContainText(
      "It's just green duh!",
    );
  });

  test('redirect to /chat/:id after submitting message', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is grass green?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");
    await chatPage.hasChatIdInUrl();
  });

  test('send a user message from suggestion', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessageFromSuggestion(),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain(
      'With Next.js, you can ship fast!',
    );
  });

  test('toggle between send/stop button based on activity', async () => {
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();

    const completed = chatPage.isGenerationComplete();
    await chatPage.sendUserMessage('Why is grass green?');

    await expect(chatPage.sendButton).not.toBeVisible();
    await expect(chatPage.stopButton).toBeVisible();

    await completed;

    await expect(chatPage.stopButton).not.toBeVisible();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test('stop generation during submission', async () => {
    await chatPage.sendUserMessage('Why is grass green?');
    await expect(chatPage.stopButton).toBeVisible();
    await chatPage.stopButton.click();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test('edit user message and resubmit', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is grass green?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toContain("It's just green duh!");

    const userMessage = await chatPage.getRecentUserMessage();
    await Promise.all([
      chatPage.isGenerationComplete(),
      userMessage.edit('Why is the sky blue?'),
    ]);

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    expect(updatedAssistantMessage.content).toContain("It's just blue duh!");
  });

  test('hide suggested actions after sending message', async () => {
    await chatPage.isElementVisible('suggested-actions');
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isElementNotVisible('suggested-actions');
  });

  test('upload file and send image attachment with message', async ({
    page,
  }) => {
    await chatPage.addImageAttachment();

    await chatPage.isElementVisible('attachments-preview');
    await chatPage.isElementVisible('input-attachment-loader');
    await chatPage.isElementNotVisible('input-attachment-loader');

    const completed = chatPage.isGenerationComplete();
    await chatPage.sendUserMessage('Who painted this?');

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.attachments).toHaveLength(1);

    await completed;

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBe('This painting is by Monet!');
    await page.reload();
    await expect(
      page.getByTestId('message-user').getByTestId('message-attachments'),
    ).toBeVisible();
    await expect(page.getByTestId('message-assistant')).toContainText(
      'This painting is by Monet!',
    );
  });

  test('call weather tool', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage("What's the weather in sf?"),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    expect(assistantMessage.content).toBe(
      'The current temperature in San Francisco is 17\u00b0C.',
    );
  });

  test('upvote message', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is the sky blue?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await Promise.all([chatPage.isVoteComplete(), assistantMessage.upvote()]);
  });

  test('downvote message', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is the sky blue?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await Promise.all([chatPage.isVoteComplete(), assistantMessage.downvote()]);
  });

  test('update vote', async () => {
    await Promise.all([
      chatPage.isGenerationComplete(),
      chatPage.sendUserMessage('Why is the sky blue?'),
    ]);

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await Promise.all([chatPage.isVoteComplete(), assistantMessage.upvote()]);

    await Promise.all([chatPage.isVoteComplete(), assistantMessage.downvote()]);
  });
});
