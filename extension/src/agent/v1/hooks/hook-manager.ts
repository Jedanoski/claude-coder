import { KoduDev } from ".."
import { BaseHook, HookOptions } from "./base-hook"

/**
 * Manages the lifecycle and execution of hooks
 */
export class HookManager {
	private hooks: BaseHook[] = []
	private koduDev: KoduDev

	constructor(koduDev: KoduDev) {
		this.koduDev = koduDev
	}

	/**
	 * Register a new hook
	 */
	public registerHook<T extends BaseHook>(
		HookClass: new (options: HookOptions, koduDev: KoduDev) => T,
		options: HookOptions
	): T {
		const hook = new HookClass(options, this.koduDev)
		this.hooks.push(hook)
		return hook
	}

	/**
	 * Check all hooks and execute those that should be triggered
	 * Returns concatenated content from all triggered hooks
	 */
	public async checkAndExecuteHooks(): Promise<string | null> {
		const triggeredHooks = this.hooks.filter((hook) => hook.shouldTrigger())
		if (triggeredHooks.length === 0) {
			return null
		}

		const results = await Promise.all(triggeredHooks.map((hook) => hook.execute()))
		const validResults = results.filter((result): result is string => result !== null)

		if (validResults.length === 0) {
			return null
		}

		return validResults.join("\n\n")
	}

	/**
	 * Remove a hook from the manager
	 */
	public removeHook(hookName: string): void {
		this.hooks = this.hooks.filter((hook) => hook.hookOptions.hookName !== hookName)
	}

	/**
	 * Get a hook by name
	 */
	public getHook(hookName: string): BaseHook | undefined {
		return this.hooks.find((hook) => hook.hookOptions.hookName === hookName)
	}

	/**
	 * Check if a hook exists
	 */
	public hasHook(hookName: string): boolean {
		return this.hooks.some((hook) => hook.hookOptions.hookName === hookName)
	}

	/**
	 * Get all registered hooks
	 */
	public getHooks(): BaseHook[] {
		return [...this.hooks]
	}

	/**
	 * Clear all hooks
	 */
	public clearHooks(): void {
		this.hooks = []
	}
}
