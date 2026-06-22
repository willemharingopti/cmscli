import type { CmsSdkInstance } from "@willemharingopti/cmssdk"
import type { ResourceSpec } from "../registry.ts"

// The 8 standard domains share an identical callable-factory shape:
//   domain()        -> { list, post }
//   domain({ key }) -> { get, patch, delete }
// We type the accessor's return loosely (any) to avoid wrestling with the
// per-domain overloaded call signatures; each domain is exercised through the
// fixed verb set below, so the indirection stays type-safe at the call sites.
type DomainAccessor = (sdk: CmsSdkInstance) => any

export interface CrudOptions {
   name: string
   description: string
   accessor: DomainAccessor
   /** Field used to label items in interactive key pickers. */
   labelField?: string
   /** Optional transform applied to list items (e.g. to surface a derived column). */
   mapItems?: (items: any[]) => any[]
}

const singular = (name: string): string => name.endsWith("s") ? name.slice(0, -1) : name
const article = (word: string): string => /^[aeiou]/i.test(word) ? "an" : "a"

/** Build a ResourceSpec covering the standard list/get/create/patch/delete verbs. */
export const crudResource = (opts: CrudOptions): ResourceSpec => {
   const { accessor, name } = opts
   const label = opts.labelField ?? "displayName"
   const one = singular(name)

   return {
      name,
      description: opts.description,
      listKeys: async (sdk) => {
         const res = await accessor(sdk)().list()
         const items: any[] = res?.items ?? (Array.isArray(res) ? res : [])
         return items
            .filter((i) => i?.key)
            .map((i) => ({ value: String(i.key), name: i[label] ? `${i.key} — ${i[label]}` : String(i.key) }))
      },
      verbs: [
         {
            name: "list",
            description: `List ${name}`,
            args: [],
            hasBody: false,
            destructive: false,
            paged: true,
            run: async (sdk, ctx) => {
               const res = await accessor(sdk)().list(ctx.query)
               if (!opts.mapItems) return res
               // Preserve the paged wrapper (totalCount drives the footer); transform items only.
               if (Array.isArray(res)) return opts.mapItems(res)
               if (res && Array.isArray(res.items)) return { ...res, items: opts.mapItems(res.items) }
               return res
            },
         },
         {
            name: "get",
            description: `Get ${article(one)} ${one} by key`,
            args: [{ name: "key", description: `${one} key`, fromKeys: true }],
            hasBody: false,
            destructive: false,
            run: (sdk, ctx) => accessor(sdk)({ key: ctx.args.key }).get(),
         },
         {
            name: "create",
            description: `Create ${article(one)} ${one}`,
            args: [],
            hasBody: true,
            destructive: false,
            run: (sdk, ctx) => accessor(sdk)().post(ctx.body),
         },
         {
            name: "patch",
            description: `Patch ${article(one)} ${one} by key`,
            args: [{ name: "key", description: `${one} key`, fromKeys: true }],
            hasBody: true,
            destructive: false,
            run: (sdk, ctx) => accessor(sdk)({ key: ctx.args.key }).patch(ctx.body),
         },
         {
            name: "delete",
            description: `Delete ${article(one)} ${one} by key`,
            args: [{ name: "key", description: `${one} key`, fromKeys: true }],
            hasBody: false,
            destructive: true,
            run: (sdk, ctx) => accessor(sdk)({ key: ctx.args.key }).delete(),
         },
      ],
   }
}
