import * as vscode from 'vscode';
import { getUserPrompt, addReferencesToPrompt } from './references';
import { getSystemPrompt } from './prompts';
import { Logger } from '../utils/logging';
import { ChatResult } from './types';

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
        
        await handleChatRequest(requestId, request, stream, token, model);
        
        return {
            success: true,
            metadata: {
                command: request.command,
                modelUsed: model.name,
                timing: Date.now() - startTime
            }
        };
    } catch (error) {
        Logger.error(`[${requestId}] Handler error`, error);
        stream.markdown("An error occurred while processing your request.");
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    } finally {
        Logger.info(`[${requestId}] Handler completed`);
    }
}

async function handleListModels(requestId: string, stream: vscode.ChatResponseStream) {
    const models = await vscode.lm.selectChatModels();
    Logger.info(`[${requestId}] Listing models`);
    const modelNames = models.map(model => model.name).join(',\n ');
    await stream.markdown(`Available models:\n${modelNames}`);
}

// Update handleChatRequest to use the model from request:
async function handleChatRequest(
    requestId: string,
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    model: vscode.LanguageModelChat
) {
    const userPrompt = getUserPrompt(request);
    const messages = [
        getSystemPrompt(),
        vscode.LanguageModelChatMessage.User(userPrompt)
    ];

    addReferencesToPrompt(request, messages);

    try {
        const chatResponse = await model.sendRequest(messages, {}, token);
        if (!chatResponse?.text) {
            throw new Error("Empty response from chat model");
        }
        
        for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
        }
    } catch (error) {
        Logger.error(`[${requestId}] Error during chat model request`, error);
        stream.markdown("An error occurred while processing your request.");
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