import * as vscode from 'vscode';
import { Logger } from '../utils/logging';

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
