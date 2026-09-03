/// <reference types="vite/client" />

declare global {
  interface ModelContextToolDefinition {
    name: string
    title?: string
    description: string
    inputSchema?: Record<string, unknown>
    annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
    execute: (args: Record<string, unknown>, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>
  }

  interface ModelContext {
    registerTool: (tool: ModelContextToolDefinition, options?: { signal?: AbortSignal; exposedTo?: string[] }) => Promise<void> | void
    getTools?: () => Promise<Array<{ name: string }>>
  }

  interface Document {
    modelContext?: ModelContext
  }
}

export {}
