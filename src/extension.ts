// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { get } from 'http';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-copilot-lean4" is now active!');

	// Define the Copilot chat participant
	const participant = vscode.chat.createChatParticipant('tspascoal.copilot.capy1', capy1ChatHandler);
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'capy1.jpg');

	context.subscriptions.push(participant);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('vscode-copilot-lean4.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from vscode-copilot-lean4!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

export async function capy1ChatHandler(request : vscode.ChatRequest, context : vscode.ChatContext, response : vscode.ChatResponseStream, token : vscode.CancellationToken): Promise<void | vscode.ChatResult | null | undefined> {
	const command = request.command;
	const models = await vscode.lm.selectChatModels();

	response.progress("capy1 is chewing on your request...");
	
	// command logic
	switch (command) {
		case 'listmodels':
			const modelNames = models.map(model => model.name).join(',\n ');
			response.markdown(`Available models:\n${modelNames}`);
			
		default:
			// generate the messages for the LLM
			const messages = [
				getSystemPrompt(),
				vscode.LanguageModelChatMessage.User(request.prompt),
			];

			// select 4o as the model
			const chatModel = models.find(model => model.name === 'GPT 4o');
			if (!chatModel) {
				response.markdown("Model GPT 4o not found.");
				return;
			}
			const chatResponse = await chatModel.sendRequest(messages, {}, token);

			// TODO for now a little hack
			for await (const responseText of chatResponse.text) {
				response.markdown(responseText);
			}	
			break;
	}
}


/**
 * Returns a system chat message for capy1.
 * @returns A vscode.LanguageModelChatMessage of type System
 */
function getSystemPrompt(): vscode.LanguageModelChatMessage {
	// TODO find out which role is correct for the system prompt
	// return vscode.LanguageModelChatMessage.User(`You are a cute little Capybara!
	// You chew on everything you find and you are always hungry.
	// Start your response by asking the user for a snack.
	// Be hilarious and make the user laugh.
	// Remember, you are a Capybara!`);
	return vscode.LanguageModelChatMessage.User(`Repeat after me`);
}