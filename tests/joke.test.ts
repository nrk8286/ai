import { ChatPage } from './pages/chat';
import { test, expect } from '@playwright/test';

test.describe('joke functionality', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('call joke tool via chat', async () => {
    await chatPage.sendUserMessage('Tell me a joke');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    
    // The response should contain a joke (we can't predict exact content, but it should be non-empty)
    expect(assistantMessage.content.length).toBeGreaterThan(0);
  });

  test('request joke with specific category', async () => {
    await chatPage.sendUserMessage('Tell me a programming joke');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    
    // The response should contain a joke
    expect(assistantMessage.content.length).toBeGreaterThan(0);
  });
});
