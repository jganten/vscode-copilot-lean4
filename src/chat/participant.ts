/**
 * This file defines the chat participant for the Lean 4 Copilot extension.
 * It handles chat requests, manages tool interactions, and provides follow-up suggestions.
 *
 * Key components:
 * - `registerChatParticipant`: Registers the chat participant with VS Code.
 * - `lean4CopilotChatHandler`: Handles incoming chat requests.
 * - `listToolsCommand`, `listModelsCommand`: Commands for listing available tools and models.
 * - `handleChatRequest`: Orchestrates the chat request processing, including tool execution.
 * - Utility functions for managing selections, prompts, and follow-ups.
 */
import * as vscode from 'vscode';
import { Logger } from '../utils/logging';
import { renderPrompt } from '@vscode/prompt-tsx';
import { ToolCallRound, lean4ChatResult, ToolResultMetadata, NoToolsUserPrompt, toolsUserPrompt, MESSAGE_ROLES } from './lean4Prompt';

export interface TsxToolUserMetadata {
    toolCallsMetadata: ToolCallsMetadata;
}

export interface ToolCallsMetadata {
    toolCallRounds: ToolCallRound[];
    toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

/**
 * Type guard to check if an object is of type `TsxToolUserMetadata`.
 * @param obj The object to check.
 * @returns `true` if the object is `TsxToolUserMetadata`, `false` otherwise.
 */
export function isTsxToolUserMetadata(obj: unknown): obj is TsxToolUserMetadata {
    // If you change the metadata format, you would have to make this stricter or handle old objects in old ChatRequest metadata
    return !!obj &&
        !!(obj as TsxToolUserMetadata).toolCallsMetadata &&
        Array.isArray((obj as TsxToolUserMetadata).toolCallsMetadata.toolCallRounds);
}

export function registerLean4Tools(context: vscode.ExtensionContext) {
    Logger.info('Registering Lean 4 tools');
    const listModelsTool = new ListModelsTool();
    const listToolsTool = new ListToolsTool();
    context.subscriptions.push(vscode.lm.registerTool('lean4-copilot-listModels', listModelsTool));
    context.subscriptions.push(vscode.lm.registerTool('lean4-copilot-listTools', listToolsTool));
    Logger.info(`Registered tool: lean4-copilot-listModels`, listModelsTool);
    Logger.info(`Registered tool: lean4-copilot-listTools`, listToolsTool);
}

/**
 * Registers the chat participant with VS Code.
 * @param context The extension context.
 * @returns The registered chat participant.
 */
export function registerChatParticipant(context: vscode.ExtensionContext) {
    Logger.info('Registering chat participant');
    
    const participant = vscode.chat.createChatParticipant('lean4.copilot', lean4CopilotChatHandler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'lean4CopilotIcon.png');
    
    // Add followup provider
    participant.followupProvider = {
        provideFollowups: generateFollowups
    };

    // Register feedback handler
    participant.onDidReceiveFeedback(handleFeedback);
    
    context.subscriptions.push(participant);
    return participant;
}

/**
 * Selects the appropriate model, falling back to GPT-4o if the current model isn't suitable.
 * @param requestId The ID of the request.
 * @param currentModel The currently selected language model.
 * @returns A promise that resolves to the appropriate language model.
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
 * Handles chat requests for the lean4Copilot chat participant.
 * @param request The incoming chat request.
 * @param context The chat context containing history.
 * @param stream The response stream to write to.
 * @param token Cancellation token.
 * @returns A promise that resolves to a `lean4ChatResult`.
 * @throws Error if model is not available or response fails.
 */
export async function lean4CopilotChatHandler(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<lean4ChatResult> {
    const requestId = Date.now().toString();
    const startTime = Date.now();
    Logger.info(`[${requestId}] Handler started`, { command: request.command, prompt: request.prompt });
    
    try {
        // Register cancellation
        token.onCancellationRequested(() => {
            Logger.info(`[${requestId}] Request cancelled`);
            throw new Error('Request cancelled');
        });
        
        stream.progress("lean4Copilot is busy thinking...");

        // Direct output commands
        switch (request.command) {
            case 'listTools':
            return await listToolsCommand(stream);
            case 'listModels':
            return await listModelsCommand(requestId, stream);
        }

        let model = await selectAppropriateModel(requestId, request.model);
        Logger.debug(`[${requestId}] Using model:`, model.name);
        
        return await handleChatRequest(requestId, request, context, stream, token, model);
    } catch (error) {
        Logger.error(`[${requestId}] Handler error`, error);
        stream.markdown("An unexpected error occurred while processing your request.");
        return {
            success: false,
            errorDetails: {message: error instanceof Error ? error.message : 'Unknown error',
                responseIsFiltered: false
            },
            metadata: {}
        };
    } finally {
        Logger.info(`[${requestId}] Handler completed`);
    }
}

/**
 * Handles the 'listTools' command by listing available tools.
 * @param stream The chat response stream to write the tool list to.
 * @returns A promise that resolves to a `lean4ChatResult`.
 */
async function listToolsCommand(stream: vscode.ChatResponseStream) : Promise<lean4ChatResult> {
    Logger.info('listToolsCommand called');
    const markdownTable = getToolsMarkdownTable();
    Logger.info('markdownTable:', markdownTable);
    await stream.markdown(markdownTable);
    return { success: true, metadata: { command: 'list' } };
}

/**
 * Handles the 'listModels' command by listing available chat models.
 * @param requestId The ID of the request.
 * @param stream The chat response stream to write the model list to.
 * @returns A promise that resolves to a `lean4ChatResult`.
 */
async function listModelsCommand(requestId: string, stream: vscode.ChatResponseStream): Promise<lean4ChatResult> {
    const markdownTable = await getModelsMarkdownTable();
    Logger.info(`[${requestId}] Listing models`);
    await stream.markdown(markdownTable);
    return { success: true, metadata: {command : 'listModels'} };
}

function getToolsMarkdownTable(): string {
    const tools = vscode.lm.tools;

    // Create the header of the markdown table
    let tableHeader = '| Name | Description | Input | Tags |\n|---|---|---|---|';
    let tableRows = '';

    // Add each tool as a row in the table
    for (const tool of tools) {
        const name = tool.name;
        const description = tool.description.substring(0, 50).replace(/[\r\n]+/g, ' ') + '...'; // Truncate and replace newlines
        const inputSchema = tool.inputSchema ? 'Yes' : 'No';
        const tags = tool.tags.join(', ') || 'None';

        tableRows += `\n| ${name} | ${description} | ${inputSchema} | ${tags} |`;
    }

    return `Available tools:\n${tableHeader + tableRows}`;
}

async function getModelsMarkdownTable(): Promise<string> {
    const models = await vscode.lm.selectChatModels();

    if (models.length === 0) {
        return 'No models available.';
    }

    // Create the header of the markdown table
    let tableHeader = '| Name | Max Input Tokens |\n|---|---|';
    let tableRows = '';

    // Add each model as a row in the table
    for (const model of models) {
        const maxInputTokens = model.maxInputTokens ? `${Math.round(model.maxInputTokens / 1000)}k` : 'N/A';
        tableRows += `\n| ${model.name} | ${maxInputTokens} |`;
    }

    return `Available models:\n${tableHeader + tableRows}`;
}

/**
 * Handles a chat request by sending it to the chat model and streaming the response.
 */
async function handleChatRequest(
    requestId: string,
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    model: vscode.LanguageModelChat
): Promise<lean4ChatResult> {
    const config = vscode.workspace.getConfiguration('lean4.copilot');
    const autoToolUse = config.get<boolean>('autoToolUse', true);

    if (autoToolUse) {
        return runTools(requestId, request, chatContext, stream, token, model);
    } else {
        return runNoTools(requestId, request, chatContext, stream, token, model);
    }
}

/**
 * Handles a chat request without using tools.
 */
async function runNoTools(
    requestId: string,
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    model: vscode.LanguageModelChat
): Promise<lean4ChatResult> {
    Logger.info(`[${requestId}] Auto tool use disabled, skipping tool calls`);
    const options: vscode.LanguageModelChatRequestOptions = {};
    const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
    const toolCallRounds: ToolCallRound[] = [];
    let messages: vscode.LanguageModelChatMessage[] = [];

    // Render the prompt *without* ToolCalls
    const result = await renderPrompt(
        NoToolsUserPrompt,
        {
            request: request,
            context: chatContext,
            toolCallRounds: toolCallRounds,
            toolCallResults: accumulatedToolResults
        },
        { modelMaxPromptTokens: model.maxInputTokens },
        model
    );
    messages = result.messages;

    result.references.forEach(ref => {
        if (ref.anchor instanceof vscode.Uri || ref.anchor instanceof vscode.Location) {
            stream.reference(ref.anchor);
        }
    });

    const response = await model.sendRequest(messages, options, token);
    let responseStr = '';
    for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
            stream.markdown(part.value);
            responseStr += part.value;
        }
    }
    return {
        success: true,
        metadata: {}
    };
}

/**
 * Handles a chat request with tool usage.
 */
async function runTools(
    requestId: string,
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    model: vscode.LanguageModelChat
): Promise<lean4ChatResult> {

    Logger.info(`[${requestId}] Auto tool use enabled, starting tool calls`);

    const options: vscode.LanguageModelChatRequestOptions = {};
    const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
    const toolCallRounds: ToolCallRound[] = [];
    let messages: vscode.LanguageModelChatMessage[] = [];

    async function executeToolCallRound(): Promise<lean4ChatResult> {
        // Render the prompt with tool calls
        const result = await renderPrompt(
            toolsUserPrompt,
            {
                request: request,
                context: chatContext,
                toolCallRounds: toolCallRounds,
                toolCallResults: accumulatedToolResults
            },
            { modelMaxPromptTokens: model.maxInputTokens },
            model
        );
        messages = result.messages;

        result.references.forEach(ref => {
            if (ref.anchor instanceof vscode.Uri || ref.anchor instanceof vscode.Location) {
                stream.reference(ref.anchor);
            }
        });

        // Send the request to the LanguageModelChat
        const response = await model.sendRequest(messages, options, token);

        // Stream text output and collect tool calls from the response
        const toolCalls: vscode.LanguageModelToolCallPart[] = [];
        let responseStr = '';
        for await (const part of response.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
                stream.markdown(part.value);
                responseStr += part.value;
            } else if (part instanceof vscode.LanguageModelToolCallPart) {
                toolCalls.push(part);
            }
        }

        if (toolCalls.length) {
            // If the model called any tools, then we do another round- render the prompt with those tool calls (rendering the PromptElements will invoke the tools)
            // and include the tool results in the prompt for the next request.
            toolCallRounds.push({
                response: responseStr,
                toolCalls
            });

            // Invoke tools and cache results
            for (const toolCall of toolCalls) {
                const tool = vscode.lm.tools.find(t => t.name === toolCall.name);
                if (!tool) {
                    Logger.error(`Tool not found: ${toolCall.name}`);
                    accumulatedToolResults[toolCall.callId] = { content: ['Tool not found'] };
                    continue;
                }
                try {
                    const toolResult = await vscode.lm.invokeTool(toolCall.name, { input: toolCall.input, toolInvocationToken: request.toolInvocationToken }, token);
                    accumulatedToolResults[toolCall.callId] = toolResult;
                } catch (e: any) {
                    Logger.error(`Error invoking tool ${toolCall.name}: ${e.message}`);
                    accumulatedToolResults[toolCall.callId] = { content: [`Error invoking tool: ${e.message}`] };
                }
            }
            // This loops until the model doesn't want to call any more tools, then the request is done.
            return executeToolCallRound();
        } else {
            // No tool calls, so we're done
            return {
                success: true,
                metadata: {
                    // Return tool call metadata so it can be used in prompt history on the next request
                    toolCallsMetadata: {
                        toolCallResults: accumulatedToolResults,
                        toolCallRounds
                    } satisfies ToolCallsMetadata,
                }
            };
        }
    }

    return await executeToolCallRound();
}

/**
 * Retrieves the current selection location in the active text editor.
 *
 * @returns The location of the current selection in the active text editor,
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
 * Gets the system prompt for the chat model from settings.
 * @returns A LanguageModelChatMessage representing the system prompt.
 */
function getSystemPrompt(): vscode.LanguageModelChatMessage {
    const config = vscode.workspace.getConfiguration('lean4.copilot');
    const defaultPrompt = 'You are a helpful math assistant for the lean4 theorem prover!';
    const systemPrompt = config.get<string>('systemPrompt', defaultPrompt);
    
    if (systemPrompt === defaultPrompt) {
        Logger.warn('Using fallback system prompt');
    }
    
    return vscode.LanguageModelChatMessage.User(systemPrompt, MESSAGE_ROLES.SYSTEM);
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
                        messages.push(vscode.LanguageModelChatMessage.User(`Selected code: ${selectionText} at ${location.uri.fsPath}:${location.range.start.line + 1}:${location.range.start.character + 1}`, MESSAGE_ROLES.CONTEXT));
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
 * Generates follow-up questions or actions based on the chat result and context, using settings.
 * @param result The result of the chat request.
 * @param context The chat context.
 * @returns An array of ChatFollowup objects representing the follow-up options.
 */
export function generateFollowups(result: lean4ChatResult, context: vscode.ChatContext): vscode.ChatFollowup[] {
    // For now to use 'context'
    console.log(context);
    
    Logger.debug('Generating followups', { result });
    const config = vscode.workspace.getConfiguration('lean4.copilot');
    const defaultFollowUps = ["Explain this code in detail.", "Suggest possible improvements."];
    const followUps = config.get<string[]>('followUps', defaultFollowUps);
    
    if (followUps === defaultFollowUps) {
        Logger.warn('Using fallback follow-up prompts');
    }
    
    return followUps.map(prompt => ({
        prompt,
        label: `➕ ${prompt}`
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
            vscode.window.showInformationMessage('Thank you for the positive feedback (not processed for now)!');
            break;
        case vscode.ChatResultFeedbackKind.Unhelpful:
            vscode.window.showWarningMessage('Sorry the response wasn\'t helpful. Feel free to contact (not processed automatically for now).');
            break;
        default:
            Logger.warn('Unknown feedback type received', feedback);
            break;
    }
}

interface ListModelsToolParams {}
interface ListToolsToolParams {}

class ListModelsTool implements vscode.LanguageModelTool<ListModelsToolParams> {
    async invoke(): Promise<vscode.LanguageModelToolResult> {
        const markdownTable = await getModelsMarkdownTable();
        return { content: [new vscode.ChatResponseMarkdownPart(markdownTable)] };
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing available language models.',
        };
    }
}

class ListToolsTool implements vscode.LanguageModelTool<ListToolsToolParams> {
    async invoke(): Promise<vscode.LanguageModelToolResult> {
        const markdownTable = getToolsMarkdownTable();
        return { content: [new vscode.ChatResponseMarkdownPart(markdownTable)] };
    }

    async prepareInvocation(): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing available tools.',
        };
    }
}
