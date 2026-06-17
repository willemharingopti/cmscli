import { Table } from "@cliffy/table"
import type { GlobalOptions } from "../config/sdk.ts"

// Columns we surface in list tables, in priority order. Only those present on
// the first item are shown; if none match we fall back to JSON.
const PREFERRED_COLUMNS = ["key", "displayName", "name", "status", "version", "locale", "contentType", "baseType", "source", "lastModified", "modified", "created"]

/** Pull the array out of a paged response (`{ items }`) or a bare array. */
const extractItems = (data: unknown): unknown[] | undefined => {
   if (Array.isArray(data)) return data
   if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).items)) {
      return (data as Record<string, unknown>).items as unknown[]
   }
   return undefined
}

// ISO 8601 date-times, e.g. "2026-06-05T09:30:06.1276696+00:00" or "...Z".
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

/** Render ISO date-times in the given (or system) locale; leave other strings as-is. */
const formatMaybeDate = (value: string, locale?: string): string => {
   if (!ISO_DATETIME.test(value)) return value
   const ms = Date.parse(value)
   return Number.isNaN(ms) ? value : new Date(ms).toLocaleString(locale)
}

const cell = (value: unknown, locale?: string): string => {
   if (value === null || value === undefined) return ""
   if (typeof value === "object") return JSON.stringify(value)
   if (typeof value === "string") return formatMaybeDate(value, locale)
   return String(value)
}

/** Build the rendered table (plus pagination footer) as a string. */
const renderTable = (items: unknown[], source: unknown, locale?: string): string => {
   if (items.length === 0) return "(no items)"

   const first = items[0] as Record<string, unknown>
   const columns = PREFERRED_COLUMNS.filter((c) => first && typeof first === "object" && c in first)

   // Items aren't shaped the way we expect — show raw JSON instead.
   if (columns.length === 0) return JSON.stringify(items, null, 2)

   const table = new Table()
      .header(columns)
      .body(items.map((item) => columns.map((c) => cell((item as Record<string, unknown>)[c], locale))))
      .border(true)

   let out = table.toString()
   const meta = source as Record<string, unknown>
   if (meta && typeof meta === "object" && typeof meta.totalCount === "number") {
      // The API documents totalCount as an estimate, so mark it approximate.
      out += `\n\n${items.length} shown · ≈${meta.totalCount} total (estimated)`
   }
   return out
}

/** Render a command result honoring --json / --quiet. */
export const render = (data: unknown, opts: GlobalOptions = {}): void => {
   if (data === undefined || data === null) {
      if (!opts.quiet) console.error("(done)")
      return
   }
   if (opts.json) {
      console.log(JSON.stringify(data, null, opts.quiet ? 0 : 2))
      return
   }

   const items = extractItems(data)
   console.log(items ? renderTable(items, data, opts.displayLocale) : JSON.stringify(data, null, 2))
}
