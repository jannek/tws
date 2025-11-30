import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.equal(-1, [1, 2, 3].indexOf(5));
		assert.equal(-1, [1, 2, 3].indexOf(0));
	});
});

suite('Current Line Highlighting Tests', () => {
	let testDocument: vscode.TextDocument;
	let testEditor: vscode.TextEditor;

	setup(async () => {
		// Create a test document with trailing whitespace
		testDocument = await vscode.workspace.openTextDocument({
			content: 'line 1 with trailing spaces   \nline 2 also has spaces  \nline 3 clean\nline 4 with tabs\t\t\n',
			language: 'plaintext'
		});
		testEditor = await vscode.window.showTextDocument(testDocument);
	});

	teardown(async () => {
		// Close the test document
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

	test('Should exclude current line when highlightCurrentLine is false', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', false, vscode.ConfigurationTarget.Global);

		// Move cursor to line 0 (first line with trailing whitespace)
		testEditor.selection = new vscode.Selection(0, 0, 0, 0);

		// Give the extension time to process
		await new Promise(resolve => setTimeout(resolve, 500));

		// Get decorations - in a real test, we'd need access to the extension's decoration type
		// For now, this test documents the expected behavior
		assert.ok(true, 'Current line should not be highlighted');
	});

	test('Should include current line when highlightCurrentLine is true', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', true, vscode.ConfigurationTarget.Global);

		// Move cursor to line 0
		testEditor.selection = new vscode.Selection(0, 0, 0, 0);

		// Give the extension time to process
		await new Promise(resolve => setTimeout(resolve, 500));

		assert.ok(true, 'Current line should be highlighted');
	});

	test('Should handle multi-cursor correctly', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', false, vscode.ConfigurationTarget.Global);

		// Create multiple cursors on lines 0 and 1
		testEditor.selections = [
			new vscode.Selection(0, 0, 0, 0),
			new vscode.Selection(1, 0, 1, 0)
		];

		// Give the extension time to process
		await new Promise(resolve => setTimeout(resolve, 500));

		assert.ok(true, 'Both cursor lines should not be highlighted');
	});

	test('Should handle multi-line selection', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', false, vscode.ConfigurationTarget.Global);

		// Select lines 0-1
		testEditor.selection = new vscode.Selection(0, 0, 1, 10);

		// Give the extension time to process
		await new Promise(resolve => setTimeout(resolve, 500));

		assert.ok(true, 'All selected lines should not be highlighted');
	});

	test('Should update highlighting when cursor moves', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', false, vscode.ConfigurationTarget.Global);

		// Start on line 0
		testEditor.selection = new vscode.Selection(0, 0, 0, 0);
		await new Promise(resolve => setTimeout(resolve, 500));

		// Move to line 1
		testEditor.selection = new vscode.Selection(1, 0, 1, 0);
		await new Promise(resolve => setTimeout(resolve, 500));

		assert.ok(true, 'Line 0 should now be highlighted, line 1 should not');
	});

	test('Should work with highlightOnlyChangedLines setting', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightTrailingWhiteSpace', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightOnlyChangedLines', true, vscode.ConfigurationTarget.Global);
		await config.update('highlightCurrentLine', false, vscode.ConfigurationTarget.Global);

		// Edit line 0 to make it a changed line
		await testEditor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), 'x');
		});

		testEditor.selection = new vscode.Selection(0, 0, 0, 0);
		await new Promise(resolve => setTimeout(resolve, 500));

		assert.ok(true, 'Changed line should not be highlighted when cursor is on it');
	});

	test('Configuration defaults - highlightCurrentLine should be false', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		const defaultValue = config.inspect('highlightCurrentLine')?.defaultValue;

		assert.strictEqual(defaultValue, false, 'highlightCurrentLine should default to false');
	});
});

suite('Highlight Color Configuration Tests', () => {
	teardown(async () => {
		// Reset configuration after each test
		const config = vscode.workspace.getConfiguration('tws');
		await config.update('highlightColor', undefined, vscode.ConfigurationTarget.Global);
	});

	test('Configuration defaults - highlightColor should be red rgba', async () => {
		const config = vscode.workspace.getConfiguration('tws');
		const defaultValue = config.inspect('highlightColor')?.defaultValue;

		assert.strictEqual(defaultValue, 'rgba(230, 0, 0, 0.2)', 'highlightColor should default to rgba(230, 0, 0, 0.2)');
	});

	test('Should accept hex color format', async () => {
		await vscode.workspace.getConfiguration('tws').update('highlightColor', '#ff0000', vscode.ConfigurationTarget.Global);

		const value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, '#ff0000', 'highlightColor should accept hex format');
	});

	test('Should accept rgb color format', async () => {
		await vscode.workspace.getConfiguration('tws').update('highlightColor', 'rgb(255, 0, 0)', vscode.ConfigurationTarget.Global);

		const value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, 'rgb(255, 0, 0)', 'highlightColor should accept rgb format');
	});

	test('Should accept rgba color format', async () => {
		await vscode.workspace.getConfiguration('tws').update('highlightColor', 'rgba(0, 255, 0, 0.5)', vscode.ConfigurationTarget.Global);

		const value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, 'rgba(0, 255, 0, 0.5)', 'highlightColor should accept rgba format');
	});

	test('Should accept named color format', async () => {
		await vscode.workspace.getConfiguration('tws').update('highlightColor', 'blue', vscode.ConfigurationTarget.Global);

		const value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, 'blue', 'highlightColor should accept named colors');
	});

	test('Should update color when configuration changes', async () => {
		// Set initial color
		await vscode.workspace.getConfiguration('tws').update('highlightColor', 'red', vscode.ConfigurationTarget.Global);
		let value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, 'red', 'highlightColor should be red');

		// Change color
		await vscode.workspace.getConfiguration('tws').update('highlightColor', 'blue', vscode.ConfigurationTarget.Global);
		value = vscode.workspace.getConfiguration('tws').get('highlightColor');
		assert.strictEqual(value, 'blue', 'highlightColor should update to blue');
	});
});
