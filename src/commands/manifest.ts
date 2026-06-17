import type { ResourceSpec } from "../registry.ts"

const SECTIONS = ["locales", "contentTypes", "propertyGroups", "displayTemplates"]

// The manifest is a singleton: it can be exported (read) and imported (write).
export const manifestResource: ResourceSpec = {
   name: "manifest",
   description: "Export/import the full content definition manifest",
   verbs: [
      {
         name: "export",
         description: "Export the manifest (use --output to save to a file)",
         args: [],
         hasBody: false,
         destructive: false,
         flags: [
            { name: "sections", description: `Sections to include (repeatable): ${SECTIONS.join(", ")}`, type: "array" },
            { name: "include-readonly", description: "Include read-only resources", type: "boolean" },
            { name: "output", description: "Write the manifest to a file instead of stdout", type: "string" },
         ],
         run: (sdk, ctx) => {
            // deno-lint-ignore no-explicit-any
            const query: any = {}
            const sections = ctx.options.sections as string[] | undefined
            if (sections?.length) query.sections = sections
            if (ctx.options.includeReadonly) query.includeReadOnly = true
            return sdk.manifest().export(Object.keys(query).length ? query : undefined)
         },
      },
      {
         name: "import",
         description: "Import a manifest (--data/--file/stdin)",
         args: [],
         hasBody: true,
         destructive: true,
         // deno-lint-ignore no-explicit-any
         run: (sdk, ctx) => sdk.manifest().import(ctx.body as any),
      },
   ],
}
