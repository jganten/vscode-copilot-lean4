import * as vscode from 'vscode';
import { capy1ChatHandler } from './handler';
import { generateFollowups } from './followups';
import { handleFeedback } from './feedbackhandler';
import { Logger } from '../utils/logging';

export function registerChatParticipant(context: vscode.ExtensionContext) {
    Logger.info('Registering chat participant');
    
    const participant = vscode.chat.createChatParticipant('tspascoal.copilot.capy1', capy1ChatHandler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'capy1.jpg');
    
    // Add followup provider
    participant.followupProvider = {
        provideFollowups: generateFollowups
    };

    // Register feedback handler
    participant.onDidReceiveFeedback(handleFeedback);
    
    context.subscriptions.push(participant);
    return participant;
}
