// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerChatParticipant } from './chat/participant';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-copilot-lean4" is now active!');
    
    // Register chat participant
    registerChatParticipant(context);

    // Register hello world command
    const disposable = vscode.commands.registerCommand('vscode-copilot-lean4.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from vscode-copilot-lean4!');
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
