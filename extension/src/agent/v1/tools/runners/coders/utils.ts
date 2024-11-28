// import { getCwd } from "@/agent/v1/utils"
// import { fileExistsAtPath } from "@/utils/path-helpers"
import { getCwd } from "../../../utils"
import { fileExistsAtPath } from "../../../../../utils/path-helpers"
import path from "path"
// @ts-expect-error - not typed
import { SequenceMatcher } from "@ewoudenberg/difflib"

export interface EditBlock {
	id: string
	path: string
	searchContent: string
	replaceContent: string
	isDelete?: boolean
}

/**
 * Normalizes text content for cross-platform comparison
 * Handles different line endings (CRLF vs LF) and path separators
 *
 * @param text - The text content to normalize
 * @returns Normalized text suitable for cross-platform comparison
 */
export function normalize(text: string): string {
	if (!text) return text

	return (
		text
			// First normalize all line endings to LF
			.replace(/\r\n/g, "\n")
			// Normalize all backslashes in path-like strings
			.replace(/\\+/g, "/")
			// Collapse multiple forward slashes to single
			.replace(/\/+/g, "/")
			// Trim any trailing/leading whitespace
			.trim()
	)
}

export function generateEditBlockId(searchContent: string): string {
	// fast hash the search content to generate a unique id
	let hash = 0
	for (let i = 0; i < searchContent.length; i++) {
		hash = (hash << 5) - hash + searchContent.charCodeAt(i)
		hash |= 0
	}
	return hash.toString(16)
}

export function findCodeBlock(content: string, startIndex: number): { start: number; end: number } | null {
	const lines = content.split("\n")
	let openBraces = 0
	let blockStart = -1

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i]

		// Check for block start indicators
		if (line.includes("{")) {
			if (openBraces === 0) {
				blockStart = i
			}
			openBraces += (line.match(/{/g) || []).length
		}

		// Check for block end
		if (line.includes("}")) {
			openBraces -= (line.match(/}/g) || []).length
			if (openBraces === 0 && blockStart !== -1) {
				return {
					start: blockStart,
					end: i,
				}
			}
		}
	}

	return null
}

export async function findSimilarLines(
	searchContent: string,
	content: string,
	threshold: number = 0.6
): Promise<string> {
	const searchLines = searchContent.split("\n")
	const contentLines = content.split("\n")

	let bestRatio = 0
	let bestMatch: string[] = []

	for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
		const chunk = contentLines.slice(i, i + searchLines.length)
		const matcher = new SequenceMatcher(null, searchLines.join("\n"), chunk.join("\n"))
		const similarity = matcher.ratio()
		if (similarity > bestRatio) {
			bestRatio = similarity
			bestMatch = chunk
		}
	}

	return bestRatio >= threshold ? bestMatch.join("\n") : ""
}

export async function applyEditBlocksToFile(content: string, editBlocks: EditBlock[]): Promise<string> {
	let newContent = content
	for (const block of editBlocks) {
		const searchContent = block.searchContent
		const replaceContent = block.replaceContent

		const result = replaceIgnoringIndentation(newContent, searchContent, replaceContent)
		if (result !== null) {
			newContent = result
		} else {
			// Try to find similar lines (optional)
			const similarLines = await findSimilarLines(searchContent, newContent)
			if (similarLines) {
				const similarIndex = newContent.indexOf(similarLines)
				newContent =
					newContent.substring(0, similarIndex) +
					replaceContent +
					newContent.substring(similarIndex + similarLines.length)
			} else {
				console.log(`Failed to find match for block: ${block.searchContent.slice(0, 100)}...`, "warn")
				throw new Error(`Failed to find matching block in file`)
			}
		}
	}
	return newContent
}

interface DiffBlockPosition {
	blockIndex: number
	startLine: number
	endLine: number
}

interface EditBlockWithPosition extends EditBlock {
	position?: DiffBlockPosition
}

function findPositionsInContent(content: string, searchStrings: string[]): number[] {
	const lines = content.split("\n")
	const positions: number[] = []

	for (const search of searchStrings) {
		const searchLines = search.split("\n")
		const searchLen = searchLines.length

		lineLoop: for (let i = 0; i <= lines.length - searchLen; i++) {
			for (let j = 0; j < searchLen; j++) {
				if (lines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
					continue lineLoop
				}
			}
			positions.push(i)
			break // Only find first match for each search block
		}
	}

	return positions
}

export function getEditBlockPositions(originalContent: string, blocks: EditBlock[]): EditBlockWithPosition[] {
	const lines = originalContent.split("\n")
	const blocksWithPosition: EditBlockWithPosition[] = []
	let currentLine = 0

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i]
		const positions = findPositionsInContent(originalContent, [block.searchContent])

		if (positions.length > 0) {
			const startLine = positions[0]
			const replaceLines = block.replaceContent.split("\n").length
			const searchLines = block.searchContent.split("\n").length

			blocksWithPosition.push({
				...block,
				position: {
					blockIndex: i,
					startLine,
					// For deletions, endLine will be the same as startLine
					endLine: startLine + (block.isDelete ? 0 : replaceLines - 1),
				},
			})

			// Update current line position
			currentLine = startLine + searchLines
		} else {
			blocksWithPosition.push(block)
		}
	}

	return blocksWithPosition
}

// Add the new replaceIgnoringIndentation method
export function replaceIgnoringIndentation(
	content: string,
	searchContent: string,
	replaceContent: string
): string | null {
	const contentLines = content.split(/\r?\n/)
	const searchLines = searchContent.split(/\r?\n/)
	const replaceLines = replaceContent.split(/\r?\n/)

	// Strip leading whitespace from searchLines for matching
	const strippedSearchLines = searchLines.map((line) => line.trimStart())

	// Try to find a match in contentLines
	for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
		const contentSlice = contentLines.slice(i, i + searchLines.length)
		// Strip leading whitespace from contentSlice
		const strippedContentSlice = contentSlice.map((line) => line.trimStart())

		// Compare the stripped lines
		if (strippedContentSlice.join("\n") === strippedSearchLines.join("\n")) {
			// Match found, calculate indentation difference for each line
			const indentedReplaceLines = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)

			// Replace the original lines with the indented replacement lines
			const newContentLines = [
				...contentLines.slice(0, i),
				...indentedReplaceLines,
				...contentLines.slice(i + searchLines.length),
			]

			return newContentLines.join("\n")
		}
	}

	// No match found
	return null
}

// Helper method to adjust indentation per line
export function adjustIndentationPerLine(
	contentSlice: string[],
	searchLines: string[],
	replaceLines: string[]
): string[] {
	const adjustedLines: string[] = []

	for (let idx = 0; idx < replaceLines.length; idx++) {
		const replaceLine = replaceLines[idx]
		const searchLine = searchLines[idx] || ""
		const contentLine = contentSlice[idx] || ""

		// Get indentation levels
		const searchIndentation = searchLine.match(/^\s*/)?.[0] || ""
		const contentIndentation = contentLine.match(/^\s*/)?.[0] || ""
		const replaceIndentation = replaceLine.match(/^\s*/)?.[0] || ""

		// Calculate indentation difference
		const indentationDifference = contentIndentation.length - searchIndentation.length

		// Adjust replace line indentation
		let newIndentationLength = replaceIndentation.length + indentationDifference
		if (newIndentationLength < 0) {
			newIndentationLength = 0
		}
		const newIndentation = " ".repeat(newIndentationLength)
		const lineContent = replaceLine.trimStart()
		adjustedLines.push(newIndentation + lineContent)
	}

	return adjustedLines
}

export function parseDiffBlocks(diffContent: string, path: string): EditBlock[] {
	const blocks: EditBlock[] = []
	const lines = diffContent.split("\n")
	let currentSearchLines: string[] = []
	let currentReplaceLines: string[] = []
	let isCollectingSearch = false
	let isCollectingReplace = false

	function finalizeBlock() {
		if (currentSearchLines.length > 0) {
			const searchContent = currentSearchLines.join("\n").trimEnd()
			const replaceContent = currentReplaceLines.join("\n").trimEnd()
			const id = generateEditBlockId(searchContent)

			blocks.push({
				id,
				path,
				searchContent,
				replaceContent,
				isDelete: replaceContent.trim() === "",
			})
		}

		currentSearchLines = []
		currentReplaceLines = []
		isCollectingSearch = false
		isCollectingReplace = false
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const nextLine = i + 1 < lines.length ? lines[i + 1] : null
		const trimmedLine = line.trim()

		// Handle start of a new block
		if (trimmedLine === "SEARCH") {
			// If we were already collecting a block, finalize it first
			if (isCollectingSearch || isCollectingReplace) {
				finalizeBlock()
			}
			isCollectingSearch = true
			continue
		}

		// Handle separator
		if (trimmedLine === "=======") {
			if (isCollectingSearch) {
				isCollectingSearch = false
				isCollectingReplace = true
			}
			continue
		}

		// Handle REPLACE marker
		if (trimmedLine === "REPLACE" && isCollectingReplace) {
			continue
		}

		// Collect content
		if (isCollectingSearch) {
			currentSearchLines.push(line)
		} else if (isCollectingReplace) {
			currentReplaceLines.push(line)
		}

		// Finalize block if we're about to start a new one
		if (nextLine?.trim() === "SEARCH" && isCollectingReplace) {
			finalizeBlock()
		}
	}

	// Handle the last block if it's complete (has both search and replace content)
	if (currentSearchLines.length > 0 && isCollectingReplace) {
		finalizeBlock()
	}

	return blocks
}

export async function checkFileExists(relPath: string): Promise<boolean> {
	const absolutePath = path.resolve(getCwd(), relPath)
	return await fileExistsAtPath(absolutePath)
}

export function preprocessContent(content: string): string {
	content = content.trim()
	if (content.startsWith("```")) {
		content = content.split("\n").slice(1).join("\n").trim()
	}
	if (content.endsWith("```")) {
		content = content.split("\n").slice(0, -1).join("\n").trim()
	}
	return content.replace(/>/g, ">").replace(/</g, "<").replace(/"/g, '"')
}

export async function parseAndApplyDiffBlocks(content: string, diffContent: string, path: string): Promise<string> {
	const blocks = parseDiffBlocks(diffContent, path)
	const positions = getEditBlockPositions(content, blocks)
	const newContent = await applyEditBlocksToFile(content, positions)
	return newContent
}
