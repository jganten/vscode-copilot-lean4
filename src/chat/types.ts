import { ChatResultFeedbackKind } from 'vscode';

export interface ChatResult {
    success: boolean;
    error?: string;
    metadata?: {
        command?: string;
        modelUsed?: string;
        timing?: number;
    }
}

interface IChatHandlerResult {
    success: boolean;
    error?: string;
    metadata: {
        command?: string;
        modelUsed?: string;
        timing?: number; 
        feedbackType?: ChatResultFeedbackKind;
    }
}

export const MESSAGE_ROLES = {
    SYSTEM: 'system',
    CONTEXT: 'context',
    USER: 'user'
} as const;
