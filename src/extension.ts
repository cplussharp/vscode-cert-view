import * as vscode from 'vscode';
import { tokenLegend, tokenProvider } from './provider/pemDocumentSemanticTokensProvider';
import { symbolProvider } from './provider/pemDocumentSymbolProvider';
import { foldingProvider } from './provider/pemFoldingRangeProvider';

// this method is called when the extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.debug('Cert-View extension activated');

	const pemCertPreviewCmd = vscode.commands.registerCommand('cert-view.pemCertPreview', (...args) => {
		console.debug('execute pemCertPreview command', args);
		vscode.window.showInformationMessage('Hello World from PEM Cert Preview!');
	});
	context.subscriptions.push(pemCertPreviewCmd);

	const pemAsn1PreviewCmd = vscode.commands.registerCommand('cert-view.pemAsn1Preview', (...args) => {
		console.debug('execute pemAsn1Preview command', args);
		vscode.window.showInformationMessage('Hello World from PEM ASN.1 Preview!');
	});
	context.subscriptions.push(pemAsn1PreviewCmd);

	// language extensions
	const selector = { language: 'pem', scheme: '*' };
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(selector, tokenProvider, tokenLegend));
	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider));
	context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(selector, foldingProvider));
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.debug('Cert-View extension deactivated');
}
