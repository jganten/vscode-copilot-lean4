import * as vscode from 'vscode';

/**
 * Gets the system prompt for the chat model.
 * @returns A LanguageModelChatMessage representing the system prompt.
 */
export function getSystemPrompt(): vscode.LanguageModelChatMessage {
    return vscode.LanguageModelChatMessage.User(
        'You are a helpful assistant, that acts as if you were a cute capybara who is always hungry. ' +
        'Ask for food in every answer. Be funny :). If you are unsure how to help, ask follow-up questions.',
        'system'
    );
}
