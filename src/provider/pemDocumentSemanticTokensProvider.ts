import * as vscode from 'vscode';

const tokenTypes = ['comment', 'operator', 'keyword', 'type', 'string'];
export const tokenLegend = new vscode.SemanticTokensLegend(tokenTypes);

export const tokenProvider: vscode.DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SemanticTokens> {
        console.debug('provideDocumentSemanticTokens start');

        const tokensBuilder = new vscode.SemanticTokensBuilder(tokenLegend);

        // analyze the document and return semantic tokens
        const regexp: RegExp = /^(-----)(BEGIN|END) ([A-Z ]+)(-----)$/;
        let isContent = false;
        for (let i = 0; i<document.lineCount; i++) {
            if (token.isCancellationRequested) {
                console.debug('provideDocumentSemanticTokens cancelled');
                return null;
            }

            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }

            const match = regexp.exec(line.text);

            // content between begin and end
            // or comments between end and begin
            if (!match) {
                tokensBuilder.push(line.range, isContent ? 'string' : 'comment');
                continue;
            }

            // -----
            let start = line.range.start;
            let end = new vscode.Position(start.line, start.character + match[1].length);
            tokensBuilder.push(new vscode.Range(start, end), 'operator');

            // BEGIN or END
            start = end;
            end = new vscode.Position(start.line, start.character + match[2].length);
            tokensBuilder.push(new vscode.Range(start, end), 'keyword');

            // the type (e.g. CERTIFICATE)
            start = new vscode.Position(end.line, end.character + 1);
            end = new vscode.Position(start.line, start.character + match[3].length);
            tokensBuilder.push(new vscode.Range(start, end), 'type');

            // -----
            start = end;
            end = new vscode.Position(start.line, start.character + match[4].length);
            tokensBuilder.push(new vscode.Range(start, end), 'operator');

            // is everything after this content or comment
            isContent = match[2] === 'BEGIN';
        }

        console.debug('provideDocumentSemanticTokens returns');
        return tokensBuilder.build();
    }
};
