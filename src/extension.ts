import * as vscode from 'vscode';
import * as fs from 'fs';
import * as diff from 'diff';

export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration('tws');

	const controller = new TWSController(config);

	context.subscriptions.push(controller);
}

class TWSController {
	private disposable: vscode.Disposable;
	private config: vscode.WorkspaceConfiguration;
	private decorationtype: vscode.TextEditorDecorationType;
	private outputChannel: vscode.OutputChannel;
	private original: string | null;
	private currentLines: Set<number>;

	constructor(config: vscode.WorkspaceConfiguration) {
		this.config = config;
		this.original = null;
		this.currentLines = new Set<number>();

		this.outputChannel = vscode.window.createOutputChannel("TWS");
		if (config.debugLog) {
			this.outputChannel.show(true);
		} else {
			this.outputChannel.hide();
		}

		this.decorationtype = this.createDecorationType();

		if (vscode.window.activeTextEditor && !vscode.window.activeTextEditor.document.isUntitled) {
			this.outputChannel.appendLine("Loading document disk version.");
			this.original = fs.readFileSync(vscode.window.activeTextEditor.document.fileName).toString();
		} else if (vscode.window.activeTextEditor) {
			this.outputChannel.appendLine("Document is Untitled, no original on disk yet.");
			this.original = null;
		}

		// Track initial cursor position if there's an active editor
		if (vscode.window.activeTextEditor) {
			this.updateCurrentLines(vscode.window.activeTextEditor);
		}

		const subscriptions: vscode.Disposable[] = [];

		vscode.commands.registerCommand('tws.trimWhiteSpace', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				console.log(this);
				const ranges = this.findTrimRanges(editor.document);
				ranges.map((r) => {editor.edit((e) => e.delete(r) );});
			}
		});

		vscode.workspace.onWillSaveTextDocument(this.onWillSaveDocument, this, subscriptions);

		vscode.workspace.onDidSaveTextDocument((event) => {
			this.outputChannel.appendLine("Document saved, setting original to content text.");
			this.original = event.getText();
		}, this, subscriptions);

		vscode.workspace.onDidChangeConfiguration(this.onConfigChanged, this, subscriptions);

		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!vscode.window.activeTextEditor) {
				return;
			}
			if (event.document === vscode.window.activeTextEditor.document) {
				this.decorateTrailingWhiteSpace(vscode.window.activeTextEditor);
			}
		}, this, subscriptions);

		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (!editor) {
				return;
			}
			this.outputChannel.appendLine("TextEditor changed, loading original file from disk.");
			this.original = fs.readFileSync(editor.document.fileName).toString();
			this.updateCurrentLines(editor);
			this.decorateTrailingWhiteSpace(editor);
		}, this, subscriptions);

		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (!event.textEditor) {
				return;
			}
			this.updateCurrentLines(event.textEditor);
			this.decorateTrailingWhiteSpace(event.textEditor);
		}, this, subscriptions);

		this.disposable = vscode.Disposable.from(...subscriptions);
	}

	dispose() {
		this.disposable.dispose();
	}

	onWillSaveDocument(e: vscode.TextDocumentWillSaveEvent) {
		if (this.config.get('trimOnSave') === true) {
			const ranges = this.findTrimRanges(e.document);
			e.waitUntil(Promise.resolve(ranges.map((r) => {return vscode.TextEdit.delete(r);})));
		}
	}

	onConfigChanged() {
		const oldConfig = this.config;
		this.config = vscode.workspace.getConfiguration('tws');

		// Recreate decoration type if color changed
		const oldColor = oldConfig.get('highlightColor');
		const newColor = this.config.get('highlightColor');
		if (oldColor !== newColor) {
			this.decorationtype.dispose();
			this.decorationtype = this.createDecorationType();

			// Re-apply decorations with new color if an editor is active
			if (vscode.window.activeTextEditor) {
				this.decorateTrailingWhiteSpace(vscode.window.activeTextEditor);
			}
		}

		if (this.config.debugLog) {
			this.outputChannel.show(true);
		} else {
			this.outputChannel.hide();
		}
	}

	private updateCurrentLines(editor: vscode.TextEditor) {
		this.currentLines.clear();
		for (const selection of editor.selections) {
			for (let line = selection.start.line; line <= selection.end.line; line++) {
				this.currentLines.add(line);
			}
		}
	}

	private createDecorationType(): vscode.TextEditorDecorationType {
		const color = this.config.get<string>('highlightColor') || 'rgba(230, 0, 0, 0.2)';
		return vscode.window.createTextEditorDecorationType({
			backgroundColor: color
		});
	}

	decorateTrailingWhiteSpace(editor: vscode.TextEditor) {
		if (this.config.get('highlightTrailingWhiteSpace') === true) {
			var ranges: vscode.Range[] = [];
			if (this.config.get('highlightOnlyChangedLines') === true) {
				ranges = this.findTrimRanges(editor.document);
			} else {
				ranges = this.findAllRanges(editor.document);
			}

			// Filter out current line(s) if highlightCurrentLine is false
			if (this.config.get('highlightCurrentLine') !== true) {
				ranges = ranges.filter((range) => {
					return !this.currentLines.has(range.start.line);
				});
			}

			const decorationOptions: vscode.DecorationOptions[] = [];
			ranges.map((r) => {
				const decoration = { range: r };
				decorationOptions.push(decoration);
			});
			editor.setDecorations(this.decorationtype, decorationOptions);
		}
	}

	findAllRanges(document: vscode.TextDocument) {
		const regEx = /\s+$/g;
		var ranges: vscode.Range[] = [];
		for (let i = 0; i < document.lineCount; i++) {
			// match each line
			var line = document.lineAt(i).text;
			let match;
			while (match = regEx.exec(line)) {
				let startPos = new vscode.Position(i, match.index);
				let endPos = new vscode.Position(i, match.index + match[0].length);
				this.outputChannel.appendLine(`Whitespace found: [${startPos.line}, ${startPos.character}] - [${endPos.line}, ${endPos.character}]`);
				ranges.push(new vscode.Range(startPos, endPos));
			}
		}
		return(ranges);
	}

	findTrimRanges(document: vscode.TextDocument) {
		const regEx = /\s+$/g;
		var ranges: vscode.Range[] = [];
		if (document.isDirty && this.original) {
			var currentLine = 0;
			diff.diffLines(this.original.toString(), document.getText()).map((value) => {
				if (value.added === undefined && value.removed === undefined) {
					// Unedited line or lines (count tells the lines in diff change)
					currentLine += value.count || 0;
				} else if (value.removed === undefined) {
					// Added, ie. diff change for something user has done.
					// Create ranges for all lines in case of trailing whitespace.
					var i = 0;
					for (i = 0; i < (value.count || 0); i++) {
						this.outputChannel.appendLine(`Found changed line: ${currentLine}`);
						var line = document.lineAt(currentLine).text;
						let match;
						while (match = regEx.exec(line)) {
							let startPos = new vscode.Position(currentLine, match.index);
							let endPos = new vscode.Position(currentLine, match.index + match[0].length);
							this.outputChannel.appendLine(`Whitespace found: [${startPos.line}, ${startPos.character}] - [${endPos.line}, ${endPos.character}]`);
							ranges.push(new vscode.Range(startPos, endPos));
						}
						currentLine++;
					}
				}
			});
		} else {
			this.outputChannel.appendLine('Document has no unsaved changes.');
		}
		return(ranges);
	}
}

export function deactivate() {}
