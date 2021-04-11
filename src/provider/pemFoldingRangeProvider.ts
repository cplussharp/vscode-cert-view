import * as vscode from 'vscode';

export const foldingProvider: vscode.FoldingRangeProvider = {
    provideFoldingRanges(document: vscode.TextDocument, _: vscode.FoldingContext, token: vscode.CancellationToken) {
        console.debug('provideFoldingRanges start');

        let result: vscode.ProviderResult<vscode.FoldingRange[]> = [];

        // analyze the document and return folding ranges
        const regexp: RegExp = /^(-----)(BEGIN|END) ([A-Z ]+)(-----)$/;
        let startLine = 0;
        for (let i = 0; i<document.lineCount; i++) {
            if (token.isCancellationRequested) {
                console.debug('provideFoldingRanges cancelled');
                return null;
            }

            const line = document.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }

            const match = regexp.exec(line.text);
            if (!match) {
                continue;
            }

            const isBegin = match[2] === 'BEGIN';
            if (isBegin) {
                // close previous range as comment
                if (startLine < line.range.start.line) {
                    result.push(new vscode.FoldingRange(startLine, line.range.start.line - 1, vscode.FoldingRangeKind.Comment));
                }

                // remember start of range
                startLine = line.range.start.line;
            } else {
                // close previous range as region
                if (startLine < line.range.start.line) {
                    result.push(new vscode.FoldingRange(startLine, line.range.start.line, vscode.FoldingRangeKind.Region));
                }

                // remember start of next range
                startLine = line.range.start.line + 1;
            }
        }

        console.debug('provideFoldingRanges returns', result);
        return result;
    }
};
