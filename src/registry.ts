import type { CmsSdkInstance } from "@willemharingopti/cmssdk"

/** A positional argument a verb requires (e.g. `key`, `version`, `locale`). */
export interface ArgSpec {
   name: string
   description: string
   /** When true, interactive mode offers real keys (via the resource's listKeys). */
   fromKeys?: boolean
}

/** An optional, non-positional flag a verb accepts (query params, output paths, ...). */
export interface FlagSpec {
   /** kebab-case flag name, e.g. "include-readonly". Read from ctx.options camelCased. */
   name: string
   description: string
   type: "boolean" | "string" | "number" | "array"
}

/** Everything a verb needs to execute, resolved from flags/prompts. */
export interface VerbContext {
   args: Record<string, string>
   body?: unknown
   query?: Record<string, unknown>
   /** Parsed flag values, keyed by camelCased flag name. */
   options: Record<string, unknown>
}

/** One operation on a resource (list, get, create, publish, ...). */
export interface VerbSpec {
   name: string
   description: string
   args: ArgSpec[]
   /** Whether this verb sends a request body (create/patch/import). */
   hasBody: boolean
   /** When hasBody, allow running with no body provided (e.g. copy options). */
   bodyOptional?: boolean
   /** Whether interactive mode should confirm before running. */
   destructive: boolean
   /** Whether this verb supports pagination query flags. */
   paged?: boolean
   /** Extra non-positional flags this verb accepts. */
   flags?: FlagSpec[]
   run: (sdk: CmsSdkInstance, ctx: VerbContext) => Promise<unknown>
}

/**
 * A resource (applications, content, manifest, ...). One declarative spec drives
 * both the Cliffy command tree and the interactive menu.
 */
export interface ResourceSpec {
   name: string
   description: string
   verbs: VerbSpec[]
   /** Returns selectable keys for interactive arg resolution, when supported. */
   listKeys?: (sdk: CmsSdkInstance) => Promise<Array<{ value: string; name: string }>>
}
