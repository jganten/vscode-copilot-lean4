import {
	AssistantMessage,
	BasePromptElementProps,
	Chunk,
	PrioritizedList,
	PromptElement,
	PromptElementProps,
	PromptMetadata,
	PromptPiece,
	PromptReference,
	PromptSizing,
	ToolCall,
	ToolMessage,
	UserMessage
} from '@vscode/prompt-tsx';
import { ToolResult } from '@vscode/prompt-tsx/dist/base/promptElements';
import * as vscode from 'vscode';
import { isTsxToolUserMetadata, getLean4CopilotSettings } from './participant';
import { Logger } from '../utils/logging';

/**
 * Defines the roles for messages in the chat.
 */
export const MESSAGE_ROLES = {
    SYSTEM: 'system',
    CONTEXT: 'context',
    USER: 'user'
} as const;


export interface ToolCallRound {
	response: string;
	toolCalls: vscode.LanguageModelToolCallPart[];
}

export interface ToolUserProps extends BasePromptElementProps {
	request: vscode.ChatRequest;
	context: vscode.ChatContext;
	toolCallRounds: ToolCallRound[];
	toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

/**
 * Interface representing the result of a Lean 4 chat operation.
 * Extends the `vscode.ChatResult` interface.
 * 
 * @property {boolean} success - Indicates whether the chat operation was successful.
 * @property {Object} metadata - Contains additional information about the chat operation.
 * @property {string} [metadata.command] - Optional command associated with the chat operation.
 * @property {string} [metadata.modelUsed] - Optional model used for the chat operation.
 * @property {number} [metadata.timing] - Optional timing information for the chat operation.
 */
export interface lean4ChatResult extends vscode.ChatResult {
    success: boolean;
    metadata: {
        command?: string;
        modelUsed?: string;
        timing?: number;
        [key: string]: any;
    };
}

/**
 * Composing of a ToolUserPrompt, which is a prompt that includes tool calls and their results.
 * 
 */
export class ToolUserPrompt extends PromptElement<ToolUserProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		const { systemPrompt, toolUseInstructions } = getLean4CopilotSettings();
		return (
			<>
				<UserMessage>
					{systemPrompt}
					{toolUseInstructions}
				</UserMessage>
				<History context={this.props.context} priority={10} />
				<PromptReferences
					references={this.props.request.references}
					priority={20}
				/>
				<UserMessage>{this.props.request.prompt}</UserMessage>
				<ToolCalls
					toolCallRounds={this.props.toolCallRounds}
					toolInvocationToken={this.props.request.toolInvocationToken}
					toolCallResults={this.props.toolCallResults} />
			</>
		);
	}
}

export class NoToolsUserPrompt extends PromptElement<ToolUserProps, void> {
	render(_state: void, _sizing: PromptSizing) {
		const { systemPrompt } = getLean4CopilotSettings();
		return (
			<>
				<UserMessage>
					{systemPrompt} <br />
				</UserMessage>
				<History context={this.props.context} priority={10} />
				<PromptReferences
					references={this.props.request.references}
					priority={20}
				/>
				<UserMessage>{this.props.request.prompt}</UserMessage>
			</>
		);
	}
}

interface ToolCallsProps extends BasePromptElementProps {
	toolCallRounds: ToolCallRound[];
	toolCallResults: Record<string, vscode.LanguageModelToolResult>;
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
}

const dummyCancellationToken: vscode.CancellationToken = new vscode.CancellationTokenSource().token;

/**
 * Render a set of tool calls, which look like an AssistantMessage with a set of tool calls followed by the associated UserMessages containing results.
 */
class ToolCalls extends PromptElement<ToolCallsProps, void> {
	async render(_state: void, _sizing: PromptSizing) {
		Logger.info("ToolCalls.render: this.props", this.props); // Added logging
		if (!this.props.toolCallRounds.length) {
			return undefined;
		}

		// Note- for the copilot models, the final prompt must end with a non-tool-result UserMessage
		Logger.info("ToolCalls.render: Mapping toolCallRounds"); // Added logging
		const renderedRounds = this.props.toolCallRounds.map(round => this.renderOneToolCallRound(round));
		Logger.info("ToolCalls.render: Mapped toolCallRounds", renderedRounds); // Added logging
		return <>
			{renderedRounds}
			<UserMessage>Above is the result of calling one or more tools. The user cannot see the results, so you should explain them to the user if referencing them in your answer.</UserMessage>
		</>;
	}

	private renderOneToolCallRound(round: ToolCallRound) {
		Logger.info("ToolCalls.renderOneToolCallRound: round", round); // Added logging
		const assistantToolCalls: ToolCall[] = round.toolCalls.map(tc => ({ type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input) }, id: tc.callId }));
		Logger.info("ToolCalls.renderOneToolCallRound: Mapping toolCalls"); // Added logging
		const renderedToolCalls = round.toolCalls.map(toolCall =>
			<ToolResultElement toolCall={toolCall} toolInvocationToken={this.props.toolInvocationToken} toolCallResult={this.props.toolCallResults[toolCall.callId]} />);
		Logger.info("ToolCalls.renderOneToolCallRound: Mapped toolCalls", renderedToolCalls); // Added logging
		return (
			<Chunk>
				<AssistantMessage toolCalls={assistantToolCalls}>{round.response}</AssistantMessage>
				{renderedToolCalls}
			</Chunk>);
	}
}

interface ToolResultElementProps extends BasePromptElementProps {
	toolCall: vscode.LanguageModelToolCallPart;
	toolInvocationToken: vscode.ChatParticipantToolToken | undefined;
	toolCallResult: vscode.LanguageModelToolResult | undefined;
}

/**
 * One tool call result, which either comes from the cache or from invoking the tool.
 */
class ToolResultElement extends PromptElement<ToolResultElementProps, void> {
	async render(_state: void, sizing: PromptSizing): Promise<PromptPiece | undefined> {
		const tool = vscode.lm.tools.find(t => t.name === this.props.toolCall.name);
		if (!tool) {
			Logger.error(`Tool not found: ${this.props.toolCall.name}`);
			return <ToolMessage toolCallId={this.props.toolCall.callId}>Tool not found</ToolMessage>;
		}

		const tokenizationOptions: vscode.LanguageModelToolTokenizationOptions = {
			tokenBudget: sizing.tokenBudget,
			countTokens: async (content: string) => sizing.countTokens(content),
		};

		Logger.info("ToolResultElement.render: Before invokeTool", { toolCall: this.props.toolCall }); // Added logging
		let toolResult: vscode.LanguageModelToolResult | undefined;
		try {
			toolResult = this.props.toolCallResult ??
				await vscode.lm.invokeTool(this.props.toolCall.name, { input: this.props.toolCall.input, toolInvocationToken: this.props.toolInvocationToken, tokenizationOptions }, dummyCancellationToken);
			Logger.info("ToolResultElement.render: After invokeTool", { toolResult }); // Added logging
		} catch (error) {
			Logger.error("ToolResultElement.render: Error invoking tool", { toolCall: this.props.toolCall.name, error });
			return <ToolMessage toolCallId={this.props.toolCall.callId}>Error invoking tool: {this.props.toolCall.name}</ToolMessage>;
		}

		return (
			<ToolMessage toolCallId={this.props.toolCall.callId}>
				<meta value={new ToolResultMetadata(this.props.toolCall.callId, toolResult)}></meta>
				<ToolResult data={toolResult} />
			</ToolMessage>
		);
	}
}

export class ToolResultMetadata extends PromptMetadata {
	constructor(
		public toolCallId: string,
		public result: vscode.LanguageModelToolResult,
	) {
		super();
	}
}

interface HistoryProps extends BasePromptElementProps {
	priority: number;
	context: vscode.ChatContext;
}

/**
 * Render the chat history, including previous tool call/results.
 */
class History extends PromptElement<HistoryProps, void> {
    render(_state: void, _sizing: PromptSizing) {
        Logger.info("History: ", this.props.context.history);
        return (
            <PrioritizedList priority={this.props.priority} descending={false}>
                {this.props.context.history.map((message) => {
                    if (message instanceof vscode.ChatRequestTurn) {
                        return (
                            <>
                                {<PromptReferences references={message.references} excludeReferences={true} />}
                                <UserMessage>{message.prompt}</UserMessage>
                            </>
                        );
                    } else if (message instanceof vscode.ChatResponseTurn) {
                        const metadata = message.result.metadata;
                        if (isTsxToolUserMetadata(metadata) && metadata.toolCallsMetadata.toolCallRounds.length > 0) {
                            return <ToolCalls toolCallResults={metadata.toolCallsMetadata.toolCallResults} toolCallRounds={metadata.toolCallsMetadata.toolCallRounds} toolInvocationToken={undefined} />;
                        }

                        return <AssistantMessage>{chatResponseToString(message)}</AssistantMessage>;
                    }
                })}
            </PrioritizedList>
        );
    }
}

/**
 * Convert the stream of chat response parts into something that can be rendered in the prompt.
 */
function chatResponseToString(response: vscode.ChatResponseTurn): string {
	return response.response
		.map((r) => {
			if (r instanceof vscode.ChatResponseMarkdownPart) {
				return r.value.value;
			} else if (r instanceof vscode.ChatResponseAnchorPart) {
				if (r.value instanceof vscode.Uri) {
					return r.value.fsPath;
				} else {
					return r.value.uri.fsPath;
				}
			}

			return '';
		})
		.join('');
}
interface PromptReferencesProps extends BasePromptElementProps {
	references: ReadonlyArray<vscode.ChatPromptReference>;
	excludeReferences?: boolean;
}

/**
 * Render references that were included in the user's request, eg files and selections.
 */
class PromptReferences extends PromptElement<PromptReferencesProps, void> {
    async render(_state: void, _sizing: PromptSizing): Promise<PromptPiece | undefined> {
        Logger.info("PromptReferences: ", this.props.references);
        if (!this.props.references || this.props.references.length === 0) {
            return; // Return undefined if there are no references
        }
        return (
            <>
                {this.props.references && this.props.references.length > 0 ? (
                    <UserMessage>
                        {this.props.references.map(ref => (
                                                            <PromptReferenceElement ref={ref} excludeReferences={this.props.excludeReferences} />
                                                    ))}
                    </UserMessage>
                ) : null}
            </>
        );
    }
}

interface PromptReferenceProps extends BasePromptElementProps {
	ref: vscode.ChatPromptReference;
	excludeReferences?: boolean;
}

class PromptReferenceElement extends PromptElement<PromptReferenceProps> {
    async render(_state: void, _sizing: PromptSizing): Promise<PromptPiece | undefined> {
        const value = this.props.ref.value;
        Logger.info("PromptReferenceElement: ", value);
        if (value instanceof vscode.Uri) {
            try {
                const fileContents = (await vscode.workspace.fs.readFile(value)).toString();
                return (
                    <Tag name="context">
                        {!this.props.excludeReferences && <references value={[new PromptReference(value)]} />}
                        {value.fsPath}:<br />
                        ``` <br />
                        {fileContents}<br />
                        ```<br />
                    </Tag>
                );
            } catch (error) {
                Logger.error(`Error reading file ${value.fsPath}:`, error);
                return <Tag name="context">Error reading file: {value.fsPath}</Tag>;
            }
        } else if (value instanceof vscode.Location) {
            try {
                const rangeText = (await vscode.workspace.openTextDocument(value.uri)).getText(value.range);
                return (
                    <Tag name="context">
                        {!this.props.excludeReferences && <references value={[new PromptReference(value)]} />}
                        {value.uri.fsPath}:{value.range.start.line + 1}-${value.range.end.line + 1}: <br />
                        ```<br />
                        {rangeText}<br />
                        ```
                    </Tag>
                );
            } catch (error) {
                Logger.error(`Error reading range ${value.uri.fsPath}:${value.range.start.line + 1}-${value.range.end.line + 1}:`, error);
                return <Tag name="context">Error reading range: {value.uri.fsPath}:{value.range.start.line + 1}-${value.range.end.line + 1}</Tag>;
            }
        } else if (typeof value === 'string') {
            return <Tag name="context">{value}</Tag>;
        } else {
            return <Tag name="context">Unsupported reference type</Tag>;
        }
    }
}

type TagProps = PromptElementProps<{
	name: string;
}>;


class Tag extends PromptElement<TagProps> {
	private static readonly _regex = /^[a-zA-Z_][\w.-]*$/;

	render() {
		const { name } = this.props;

		if (!Tag._regex.test(name)) {
			throw new Error(`Invalid tag name: ${this.props.name}`);
		}

		return (
			<>
				{'<' + name + '>'}<br />
				<>
					{this.props.children}<br />
				</>
				{'</' + name + '>'}<br />
			</>
		);
	}
}
