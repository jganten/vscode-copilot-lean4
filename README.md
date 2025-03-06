# vscode-copilot-lean4 README

This extension provides the backbone for Copilot extensions for Lean 4 and Mathlib4.

## Features

*   **Chat Interface:** Provides a chat participant that interacts with Language Models to assist with Lean 4 code.
*   **Command Registration:** Registers commands to list available models and tools.
*   **Tool Integration:** Supports integration of external tools (like Loogle) to enhance the capabilities of the assistant.
*   **Configurable System Prompt:** Allows customization of the system prompt to tailor the assistant's behavior.
*   **Follow-up Suggestions:** Generates follow-up prompts to guide the user in further interactions.

## Registered Commands

*   `lean4.copilot.listModels`: Lists the available Language Models.
*   `lean4.copilot.testCommand`: A test command (currently outputs a "Hello World" message).

## Registered Tools

Currently, no tools are registered directly within this extension. However, it is designed to integrate with external tools through the Language Model Tooling API.

## Main Logic

The extension's main logic revolves around handling chat requests and responses using Language Models. It involves:

1.  **Receiving Chat Requests:** The `lean4CopilotChatHandler` function processes incoming chat requests.
2.  **Model Selection:** Selects an appropriate Language Model for the request.
3.  **Prompt Rendering:** Renders the prompt using `renderPrompt` from `@vscode/prompt-tsx`.
4.  **Tool Invocation:** If the Language Model requests tool calls, the extension invokes the specified tools and includes the results in subsequent requests.
5.  **Streaming Responses:** Streams the Language Model's response back to the user.
6.  **Generating Follow-ups:** Provides follow-up suggestions based on the result of the chat request.

## Implemented Features

*   Basic chat participant registration and handling.
*   Listing available Language Models.
*   Configurable system prompt and follow-up prompts.
*   Tool call handling.

## Missing Features

*   More sophisticated tool integration and management.
*   Improved error handling and user feedback.
*   More comprehensive testing and documentation.
*   Integration with Lean 4 specific tools and APIs.

## Requirements

*   VS Code version \^1.97.0
*   `github.copilot` extension
*   `github.copilot-chat` extension

## Extension Settings

This extension contributes the following settings:

*   `lean4.copilot.enabled`: Enable/disable the automatic use of tools.
*   `lean4.copilot.systemPrompt`: The system prompt for the chat model.
*   `lean4.copilot.followUps`: A list of standard follow-up prompts.

## Known Issues

*   No known issues at this time.

## Release Notes

### 0.0.1

Initial release of the vscode-copilot-lean4 extension.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

*   [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

*   Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
*   Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
*   Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

*   [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
*   [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
