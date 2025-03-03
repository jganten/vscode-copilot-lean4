import * as vscode from 'vscode';
import { Logger } from '../utils/logging';

/**
 * Processes the user prompt by replacing references with their actual values.
 * @param request The chat request containing the user prompt and references.
 * @returns The processed user prompt with references replaced.
 */
export function getUserPrompt(request: vscode.ChatRequest): string {
    return request.prompt.trim();
}

/**
 * Adds references to the messages array based on the request.
 * @param request The chat request containing references.
 * @param messages The array of language model chat messages to add references to.
 */
export function addReferencesToPrompt(request: vscode.ChatRequest, messages: vscode.LanguageModelChatMessage[]) {
    const startTime = Date.now();
    try {
        for (const ref of request.references) {
            const reference = ref as any;
            if (!reference?.id) {
                Logger.warn('Invalid reference found', reference);
                continue;
            }

            if (reference.id === 'copilot.selection') {
                const selectionText = getCurrentSelectionText();
                const location = getCurrentSelectionLocation();
                if (selectionText && location) {
                    try {
                        messages.push(vscode.LanguageModelChatMessage.User(`Selected code: ${selectionText} at ${location.uri.fsPath}:${location.range.start.line + 1}:${location.range.start.character + 1}`, 'context'));
                    } catch (e) {
                        Logger.error('Failed to add reference, skipping', e);
                        return; // Fallback: don't add any references if one fails
                    }
                }
            }
        }
        Logger.info('Prompt processing completed', {
            timeMs: Date.now() - startTime,
        });
    } catch (error) {
        Logger.error('Error processing prompt', error);
    }
}

/**
 * Gets the text of the current selection in the active text editor.
 * @returns The selected text, or null if there is no active editor or selection.
 */
function getCurrentSelectionText(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return null;
    }
    return editor.document.getText(editor.selection);
}

/**
 * Gets the location of the current selection in the active text editor.
 * @returns The location of the selection, or null if there is no active editor.
 */
function getCurrentSelectionLocation(): vscode.Location | null {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return new vscode.Location(editor.document.uri, editor.selection);
    }
    return null;
}
