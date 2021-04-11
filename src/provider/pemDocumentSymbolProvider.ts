import Certificate from 'pkijs/src/Certificate'
import RelativeDistinguishedNames from 'pkijs/src/RelativeDistinguishedNames'
import * as Asn1js from 'asn1js';
import * as vscode from 'vscode';

export const symbolProvider: vscode.DocumentSymbolProvider = {
    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken) {
        console.debug('provideDocumentSymbols start');

        let result: vscode.ProviderResult<vscode.DocumentSymbol[]> = [];

        // analyze the document and return symbols
        const regexp: RegExp = /^(-----)(BEGIN|END) ([A-Z ]+)(-----)$/;
        let startLine: vscode.Range|undefined;
        for (let i = 0; i<document.lineCount; i++) {
            if (token.isCancellationRequested) {
                console.debug('provideDocumentSymbols cancelled');
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
                // remember start of range
                startLine = line.range;
            } else {
                // create symbol
                if (startLine) {
                    const range = new vscode.Range(startLine.start, line.range.end);
                    const obj = new vscode.DocumentSymbol(match[3], '', vscode.SymbolKind.Object, range, startLine);

                    // decode certificate
                    if (obj.name === 'CERTIFICATE' || obj.name === 'TRUSTED CERTIFICATE') {
                        const pem = document.getText(range);
                        const b64 = pem.replace(/(-----(BEGIN|END) ([A-Z ]+)-----|[\n\r])/g, '');
                        const der = Buffer.from(b64, 'base64');
                        const ber = new Uint8Array(der).buffer;
                        const asn1 = Asn1js.fromBER(ber);
                        const cert = new Certificate({ schema: asn1.result });

                        const createSymbolForRdnPart = (type:Asn1js.ObjectIdentifier, value:Asn1js.PrintableString, range:vscode.Range) => {
                            let typeName = type.toString();

                            // translate allowed OID's https://tools.ietf.org/rfc/rfc5280#section-4.1.2.4
                            // https://ldap.com/ldap-oid-reference-guide/
                            const rdnTranslation:Record<string, string> = {
                                // common
                                '2.5.4.6': 'C', // countryName
                                '2.5.4.10': 'O', // organizationName
                                '2.5.4.11': 'OU', // organizationalUnitName
                                '2.5.4.46': 'dnQualifier',
                                '2.5.4.8': 'ST', // stateOrProvinceName
                                '2.5.4.3': 'CN', // commonName
                                '2.5.4.5': 'serialNumber',

                                // additional
                                '2.5.4.7': 'L', // locality
                                '2.5.4.12': 'title',
                                '2.5.4.4': 'SN', // surName
                                '2.5.4.42': 'GN', // givenName
                                '2.5.4.43': 'initials',
                                '2.5.4.65': 'pseudonym',
                                '2.5.4.44': 'generationQualifier',

                                // deprecated or uncommomen
                                '1.2.840.113549.1.9.1': 'E', // emailAddress (deprecated) (IA5String)
                                '0.9.2342.19200300.100.1.1': 'UID', // userID
                                '0.9.2342.19200300.100.1.25': 'DC' // domainComponent (IA5String)
                            };
                            if (typeName in rdnTranslation) {
                                typeName = rdnTranslation[typeName];
                            }

                            return new vscode.DocumentSymbol(typeName, value.valueBlock.value, vscode.SymbolKind.Field, range, range);
                        };

                        const createSymbolForRdn = (name: string, rdn: RelativeDistinguishedNames, range:vscode.Range) => {
                            const property = new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Property, range, range);
                            let i=0;
                            for (const rdnPart of rdn.typesAndValues) {
                                // change the start character of the range, so the order of the parts remains in the outline
                                const partRange = new vscode.Range(Math.min(range.start.line + i++, range.end.line), 0, range.end.line, range.end.character);
                                const fild = createSymbolForRdnPart(rdnPart.type, rdnPart.value, partRange);
                                property.children.push(fild);
                                if (fild.name === 'CN') {
                                    property.detail = fild.detail;
                                }
                            }
                            return property;
                        }

                        const subject = createSymbolForRdn('Subject', cert.subject, new vscode.Range(Math.min(range.start.line + 1, range.end.line), 0, range.end.line, range.end.character));
                        if (subject.detail.length > 0) {
                            obj.detail = subject.detail;
                        }
                        obj.children.push(subject);
                        obj.children.push(createSymbolForRdn('Issuer', cert.issuer, new vscode.Range(Math.min(range.start.line + 2, range.end.line), 0, range.end.line, range.end.character)));

                        const validityRange = new vscode.Range(Math.min(range.start.line + 3, range.end.line), 0, range.end.line, range.end.character);
                        const validity = new vscode.DocumentSymbol("Validity", '', vscode.SymbolKind.Property, validityRange, validityRange);
                        validity.children.push(new vscode.DocumentSymbol("Not Before", cert.notBefore.value.toUTCString(), vscode.SymbolKind.Field, validityRange, validityRange));
                        const notAfterRange = new vscode.Range(Math.min(validityRange.start.line + 1, validityRange.end.line), 0, validityRange.end.line, validityRange.end.character);
                        validity.children.push(new vscode.DocumentSymbol("Not After", cert.notAfter.value.toUTCString(), vscode.SymbolKind.Field, notAfterRange, notAfterRange));
                        obj.children.push(validity);

                        const pubkeyRange = new vscode.Range(Math.min(range.start.line + 4, range.end.line), 0, range.end.line, range.end.character);
                        const pubkey = new vscode.DocumentSymbol("Public Key", '', vscode.SymbolKind.Property, pubkeyRange, pubkeyRange);
                        let pubkeyAlgName = cert.subjectPublicKeyInfo.algorithm.algorithmId;
                        const algTranslation:Record<string, string> = {
                            '1.2.840.113549.1.1.1': 'RSA', // rsaEncryption
                            '1.2.840.10040.4.1': 'DSA', // id-dsa
                            '1.2.840.10045': 'ECDSA' // ansi-X9-62
                        };
                        if (pubkeyAlgName in algTranslation) {
                            pubkeyAlgName = algTranslation[pubkeyAlgName];
                        }
                        pubkey.children.push(new vscode.DocumentSymbol("Algorithm", pubkeyAlgName, vscode.SymbolKind.Field, pubkeyRange, pubkeyRange));
                        obj.children.push(pubkey);
                    }

                    result.push(obj);
                }
            }
        }

        console.debug('provideDocumentSymbols returns', result);
        return result;
    }
};
