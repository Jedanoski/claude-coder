// src/state-manager/io-manager.ts
import fs from "fs/promises"
import path from "path"
import { ApiHistoryItem, ClaudeMessage, FileVersion, SubAgentState } from "../types"

interface IOManagerOptions {
	fsPath: string
	taskId: string
	agentHash?: string
}

/**
 * IOManager now handles all file I/O directly without a worker.
 * It is responsible for:
 * - Ensuring directories exist
 * - Reading/writing Claude messages and API history
 * - Managing file versions I/O
 */
export class IOManager {
	private fsPath: string
	private taskId: string
	private _agentHash?: string

	constructor(options: IOManagerOptions) {
		this.fsPath = options.fsPath
		this.taskId = options.taskId
		this._agentHash = options.agentHash
	}

	public get agentHash(): string | undefined {
		return this._agentHash
	}

	public set agentHash(value: string | undefined) {
		this._agentHash = value
	}

	private async ensureTaskDirectoryExists(): Promise<string> {
		const taskDir = path.join(this.fsPath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getSubAgentDirectory(): Promise<string> {
		if (!this.agentHash) {
			throw new Error("Agent hash is not set")
		}
		const taskDir = await this.ensureTaskDirectoryExists()
		const agentDir = path.join(taskDir, this.agentHash ?? "")
		await fs.mkdir(agentDir, { recursive: true })
		return agentDir
	}

	public async saveSubAgentState(state: SubAgentState): Promise<void> {
		const subAgentDir = await this.getSubAgentDirectory()
		const stateFilePath = path.join(subAgentDir, "state.json")
		await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2))
	}

	public async loadSubAgentState(): Promise<SubAgentState | undefined> {
		const subAgentDir = await this.getSubAgentDirectory()
		const stateFilePath = path.join(subAgentDir, "state.json")

		try {
			const data = await fs.readFile(stateFilePath, "utf8")
			const state: SubAgentState = JSON.parse(data)
			return state
		} catch {
			return undefined
		}
	}

	private async getClaudeMessagesFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, "claude_messages.json")
	}

	private async getApiHistoryFilePath(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		return path.join(taskDir, this.agentHash ?? "", "api_conversation_history.json")
	}

	// ---------- Claude Messages I/O ----------
	public async loadClaudeMessages(): Promise<ClaudeMessage[]> {
		const filePath = await this.getClaudeMessagesFilePath()

		try {
			const data = await fs.readFile(filePath, "utf8")
			const messages: ClaudeMessage[] = JSON.parse(data)
			return messages
		} catch {
			// If file does not exist or fails to parse, return empty array
			return []
		}
	}

	public async saveClaudeMessages(messages: ClaudeMessage[]): Promise<void> {
		this.getClaudeMessagesFilePath()
			.then((filePath) => {
				const data = JSON.stringify(messages, null, 2)
				// Fire and forget
				fs.writeFile(filePath, data).catch((err) => console.error("Failed to save Claude messages:", err))
			})
			.catch((err) => console.error("Failed to get Claude messages file path:", err))
	}

	// ---------- API History I/O ----------
	public async loadApiHistory(): Promise<ApiHistoryItem[]> {
		const filePath = await this.getApiHistoryFilePath()

		try {
			const data = await fs.readFile(filePath, "utf8")
			const history: ApiHistoryItem[] = JSON.parse(data)
			return history
		} catch {
			// If file does not exist or fails to parse, return empty array
			return []
		}
	}

	public async saveApiHistory(history: ApiHistoryItem[]): Promise<void> {
		this.getApiHistoryFilePath()
			.then((filePath) => {
				const data = JSON.stringify(history, null, 2)
				// Fire and forget
				fs.writeFile(filePath, data).catch((err) => console.error("Failed to save API history:", err))
			})
			.catch((err) => console.error("Failed to get API history file path:", err))
	}

	// ---------- File Versions I/O ----------
	private async getFileVersionsDir(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		const versionsDir = path.join(taskDir, "file_versions")
		await fs.mkdir(versionsDir, { recursive: true })
		return versionsDir
	}

	public async saveFileVersion(file: FileVersion): Promise<void> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(file.path)
		const fileDir = path.join(versionsDir, encodedPath)
		await fs.mkdir(fileDir, { recursive: true })

		const versionFilePath = path.join(fileDir, `version_${file.version}.json`)
		const data = {
			content: file.content,
			createdAt: file.createdAt,
		}
		await fs.writeFile(versionFilePath, JSON.stringify(data, null, 2))
	}

	public async deleteFileVersion(file: FileVersion): Promise<void> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(file.path)
		const fileDir = path.join(versionsDir, encodedPath)

		const versionFilePath = path.join(fileDir, `version_${file.version}.json`)
		await fs.unlink(versionFilePath)
	}

	public async getFileVersions(relPath: string): Promise<FileVersion[]> {
		const versionsDir = await this.getFileVersionsDir()
		const encodedPath = this.encodeFilePath(relPath)
		const fileDir = path.join(versionsDir, encodedPath)

		try {
			const entries = await fs.readdir(fileDir)
			const versionFiles = entries.filter((e) => e.startsWith("version_") && e.endsWith(".json"))
			const versions: FileVersion[] = []
			for (const vf of versionFiles) {
				const versionMatch = vf.match(/version_(\d+)\.json$/)
				if (!versionMatch) {
					continue
				}
				const verNum = parseInt(versionMatch[1], 10)
				const fullPath = path.join(fileDir, vf)
				const contentStr = await fs.readFile(fullPath, "utf8")
				const json = JSON.parse(contentStr)
				versions.push({
					path: relPath,
					version: verNum,
					createdAt: json.createdAt,
					content: json.content,
				})
			}
			versions.sort((a, b) => a.version - b.version)
			return versions
		} catch {
			return []
		}
	}

	public async getFilesInTaskDirectory(): Promise<Record<string, FileVersion[]>> {
		const versionsDir = await this.getFileVersionsDir()
		const result: Record<string, FileVersion[]> = {}
		try {
			const fileDirs = await fs.readdir(versionsDir)
			for (const fd of fileDirs) {
				const fileDir = path.join(versionsDir, fd)
				const stat = await fs.lstat(fileDir)
				if (stat.isDirectory()) {
					const relPath = this.decodeFilePath(fd)
					const versions = await this.getFileVersions(relPath)
					result[relPath] = versions
				}
			}
		} catch {
			// No files
		}
		return result
	}

	// ---------- Hooks ----------

	private async getHookDirectory(): Promise<string> {
		const taskDir = await this.ensureTaskDirectoryExists()
		const hookDir = path.join(taskDir, "hooks")
		await fs.mkdir(hookDir, { recursive: true })
		return hookDir
	}

	public async saveHookData(
		hookName: string,
		data: {
			requestsSinceLastTrigger: number
		}
	): Promise<void> {
		const hookDir = await this.getHookDirectory()
		const hookFilePath = path.join(hookDir, `${hookName}.json`)
		await fs.writeFile(hookFilePath, JSON.stringify(data, null, 2))
	}

	public async loadHookData(hookName: string): Promise<{ requestsSinceLastTrigger: number } | undefined> {
		const hookDir = await this.getHookDirectory()
		const hookFilePath = path.join(hookDir, `${hookName}.json`)

		try {
			const data = await fs.readFile(hookFilePath, "utf8")
			return JSON.parse(data)
		} catch {
			return undefined
		}
	}

	// ---------- Utility ----------

	private encodeFilePath(filePath: string): string {
		const replaced = filePath.replace(/[/\\]/g, "___")
		return Buffer.from(replaced).toString("base64")
	}

	private decodeFilePath(encoded: string): string {
		const decoded = Buffer.from(encoded, "base64").toString("utf-8")
		return decoded.replace(/___/g, path.sep)
	}
}
