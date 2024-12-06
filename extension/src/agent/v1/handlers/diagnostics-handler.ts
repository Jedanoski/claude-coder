import * as vscode from "vscode"
import * as path from "path"
import { getCwd } from "../utils"

export class DiagnosticsHandler {
	private static instance: DiagnosticsHandler

	private constructor() {
		// Private constructor to prevent direct instantiation
	}

	public static getInstance(): DiagnosticsHandler {
		if (!DiagnosticsHandler.instance) {
			DiagnosticsHandler.instance = new DiagnosticsHandler()
		}
		return DiagnosticsHandler.instance
	}

	public async getDiagnostics(paths: string[]): Promise<{ key: string; errorString: string | null }[]> {
		const results: { key: string; errorString: string | null }[] = []

		for await (const filePath of paths) {
			const uri = vscode.Uri.file(path.resolve(getCwd(), filePath))
			const diagnostics = vscode.languages.getDiagnostics(uri)
			const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error)

			let errorString: string | null = null

			if (errors.length > 0) {
				errorString = await this.formatDiagnostics(uri, errors)
			}

			results.push({ key: filePath, errorString })
		}

		return results
	}

	private async formatDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): Promise<string> {
		const relativePath = vscode.workspace.asRelativePath(uri.fsPath).replace(/\\/g, "/")

		// Start building XML structure
		let result = "<diagnostics>\n"
		result += `  <file path="${relativePath}">\n`

		for (const diagnostic of diagnostics) {
			if (diagnostic.severity !== vscode.DiagnosticSeverity.Error) {
				continue
			}
			const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
			const startChar = diagnostic.range.start.character
			const endChar = diagnostic.range.end.character
			const message = diagnostic.message

			// Get the line content if document is available
			let lineContent = "Unable to retrieve line content for this error"
			let errorPointer = ""

			// try {
			// 	const documentUri = vscode.Uri.file(uri.fsPath)
			// 	// use vscode workspace fs path to get the line content
			// 	const document = await vscode.workspace.openTextDocument(documentUri)
			// 	if (!document || line > document.lineCount) {
			// 		throw new Error("Document not found")
			// 	}
			// 	const lineText = document?.lineAt(line - 1).text
			// 	lineContent = lineText
			// 	// Create a pointer to show exactly where the error is
			// 	errorPointer = " ".repeat(startChar) + "^".repeat(Math.max(1, endChar - startChar))
			// } catch (err) {
			// 	console.error(err)
			// }

			// Add error information in XML format
			result += "    <error>\n"
			result += `      <line>${line}</line>\n`
			result += `      <message>${message}</message>\n`
			// result += `      <code>${lineContent}</code>\n`
			result += `      <position start="${startChar}" end="${endChar}" />\n`
			result += "    </error>\n"
		}

		result += "  </file>\n"
		result += "</diagnostics>"

		return result
	}
}
