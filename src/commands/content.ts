import type { CmsSdkInstance } from "@willemharingopti/cmssdk"
import type { ResourceSpec, VerbContext, VerbSpec } from "../registry.ts"

// The content domain dispatches on parameter shape:
//   content()                    -> post, list
//   content({ key })             -> get, patch, delete, copy, undelete, path, assets, items, versions, createVersion
//   content({ key, version })    -> get, patch, delete, media, previews, workflow()
//   content({ key, locale })     -> list, delete
// We keep the CLI flat (content <verb> [key] [version|locale]) and encode the
// scope in the verb name. SDK calls are cast to `any` at the body/query
// boundary since CLI input is dynamic JSON.

// deno-lint-ignore no-explicit-any
const sdkContent = (sdk: CmsSdkInstance): any => sdk.content

// Best-effort content type for the uploaded file part, inferred from extension.
// The filename (not the type) is what the API strictly requires; this just keeps
// the part's content-type honest. Falls back to a generic binary type.
const MIME_BY_EXT: Record<string, string> = {
   png: "image/png",
   jpg: "image/jpeg",
   jpeg: "image/jpeg",
   gif: "image/gif",
   webp: "image/webp",
   svg: "image/svg+xml",
   pdf: "application/pdf",
   json: "application/json",
   txt: "text/plain",
   mp4: "video/mp4",
   webm: "video/webm",
}
const mimeForFile = (filename: string): string => {
   const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : ""
   return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

const KEY = { name: "key", description: "content key", fromKeys: true }
const VERSION = { name: "version", description: "version identifier" }
const LOCALE = { name: "locale", description: "locale (BCP-47, or NEUTRAL)" }

// Helper to keep verb definitions terse.
const verb = (
   name: string,
   description: string,
   args: VerbSpec["args"],
   run: VerbSpec["run"],
   extra: Partial<VerbSpec> = {},
): VerbSpec => ({ name, description, args, hasBody: false, destructive: false, run, ...extra })

const listRun = (sdk: CmsSdkInstance, ctx: VerbContext) => {
   // deno-lint-ignore no-explicit-any
   const q: any = { ...(ctx.query ?? {}) }
   if (ctx.options.locales) q.locales = ctx.options.locales
   if (ctx.options.statuses) q.statuses = ctx.options.statuses
   return sdkContent(sdk)().list(Object.keys(q).length ? q : undefined)
}

const STATUS_VALUES = "draft, ready, published, previous, scheduled, rejected, inReview"

export const contentResource: ResourceSpec = {
   name: "content",
   description: "Pages, blocks, media and folders (the content tree)",
   listKeys: async (sdk) => {
      const res = await sdkContent(sdk)().list({ pageSize: 100 }) as { items?: Array<Record<string, unknown>> }
      const items = res?.items ?? []
      // The list returns versions, so dedupe by content key.
      const seen = new Map<string, string>()
      for (const i of items) {
         if (!i?.key) continue
         const key = String(i.key)
         if (!seen.has(key)) seen.set(key, i.displayName ? `${key} — ${i.displayName}` : key)
      }
      return [...seen].map(([value, name]) => ({ value, name }))
   },
   verbs: [
      // ---- collection ----
      verb("list", "List content versions", [], listRun, {
         paged: true,
         flags: [
            { name: "locales", description: "Filter by locale (repeatable; NEUTRAL for locale-neutral)", type: "array" },
            { name: "statuses", description: `Filter by status (repeatable): ${STATUS_VALUES}`, type: "array" },
         ],
      }),
      verb("create", "Create content", [], (sdk, ctx) => sdkContent(sdk)().post(ctx.body), { hasBody: true }),
      verb(
         "upload",
         "Create content with a binary media file (multipart upload). Content metadata is the JSON body; --media points at the file.",
         [],
         async (sdk, ctx) => {
            const mediaPath = ctx.options.media as string | undefined
            if (!mediaPath) throw new Error("Upload requires a media file. Pass --media <path>.")
            const bytes = await Deno.readFile(mediaPath)
            const filename = mediaPath.split(/[\\/]/).pop() || "upload"
            // The CMA multipart endpoint requires the `file` part to carry a filename in its
            // Content-Disposition. The SDK appends body.file to FormData verbatim, so we must
            // pass a File (a named Blob) — a raw Uint8Array/Blob would ship with no filename
            // and the API rejects it with "second part must have a FileName".
            const file = new File([bytes], filename, { type: mimeForFile(filename) })
            return sdkContent(sdk)().upload({ content: ctx.body, file })
         },
         { hasBody: true, flags: [{ name: "media", description: "Path to the binary media file to upload (the JSON body / -f --file is the content metadata)", type: "string" }] },
      ),

      // ---- by key ----
      verb("get", "Get content by key", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).get()),
      verb("patch", "Patch content by key", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).patch(ctx.body), { hasBody: true }),
      verb("delete", "Delete content by key", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).delete(), { destructive: true }),
      verb("copy", "Copy content (optional copy options as body)", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).copy(ctx.body), { hasBody: true, bodyOptional: true }),
      verb("undelete", "Restore deleted content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).undelete()),
      verb("path", "Get the ancestor path of content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).path()),
      verb("assets", "List assets of content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).assets()),
      verb("items", "List child items of content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).items()),
      verb("versions", "List versions of content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).versions()),
      verb("create-version", "Create a new version of content", [KEY], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key }).createVersion(ctx.body), { hasBody: true }),

      // ---- by key + version ----
      verb("get-version", "Get a specific content version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).get()),
      verb("patch-version", "Patch a specific content version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).patch(ctx.body), { hasBody: true }),
      verb("delete-version", "Delete a specific content version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).delete(), { destructive: true }),
      verb("media", "Get media for a content version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).media()),
      verb("previews", "Get previews for a content version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).previews()),

      // ---- workflow (by key + version) ----
      verb("ready", "Mark a version ready for review", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).workflow().ready()),
      verb("approve", "Approve a version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).workflow().approve()),
      verb("reject", "Reject a version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).workflow().reject(), { destructive: true }),
      verb("publish", "Publish a version", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).workflow().publish()),
      verb("draft", "Move a version back to draft", [KEY, VERSION], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, version: ctx.args.version }).workflow().draft()),

      // ---- by key + locale ----
      verb("list-locale", "List versions for a content locale", [KEY, LOCALE], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, locale: ctx.args.locale }).list()),
      verb("delete-locale", "Delete a content locale", [KEY, LOCALE], (sdk, ctx) => sdkContent(sdk)({ key: ctx.args.key, locale: ctx.args.locale }).delete(), { destructive: true }),
   ],
}
