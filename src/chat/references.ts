import * as vscode from 'vscode';
import { Logger } from '../utils/logging';

export function getUserPrompt(request: vscode.ChatRequest): string {
    const startTime = Date.now();
    let userPrompt = request.prompt.trim();

    try {
        for (const ref of request.references) {
            const reference = ref as any;
            if (!reference?.id) {
                Logger.warn('Invalid reference found', reference);
                continue;
            }

            if (reference.id === 'copilot.selection') {
                Logger.debug(`Processing selection reference`, { name: reference.name });
                const currentSelection = getCurrentSelectionText();
                
                if (currentSelection) {
                    userPrompt = userPrompt.replaceAll(`#${reference.name}`, currentSelection);
                    Logger.debug('Reference replaced', { name: reference.name, length: currentSelection.length });
                } else {
                    Logger.warn('No selection found for reference', { name: reference.name });
                }
            }
        }
        
        Logger.info('Prompt processing completed', {
            timeMs: Date.now() - startTime,
            originalLength: request.prompt.length,
            finalLength: userPrompt.length
        });
        
        return userPrompt;
    } catch (error) {
        Logger.error('Error processing prompt', error);
        return request.prompt; // Fallback to original prompt
    }
}

export function addReferencesToPrompt(request: vscode.ChatRequest, messages: vscode.LanguageModelChatMessage[]) {
    for (const ref of request.references) {
        const reference = ref as any;
        if (reference.id === 'copilot.selection') {
            const location = getCurrentSelectionLocation();
            if (location) {
                messages.push(vscode.LanguageModelChatMessage.User(`Selected code: ${location}`, 'context'));
            }
        }
    }
}

function getCurrentSelectionText(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return null;
    }
    return editor.document.getText(editor.selection);
}

function getCurrentSelectionLocation(): vscode.Location | null {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        return new vscode.Location(editor.document.uri, editor.selection);
    }
    return null;
}
