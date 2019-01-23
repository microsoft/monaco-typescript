/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as ts from './lib/typescriptServices';
import { lib_dts, lib_es6_dts } from './lib/lib';

import Promise = monaco.Promise;
import IWorkerContext = monaco.worker.IWorkerContext;

const DEFAULT_LIB = {
	NAME: 'defaultLib:lib.d.ts',
	CONTENTS: lib_dts
};

const ES6_LIB = {
	NAME: 'defaultLib:lib.es6.d.ts',
	CONTENTS: lib_es6_dts
};

interface CodeOutlineToken {
	name: string;
	kind: CodeOutlineTokenKind;
	ordinal: number;
	line: number;
	indentAmount: number;
}

export enum CodeOutlineTokenKind {
	Class = 'Class',
	ObjectLiteral = 'ObjectLiteral',
	Method = 'Method',
	Constructor = 'Constructor',
	Function = 'Function',
	Get = 'Get',
	Set = 'Set'
}

export class TypeScriptWorker implements ts.LanguageServiceHost {

	// --- model sync -----------------------

	private _ctx: IWorkerContext;
	private _extraLibs: { [path: string]: { content: string, version: number } } = Object.create(null);
	private _languageService = ts.createLanguageService(this);
	private _compilerOptions: ts.CompilerOptions;

	constructor(ctx: IWorkerContext, createData: ICreateData) {
		this._ctx = ctx;
		this._compilerOptions = createData.compilerOptions;
		this._extraLibs = createData.extraLibs;
	}

	// --- language service host ---------------

	getCompilationSettings(): ts.CompilerOptions {
		return this._compilerOptions;
	}

	getScriptFileNames(): string[] {
		let models = this._ctx.getMirrorModels().map(model => model.uri.toString());
		return models.concat(Object.keys(this._extraLibs));
	}

	private _getModel(fileName: string): monaco.worker.IMirrorModel {
		let models = this._ctx.getMirrorModels();
		for (let i = 0; i < models.length; i++) {
			if (models[i].uri.toString() === fileName) {
				return models[i];
			}
		}
		return null;
	}

	getScriptVersion(fileName: string): string {
		let model = this._getModel(fileName);
		if (model) {
			return model.version.toString();
		} else if (this.isDefaultLibFileName(fileName)) {
			// default lib is static
			return '1';
		} else if(fileName in this._extraLibs) {
			return this._extraLibs[fileName].version.toString();
		}
	}

	getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
		let text: string;
		let model = this._getModel(fileName);
		if (model) {
			// a true editor model
			text = model.getValue();

		} else if (fileName in this._extraLibs) {
			// static extra lib
			text = this._extraLibs[fileName].content;

		} else if (fileName === DEFAULT_LIB.NAME) {
			text = DEFAULT_LIB.CONTENTS;
		} else if (fileName === ES6_LIB.NAME) {
			text = ES6_LIB.CONTENTS;
		} else {
			return;
		}

		return <ts.IScriptSnapshot>{
			getText: (start, end) => text.substring(start, end),
			getLength: () => text.length,
			getChangeRange: () => undefined
		};
	}

	getScriptKind?(fileName: string): ts.ScriptKind {
		const suffix = fileName.substr(fileName.lastIndexOf('.') + 1);
		switch (suffix) {
			case 'ts': return ts.ScriptKind.TS;
			case 'tsx': return ts.ScriptKind.TSX;
			case 'js': return ts.ScriptKind.JS;
			case 'jsx': return ts.ScriptKind.JSX;
			default: return this.getCompilationSettings().allowJs
				? ts.ScriptKind.JS
				: ts.ScriptKind.TS;
		}
	}

	getCurrentDirectory(): string {
		return '';
	}

	getDefaultLibFileName(options: ts.CompilerOptions): string {
		// TODO@joh support lib.es7.d.ts
		return options.target <= ts.ScriptTarget.ES5 ? DEFAULT_LIB.NAME : ES6_LIB.NAME;
	}

	isDefaultLibFileName(fileName: string): boolean {
		return fileName === this.getDefaultLibFileName(this._compilerOptions);
	}

	// --- language features

	private static clearFiles(diagnostics: ts.Diagnostic[]) {
		// Clear the `file` field, which cannot be JSON'yfied because it
		// contains cyclic data structures.
		diagnostics.forEach(diag => {
			diag.file = undefined;
			const related = <ts.Diagnostic[]>diag.relatedInformation;
			if (related) {
				related.forEach(diag2 => diag2.file = undefined);
			}
		});
	}

	getSyntacticDiagnostics(fileName: string): Promise<ts.Diagnostic[]> {
		const diagnostics = this._languageService.getSyntacticDiagnostics(fileName);
		TypeScriptWorker.clearFiles(diagnostics);
		return Promise.as(diagnostics);
	}

	getSemanticDiagnostics(fileName: string): Promise<ts.Diagnostic[]> {
		const diagnostics = this._languageService.getSemanticDiagnostics(fileName);
		TypeScriptWorker.clearFiles(diagnostics);
		return Promise.as(diagnostics);
	}

	getCompilerOptionsDiagnostics(fileName: string): Promise<ts.Diagnostic[]> {
		const diagnostics = this._languageService.getCompilerOptionsDiagnostics();
		TypeScriptWorker.clearFiles(diagnostics);
		return Promise.as(diagnostics);
	}

	getCompletionsAtPosition(fileName: string, position: number): Promise<ts.CompletionInfo> {
		return Promise.as(this._languageService.getCompletionsAtPosition(fileName, position, undefined));
	}

	getCompletionEntryDetails(fileName: string, position: number, entry: string): Promise<ts.CompletionEntryDetails> {
		return Promise.as(this._languageService.getCompletionEntryDetails(fileName, position, entry, undefined, undefined, undefined));
	}

	getSignatureHelpItems(fileName: string, position: number): Promise<ts.SignatureHelpItems> {
		return Promise.as(this._languageService.getSignatureHelpItems(fileName, position, undefined));
	}

	getQuickInfoAtPosition(fileName: string, position: number): Promise<ts.QuickInfo> {
		return Promise.as(this._languageService.getQuickInfoAtPosition(fileName, position));
	}

	getOccurrencesAtPosition(fileName: string, position: number): Promise<ts.ReferenceEntry[]> {
		return Promise.as(this._languageService.getOccurrencesAtPosition(fileName, position));
	}

	getDefinitionAtPosition(fileName: string, position: number): Promise<ts.DefinitionInfo[]> {
		return Promise.as(this._languageService.getDefinitionAtPosition(fileName, position));
	}

	getReferencesAtPosition(fileName: string, position: number): Promise<ts.ReferenceEntry[]> {
		return Promise.as(this._languageService.getReferencesAtPosition(fileName, position));
	}

	getNavigationBarItems(fileName: string): Promise<ts.NavigationBarItem[]> {
		return Promise.as(this._languageService.getNavigationBarItems(fileName));
	}

	getFormattingEditsForDocument(fileName: string, options: ts.FormatCodeOptions): Promise<ts.TextChange[]> {
		return Promise.as(this._languageService.getFormattingEditsForDocument(fileName, options));
	}

	getFormattingEditsForRange(fileName: string, start: number, end: number, options: ts.FormatCodeOptions): Promise<ts.TextChange[]> {
		return Promise.as(this._languageService.getFormattingEditsForRange(fileName, start, end, options));
	}

	getFormattingEditsAfterKeystroke(fileName: string, postion: number, ch: string, options: ts.FormatCodeOptions): Promise<ts.TextChange[]> {
		return Promise.as(this._languageService.getFormattingEditsAfterKeystroke(fileName, postion, ch, options));
	}

	getEmitOutput(fileName: string): Promise<ts.EmitOutput> {
		return Promise.as(this._languageService.getEmitOutput(fileName));
	}

	syncExtraLibs(extraLibs: { [path: string]: { content: string, version: number } }) {
		this._extraLibs = extraLibs;
	}

	getPropertiesOrAttributesOf(fileName: string, parentObjects: string[]) {
		let currentFile = this._languageService.getProgram().getSourceFile(fileName);
		let typeChecker = this._languageService.getProgram().getTypeChecker();
		let referencedEntities = {};
		parentObjects.forEach(function (key) { referencedEntities[key] = {}; });
		ts.forEachChild(currentFile, function visitNodes(node: ts.Node) {
			if (ts.isPropertyAccessExpression(node) && referencedEntities[node.expression.getText()]) {
				// Matches Things.test
				if (!(node.name.text in referencedEntities[node.expression.getText()])) {
					referencedEntities[node.expression.getText()][node.name.text] = true;
				}
			} else if (ts.isElementAccessExpression(node) && referencedEntities[node.expression.getText()] && node.argumentExpression) {
				if (node.argumentExpression.kind == ts.SyntaxKind.Identifier) {
					if (node.expression.getText() == "Users" && node.argumentExpression.getText() == "principal") {
						// a special case for Users[principal] => replace principal with "Administrator",
						// since all users have the same properties and functions
						referencedEntities["Users"]["System"] = true;
					}
				}
				if (node.argumentExpression.kind == ts.SyntaxKind.PropertyAccessExpression) {
					// matches Things[me.property]
					let type = typeChecker.getTypeAtLocation(node.argumentExpression);
					if(type["value"]) {
						referencedEntities[node.expression.getText()][type["value"]] = true;
					}
				} else if (ts.isStringLiteral(node.argumentExpression)) {
					// matches Things["test"]
					referencedEntities[node.expression.getText()][node.argumentExpression.getText().slice(1, -1)] = true;
				}
			}
			return ts.forEachChild(node, visitNodes);
		});

		return referencedEntities;
	}

	getOutline(fileName: string, parentObjects: string[]): CodeOutlineToken[] {
		let tokens: CodeOutlineToken[] = [];
		let currentFile = this._languageService.getProgram().getSourceFile(fileName);

		let ordinal = 0;
		let indentation = 0;

		function indents() {
			let indents = '';
			for (let i = 0; i < indentation; i++) {
				indents += '<span class="BMCHIndent">&nbsp;&nbsp;</span>';
			}
			return indents;
		}

		function extractLiteral(/** @type {ts.ObjectLiteralExpression} */ liternalNode) {
			let didExtractLiteral = false;

			// Object literals should only be extracted if they have at least a method or any getter/setter
			let methodCount = 0;
			liternalNode.properties.forEach(property => {
				switch (property.kind) {
					case ts.SyntaxKind.MethodDeclaration:
					case ts.SyntaxKind.MethodSignature:
					case ts.SyntaxKind.FunctionDeclaration:
					case ts.SyntaxKind.FunctionExpression:
						methodCount++;
						break;
					case ts.SyntaxKind.GetAccessor:
					case ts.SyntaxKind.SetAccessor:
						didExtractLiteral = true;
						break;
					case ts.SyntaxKind.PropertyAssignment:
						if (property.initializer &&
							(property.initializer.kind == ts.SyntaxKind.FunctionDeclaration || property.initializer.kind == ts.SyntaxKind.FunctionExpression)) {
								methodCount++;
						}
				}
			});

			if (methodCount > 0) {
				didExtractLiteral = true;
			}

			if (didExtractLiteral) {
				ordinal++;
				let parentNode = liternalNode.parent;

				// Compute the name for assignments, call expressions and others
				let name = '';
				if (parentNode.kind == ts.SyntaxKind.PropertyAssignment) {
					name = (parentNode.name && parentNode.name.escapedText) || '';
				}
				else if (parentNode.kind == ts.SyntaxKind.VariableDeclaration) {
					name = (parentNode.name && parentNode.name.escapedText) || '';
				}
				else if (parentNode.kind == ts.SyntaxKind.CallExpression) {
					name = (parentNode.expression && parentNode.expression.getFullText().trim()) || '';
					if (name) {
						let nameTokens = name.split('\n');
						name = nameTokens[nameTokens.length - 1];
						name = name + '()';
					}
				}
				else if (parentNode.kind == ts.SyntaxKind.BinaryExpression) {
					// Only handle these for assignments
					/** @type {ts.BinaryOperatorToken} */ let sign = parentNode.operatorToken;
					if (ts.tokenToString(sign.kind) == '=') {
						let left = parentNode.left;
						let nameTokens;
						switch (left.kind) {
							case ts.SyntaxKind.VariableDeclaration:
								name = (left.name && left.name.escapedText) || '';
								break;
							case ts.SyntaxKind.PropertyAccessExpression:
								name = left.getFullText().trim();
								nameTokens = name.split('\n');
								name = nameTokens[nameTokens.length - 1];
								break;
						}
					}
				}

				tokens.push({
					name: name || '{}',
					kind: CodeOutlineTokenKind.ObjectLiteral,
					ordinal: ordinal,
					line: currentFile.getLineAndCharacterOfPosition(liternalNode.getStart()).line,
					indentAmount: indentation
				});
			}

			return didExtractLiteral;
		}

		function extractClass(/** @type {ts.ClassDeclaration} */ classNode) {
			ordinal++;
			if (classNode.name) {
				tokens.push({
					name: classNode.name.escapedText,
					kind: CodeOutlineTokenKind.Class,
					ordinal: ordinal,
					line: currentFile.getLineAndCharacterOfPosition(classNode.getStart()).line,
					indentAmount: indentation
				});
			}
			else {
				tokens.push({
					name: '{}',
					kind: CodeOutlineTokenKind.Class,
					ordinal: ordinal,
					line: currentFile.getLineAndCharacterOfPosition(classNode.getStart()).line,
					indentAmount: indentation
				});
			}
		}

		function extractMethod(/** @type {ts.FunctionLikeDeclaration} */ methodNode) {
			ordinal++;
			let node = methodNode;
			let line = currentFile.getLineAndCharacterOfPosition(methodNode.getStart()).line;

			let parentNode = methodNode.parent;
			// isMethodKind is set to YES for function declarations whose parent is a property assignment
			let isMethodKind = false;

			// Compute the name for assignments
			let name = '';
			if (parentNode.kind == ts.SyntaxKind.PropertyAssignment) {
				name = (parentNode.name && parentNode.name.escapedText) || '';
				isMethodKind = true;
			}
			else if (parentNode.kind == ts.SyntaxKind.VariableDeclaration) {
				name = (parentNode.name && parentNode.name.escapedText) || '';
			}
			else if (parentNode.kind == ts.SyntaxKind.CallExpression) {
				name = (parentNode.expression && parentNode.expression.getFullText().trim()) || '';
				if (name) {
					let nameTokens = name.split('\n');
					name = nameTokens[nameTokens.length - 1].trim();
					name = name + '()';
				}
			}
			else if (parentNode.kind == ts.SyntaxKind.BinaryExpression) {
				// Only handle these for assignments
				/** @type {ts.BinaryOperatorToken} */ let sign = parentNode.operatorToken;
				if (ts.tokenToString(sign.kind) == '=') {
					let left = parentNode.left;
					let nameTokens;
					switch (left.kind) {
						case ts.SyntaxKind.VariableDeclaration:
							name = (left.name && left.name.escapedText) || '';
							break;
						case ts.SyntaxKind.PropertyAccessExpression:
							name = left.getFullText().trim();
							nameTokens = name.split('\n');
							name = nameTokens[nameTokens.length - 1].trim();
							break;
					}
				}
			}

			switch (methodNode.kind) {
				case ts.SyntaxKind.Constructor:
					tokens.push({
						name: 'constructor ()',
						kind: CodeOutlineTokenKind.Constructor,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				case ts.SyntaxKind.MethodDeclaration:
				case ts.SyntaxKind.MethodSignature:
					tokens.push({
						name: (node.name && node.name.escapedText) || '{}',
						kind: CodeOutlineTokenKind.Method,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				case ts.SyntaxKind.FunctionExpression:
				case ts.SyntaxKind.FunctionDeclaration:
					tokens.push({
						name: (node.name && node.name.escapedText) || name || '{}',
						kind: isMethodKind ? CodeOutlineTokenKind.Method : CodeOutlineTokenKind.Function,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				case ts.SyntaxKind.GetAccessor:
					tokens.push({
						name: (node.name && node.name.escapedText) || '()',
						kind: CodeOutlineTokenKind.Get,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				case ts.SyntaxKind.SetAccessor:
					tokens.push({
						name: (node.name && node.name.escapedText) || '()',
						kind: CodeOutlineTokenKind.Set,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				case ts.SyntaxKind.ArrowFunction:
					tokens.push({
						name: (node.name && node.name.escapedText) || name || '() => {}',
						kind: CodeOutlineTokenKind.Function,
						ordinal: ordinal,
						line: line,
						indentAmount: indentation
					})
					break;
				default:
					break;
			}
		}

		function buildOutline(node) {
			let didIndent = false;
			switch (node.kind) {
				case ts.SyntaxKind.ObjectLiteralExpression:
					if (extractLiteral(node)) {
						indentation += 1;
						didIndent = true;
					}
					break;
				case ts.SyntaxKind.ClassExpression:
				case ts.SyntaxKind.ClassDeclaration:
					extractClass(node);
					indentation += 1;
					didIndent = true;
					break;
				case ts.SyntaxKind.MethodDeclaration:
				case ts.SyntaxKind.MethodSignature:
				case ts.SyntaxKind.FunctionDeclaration:
				case ts.SyntaxKind.FunctionExpression:
				case ts.SyntaxKind.GetAccessor:
				case ts.SyntaxKind.SetAccessor:
				case ts.SyntaxKind.Constructor:
				case ts.SyntaxKind.ArrowFunction:
					extractMethod(node);
					indentation += 1;
					didIndent = true;
					break;
				default:
					break;
			}

			ts.forEachChild(node, buildOutline);
			if (didIndent) indentation -= 1;
		}

		buildOutline(currentFile);

		return tokens;
	}
}

export interface ICreateData {
	compilerOptions: ts.CompilerOptions;
	extraLibs: { [path: string]: { content: string, version: number } };
}

export function create(ctx: IWorkerContext, createData: ICreateData): TypeScriptWorker {
	return new TypeScriptWorker(ctx, createData);
}
