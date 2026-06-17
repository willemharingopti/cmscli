import type { ResourceSpec } from "../registry.ts"

// Property formats are a built-in, read-only resource: only list and get exist.
export const propertyformatsResource: ResourceSpec = {
   name: "propertyformats",
   description: "Built-in property formatting rules (read-only)",
   listKeys: async (sdk) => {
      const res = await sdk.propertyformats().list() as { items?: Array<Record<string, unknown>> }
      const items = res?.items ?? []
      return items
         .filter((i) => i?.key)
         .map((i) => ({ value: String(i.key), name: i.displayName ? `${i.key} — ${i.displayName}` : String(i.key) }))
   },
   verbs: [
      {
         name: "list",
         description: "List property formats",
         args: [],
         hasBody: false,
         destructive: false,
         paged: true,
         // deno-lint-ignore no-explicit-any
         run: (sdk, ctx) => sdk.propertyformats().list(ctx.query as any),
      },
      {
         name: "get",
         description: "Get a property format by key",
         args: [{ name: "key", description: "property format key", fromKeys: true }],
         hasBody: false,
         destructive: false,
         flags: [{ name: "allow-deleted", description: "Include a deleted property format", type: "boolean" }],
         run: (sdk, ctx) => sdk.propertyformats({ key: ctx.args.key }).get(ctx.options.allowDeleted ? { allowDeleted: true } : undefined),
      },
   ],
}
