import * as vscode from 'vscode';
import { ChatResult } from './types';
import { Logger } from '../utils/logging';

const DEFAULT_FOLLOWUPS = [
    "Analyze your output systematically!",
    "Are you hungry?"
];

/**
 * Generates follow-up questions or actions based on the chat result and context.
 * @param result The result of the chat request.
 * @param context The chat context.
 * @returns An array of ChatFollowup objects representing the follow-up options.
 */
export function generateFollowups(result: ChatResult, context: vscode.ChatContext): vscode.ChatFollowup[] {
    Logger.debug('Generating followups', { result });
    
    return DEFAULT_FOLLOWUPS.map(prompt => ({
        prompt,
        label: `🦫 ${prompt}`
    }));
}
