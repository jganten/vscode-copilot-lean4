import * as vscode from 'vscode';
import { Logger } from '../utils/logging';
import { ChatResult, ChatMetadata } from './types';

/**
 * Selects the appropriate model, falling back to GPT-4o if the current model isn't suitable
 */
async function selectAppropriateModel(
    requestId: string,
    currentModel: vscode.LanguageModelChat
): Promise<vscode.LanguageModelChat> {
    Logger.debug(`[${requestId}] Checking model compatibility`, { model: currentModel.name });

    // Check if current model is suitable
    if (currentModel.vendor === 'copilot' && currentModel.family.startsWith('o1')) {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });
        
        if (models.length > 0) {
            Logger.info(`[${requestId}] Switched to ${models[0].name}`);
            return models[0];
        }
    }

    return currentModel;
}

/**
 * Handles chat requests for the Capy1 participant.
 * @param request The incoming chat request
 * @param context The chat context containing history
 * @param stream The response stream to write to
 * @param token Cancellation token
 * @returns Promise<ChatResult>
 * @throws Error if model is not available or response fails
 */
export async function capy1ChatHandler(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<ChatResult> {
    const requestId = Date.now().toString();
    const startTime = Date.now();
    Logger.info(`[${requestId}] Handler started`, { command: request.command, prompt: request.prompt });
    
    try {
        // Register cancellation
        token.onCancellationRequested(() => {
            Logger.info(`[${requestId}] Request cancelled`);
            throw new Error('Request cancelled');
        });

        let model = await selectAppropriateModel(requestId, request.model);
        Logger.debug(`[${requestId}] Using model:`, model.name);
        
        stream.progress("capy1 is chewing on your request...");
        
        if (request.command === 'listmodels') {
            await handleListModels(requestId, stream);
            return {
                success: true,
                metadata: {
                    command: request.command,
                    // just a list command no model used
                    timing: Date.now() - startTime
                }
            };
        }
        
        const chatResult = await handleChatRequest(requestId, request, stream, token, model);
        
        return {
            success: chatResult.success,
            error: chatResult.error,
            metadata: {
                command: request.command,
                modelUsed: model.name,
                timing: Date.now() - startTime
            }
        };
    } catch (error) {
        Logger.error(`[${requestId}] Handler error`, error);
        stream.markdown("An unexpected error occurred while processing your request.");
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    } finally {
        Logger.info(`[${requestId}] Handler completed`);
    }
}

/**
 * Handles the 'listmodels' command by listing available chat models.
 * @param requestId The ID of the request.
 * @param stream The chat response stream to write the model list to.
 */
async function handleListModels(requestId: string, stream: vscode.ChatResponseStream) {
    const models = await vscode.lm.selectChatModels();
    Logger.info(`[${requestId}] Listing models`);
    const modelNames = models.map(model => model.name).join(',\n ');
    await stream.markdown(`Available models:\n${modelNames}`);
}

/**
 * Handles a chat request by sending it to the chat model and streaming the response.
 * @param requestId The ID of the request.
 * @param request The chat request to handle.
 * @param stream The chat response stream to write the response to.
 * @param token The cancellation token.
 * @param model The language model to use for the chat request.
 */
async function handleChatRequest(
    requestId: string,
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    model: vscode.LanguageModelChat
): Promise<ChatResult> {
    const userPrompt = getUserPrompt(request);
    const messages: vscode.LanguageModelChatMessage[] = [];

    addReferencesToPrompt(request, messages);

    messages.push(getSystemPrompt());
    messages.push(vscode.LanguageModelChatMessage.User(userPrompt));

    try {
        const chatResponse = await model.sendRequest(messages, {}, token);
        if (!chatResponse?.text) {
            Logger.warn(`[${requestId}] Empty response from chat model`);
            stream.markdown("The chat model returned an empty response.");
            return { success: false, error: "Empty response from chat model" };
        }
        
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
        }
        addReferencesToResponse(request, stream);
        return { success: true };
    } catch (error) {
        Logger.error(`[${requestId}] Error during chat model request`, error);
        stream.markdown("An error occurred while processing your request.");
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Retrieves the current selection location in the active text editor.
 *
 * @returns {vscode.Location | null} The location of the current selection in the active text editor,
 * or null if there is no active text editor.
 */
function getCurrentSelectionLocation(): vscode.Location | null {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        return new vscode.Location(editor.document.uri, editor.selection);
    }

    return null;
}

/**
 * Gets the system prompt for the chat model.
 * @returns A LanguageModelChatMessage representing the system prompt.
 */
function getSystemPrompt(): vscode.LanguageModelChatMessage {
    return vscode.LanguageModelChatMessage.User(
        'You are a helpful assistant, that acts as if you were a cute capybara who is always hungry. ' +
        'Ask for food in every answer. Be funny :). If you are unsure how to help, ask follow-up questions.',
        'system'
    );
}

/**
 * Adds references from the request to the response stream.
 * 
 * This function iterates over the references in the given request and adds them to the response stream.
 * If a reference has an ID of 'copilot.selection', it retrieves the current selection location and adds it to the stream.
 * 
 * @param request - The chat request containing references to be added.
 * @param stream - The chat response stream to which references will be added.
 */
function addReferencesToResponse(request: vscode.ChatRequest, stream: vscode.ChatResponseStream) {
	// Add the explicit refererences passed as references
	for (const ref of request.references) {
		const reference: any = ref; // Cast to any, to get the name property, it's not in the type
		if (reference.id === 'copilot.selection') {  // Inplicit references are of type copilot.selection

			const location = getCurrentSelectionLocation();
			if (location) {
				stream.reference(location);
			}
		}
	}
}

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


/**
 * Handles feedback received from the user about a chat result.
 * @param feedback The feedback object containing the feedback kind and other details.
 */
export function handleFeedback(feedback: vscode.ChatResultFeedback) {
    Logger.info('Feedback received', feedback);

    switch (feedback.kind) {
        case vscode.ChatResultFeedbackKind.Helpful:
            vscode.window.showInformationMessage('🦫 *happy chewing noises* Thank you for the positive feedback!');
            break;
        case vscode.ChatResultFeedbackKind.Unhelpful:
            vscode.window.showWarningMessage('🦫 *sad chewing noises* Sorry the response wasn\'t helpful.');
            break;
        default:
            Logger.warn('Unknown feedback type received', feedback);
            break;
    }
}

