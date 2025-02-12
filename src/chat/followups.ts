import * as vscode from 'vscode';
import { ChatResult } from './types';
import { Logger } from '../utils/logging';

const DEFAULT_FOLLOWUPS = [
    "Analyze your output systematically!",
    "Are you hungry?"
];

export function generateFollowups(result: ChatResult, context: vscode.ChatContext): vscode.ChatFollowup[] {
    Logger.debug('Generating followups', { result });
    
    return DEFAULT_FOLLOWUPS.map(prompt => ({
        prompt,
        label: `🦫 ${prompt}`
    }));
}
