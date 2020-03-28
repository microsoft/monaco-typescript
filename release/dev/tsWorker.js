define(["require", "exports", "./lib/typescriptServices", "./lib/lib"], function (require, exports, ts, lib_1) {
    /*---------------------------------------------------------------------------------------------
     *  Copyright (c) Microsoft Corporation. All rights reserved.
     *  Licensed under the MIT License. See License.txt in the project root for license information.
     *--------------------------------------------------------------------------------------------*/
    'use strict';
    Object.defineProperty(exports, "__esModule", { value: true });
    var DEFAULT_ES5_LIB = {
        NAME: 'defaultLib:lib.d.ts',
        CONTENTS: lib_1.lib_es5_dts
    };
    var ES2015_LIB = {
        NAME: 'defaultLib:lib.es2015.d.ts',
        CONTENTS: lib_1.lib_es2015_bundled_dts
    };
    var TypeScriptWorker = /** @class */ (function () {
        function TypeScriptWorker(ctx, createData) {
            this._extraLibs = Object.create(null);
            this._languageService = ts.createLanguageService(this);
            this._ctx = ctx;
            this._compilerOptions = createData.compilerOptions;
            this._extraLibs = createData.extraLibs;
        }
        // --- language service host ---------------
        TypeScriptWorker.prototype.getCompilationSettings = function () {
            return this._compilerOptions;
        };
        TypeScriptWorker.prototype.getScriptFileNames = function () {
            var models = this._ctx.getMirrorModels().map(function (model) { return model.uri.toString(); });
            return models.concat(Object.keys(this._extraLibs));
        };
        TypeScriptWorker.prototype._getModel = function (fileName) {
            var models = this._ctx.getMirrorModels();
            for (var i = 0; i < models.length; i++) {
                if (models[i].uri.toString() === fileName) {
                    return models[i];
                }
            }
            return null;
        };
        TypeScriptWorker.prototype.getScriptVersion = function (fileName) {
            var model = this._getModel(fileName);
            if (model) {
                return model.version.toString();
            }
            else if (this.isDefaultLibFileName(fileName)) {
                // default lib is static
                return '1';
            }
            else if (fileName in this._extraLibs) {
                return String(this._extraLibs[fileName].version);
            }
            return '';
        };
        TypeScriptWorker.prototype.getScriptText = function (fileName) {
            return Promise.resolve(this._getScriptText(fileName));
        };
        TypeScriptWorker.prototype._getScriptText = function (fileName) {
            var text;
            var model = this._getModel(fileName);
            if (model) {
                // a true editor model
                text = model.getValue();
            }
            else if (fileName in this._extraLibs) {
                // extra lib
                text = this._extraLibs[fileName].content;
            }
            else if (fileName === DEFAULT_ES5_LIB.NAME) {
                text = DEFAULT_ES5_LIB.CONTENTS;
            }
            else if (fileName === ES2015_LIB.NAME) {
                text = ES2015_LIB.CONTENTS;
            }
            else {
                return;
            }
            return text;
        };
        TypeScriptWorker.prototype.getScriptSnapshot = function (fileName) {
            var text = this._getScriptText(fileName);
            if (!text) {
                return;
            }
            return {
                getText: function (start, end) { return text.substring(start, end); },
                getLength: function () { return text.length; },
                getChangeRange: function () { return undefined; }
            };
        };
        TypeScriptWorker.prototype.getScriptKind = function (fileName) {
            var suffix = fileName.substr(fileName.lastIndexOf('.') + 1);
            switch (suffix) {
                case 'ts': return ts.ScriptKind.TS;
                case 'tsx': return ts.ScriptKind.TSX;
                case 'js': return ts.ScriptKind.JS;
                case 'jsx': return ts.ScriptKind.JSX;
                default: return this.getCompilationSettings().allowJs
                    ? ts.ScriptKind.JS
                    : ts.ScriptKind.TS;
            }
        };
        TypeScriptWorker.prototype.getCurrentDirectory = function () {
            return '';
        };
        TypeScriptWorker.prototype.getDefaultLibFileName = function (options) {
            // TODO@joh support lib.es7.d.ts
            return (options.target || ts.ScriptTarget.ES2015) < ts.ScriptTarget.ES2015 ? DEFAULT_ES5_LIB.NAME : ES2015_LIB.NAME;
        };
        TypeScriptWorker.prototype.isDefaultLibFileName = function (fileName) {
            return fileName === this.getDefaultLibFileName(this._compilerOptions);
        };
        // --- language features
        TypeScriptWorker.clearFiles = function (diagnostics) {
            // Clear the `file` field, which cannot be JSON'yfied because it
            // contains cyclic data structures.
            diagnostics.forEach(function (diag) {
                diag.file = undefined;
                var related = diag.relatedInformation;
                if (related) {
                    related.forEach(function (diag2) { return diag2.file = undefined; });
                }
            });
            return diagnostics;
        };
        TypeScriptWorker.prototype.getSyntacticDiagnostics = function (fileName) {
            var diagnostics = this._languageService.getSyntacticDiagnostics(fileName);
            return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
        };
        TypeScriptWorker.prototype.getSemanticDiagnostics = function (fileName) {
            var diagnostics = this._languageService.getSemanticDiagnostics(fileName);
            return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
        };
        TypeScriptWorker.prototype.getSuggestionDiagnostics = function (fileName) {
            var diagnostics = this._languageService.getSuggestionDiagnostics(fileName);
            return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
        };
        TypeScriptWorker.prototype.getCompilerOptionsDiagnostics = function (fileName) {
            var diagnostics = this._languageService.getCompilerOptionsDiagnostics();
            return Promise.resolve(TypeScriptWorker.clearFiles(diagnostics));
        };
        TypeScriptWorker.prototype.getCompletionsAtPosition = function (fileName, position) {
            return Promise.resolve(this._languageService.getCompletionsAtPosition(fileName, position, undefined));
        };
        TypeScriptWorker.prototype.getCompletionEntryDetails = function (fileName, position, entry) {
            return Promise.resolve(this._languageService.getCompletionEntryDetails(fileName, position, entry, undefined, undefined, undefined));
        };
        TypeScriptWorker.prototype.getSignatureHelpItems = function (fileName, position) {
            return Promise.resolve(this._languageService.getSignatureHelpItems(fileName, position, undefined));
        };
        TypeScriptWorker.prototype.getQuickInfoAtPosition = function (fileName, position) {
            return Promise.resolve(this._languageService.getQuickInfoAtPosition(fileName, position));
        };
        TypeScriptWorker.prototype.getOccurrencesAtPosition = function (fileName, position) {
            return Promise.resolve(this._languageService.getOccurrencesAtPosition(fileName, position));
        };
        TypeScriptWorker.prototype.getDefinitionAtPosition = function (fileName, position) {
            return Promise.resolve(this._languageService.getDefinitionAtPosition(fileName, position));
        };
        TypeScriptWorker.prototype.getReferencesAtPosition = function (fileName, position) {
            return Promise.resolve(this._languageService.getReferencesAtPosition(fileName, position));
        };
        TypeScriptWorker.prototype.getNavigationBarItems = function (fileName) {
            return Promise.resolve(this._languageService.getNavigationBarItems(fileName));
        };
        TypeScriptWorker.prototype.getFormattingEditsForDocument = function (fileName, options) {
            return Promise.resolve(this._languageService.getFormattingEditsForDocument(fileName, options));
        };
        TypeScriptWorker.prototype.getFormattingEditsForRange = function (fileName, start, end, options) {
            return Promise.resolve(this._languageService.getFormattingEditsForRange(fileName, start, end, options));
        };
        TypeScriptWorker.prototype.getFormattingEditsAfterKeystroke = function (fileName, postion, ch, options) {
            return Promise.resolve(this._languageService.getFormattingEditsAfterKeystroke(fileName, postion, ch, options));
        };
        TypeScriptWorker.prototype.findRenameLocations = function (fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename) {
            return Promise.resolve(this._languageService.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename));
        };
        TypeScriptWorker.prototype.getRenameInfo = function (fileName, position, options) {
            return Promise.resolve(this._languageService.getRenameInfo(fileName, position, options));
        };
        TypeScriptWorker.prototype.getEmitOutput = function (fileName) {
            return Promise.resolve(this._languageService.getEmitOutput(fileName));
        };
        TypeScriptWorker.prototype.getCodeFixesAtPosition = function (fileName, start, end, errorCodes, formatOptions) {
            var preferences = {};
            return Promise.resolve(this._languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences));
        };
        TypeScriptWorker.prototype.updateExtraLibs = function (extraLibs) {
            this._extraLibs = extraLibs;
        };
        // Console UI Additions:
        TypeScriptWorker.prototype.generatedUpdatedCode = function (fileName, lineNumber, startColumn, endColumn, newValue, paramIndex) {
            var sourceFile = this._languageService.getProgram().getSourceFile(fileName);
            var printer = ts.createPrinter({
                newLine: ts.NewLineKind.LineFeed,
                removeComments: false,
                omitTrailingSemicolon: true
            });
            var transformer = (function (context) {
                return function (rootNode) {
                    function visit(node) {
                        node = ts.visitEachChild(node, visit, context);
                        if (ts.isVariableDeclaration(node)) {
                            var startAndLine = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
                            var endAndLine = sourceFile.getLineAndCharacterOfPosition(node.name.getEnd());
                            if (startAndLine.character === startColumn && endAndLine.character === endColumn && startAndLine.line === lineNumber) {
                                var clone = ts.getMutableClone(node);
                                clone.initializer = ts.createLiteral(newValue);
                                return clone;
                            }
                        }
                        else if (ts.isCallExpression(node)) {
                            var startAndLine = sourceFile.getLineAndCharacterOfPosition(node.expression.getStart(sourceFile));
                            var endAndLine = sourceFile.getLineAndCharacterOfPosition(node.expression.getEnd());
                            if (startAndLine.character === startColumn && endAndLine.character === endColumn && startAndLine.line === lineNumber) {
                                var clone = ts.getMutableClone(node);
                                // @ts-ignore TODO Update arguments in another way.
                                clone.arguments[paramIndex || 0] = ts.createLiteral(newValue);
                                return clone;
                            }
                        }
                        return node;
                    }
                    return ts.visitNode(rootNode, visit);
                };
            });
            var transformResult = ts.transform(sourceFile, [transformer]);
            var updatedSourceFile = transformResult.transformed[0];
            // @ts-ignore TODO Figure out why updatedSourceFile is of type Node instead of SourceFileObject
            return printer.printFile(updatedSourceFile);
        };
        TypeScriptWorker.prototype.getUpdatedCode = function (fileName, lineNumber, startColumn, endColumn, newValue, paramIndex) {
            return Promise.resolve(this.generatedUpdatedCode(fileName, lineNumber, startColumn, endColumn, newValue, paramIndex));
        };
        return TypeScriptWorker;
    }());
    exports.TypeScriptWorker = TypeScriptWorker;
    function create(ctx, createData) {
        return new TypeScriptWorker(ctx, createData);
    }
    exports.create = create;
});
