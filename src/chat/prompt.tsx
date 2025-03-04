import { ChatResultFeedbackKind } from 'vscode';

/**
 * Represents the result of a chat request.
 */
export interface ChatResult {
    /**
     * Indicates whether the chat request was successful.
     */
    success: boolean;
    /**
     * The error message if the chat request failed.
     */
    error?: string;
    /**
     * Metadata about the chat request.
     */
    metadata?: ChatMetadata;
}

export interface ChatMetadata {
    /**
     * The command that was executed.
     */
    command?: string;
    /**
     * The model that was used to generate the response.
     */
    modelUsed?: string;
    /**
     * The time it took to generate the response.
     */
    timing?: number;
}

interface IChatHandlerResult {
    success: boolean;
    error?: string;
    metadata: {
        command?: string;
        modelUsed?: string;
        timing?: number; 
        feedbackType?: ChatResultFeedbackKind;
    };
}

/**
 * Represents a follow-up question or action that can be taken after a chat request.
 */
export interface ChatFollowup {
    /**
     * The message to send to the chat.
     */
    prompt: string;

    /**
     * A title to show the user. The prompt will be shown by default, when this is unspecified.
     */
    label?: string;

    /**
     * By default, the followup goes to the same participant/command. But this property can be set to invoke a different participant by ID.
     * Followups can only invoke a participant that was contributed by the same extension.
     */
    participant?: string;

    /**
     * By default, the followup goes to the same participant/command. But this property can be set to invoke a different command.
     */
    command?: string;
}

/**
 * Defines the roles for messages in the chat.
 */
export const MESSAGE_ROLES = {
    SYSTEM: 'system',
    CONTEXT: 'context',
    USER: 'user'
} as const;
