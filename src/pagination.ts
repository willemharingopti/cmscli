import { Confirm } from "@cliffy/prompt"
import type { CmsSdkInstance } from "@willemharingopti/cmssdk"
import type { VerbContext, VerbSpec } from "./registry.ts"
import type { GlobalOptions } from "./config/sdk.ts"
import { render } from "./output/render.ts"

interface PageInfo {
   items: number
   pageIndex: number
   pageSize?: number
   totalCount?: number
}

/** Read the pagination envelope ({ items, pageIndex, pageSize, totalCount }) off a list response. */
const pageInfo = (result: unknown): PageInfo | null => {
   if (!result || typeof result !== "object") return null
   const r = result as Record<string, unknown>
   if (!Array.isArray(r.items)) return null
   return {
      items: r.items.length,
      pageIndex: typeof r.pageIndex === "number" ? r.pageIndex : 0,
      pageSize: typeof r.pageSize === "number" ? r.pageSize : undefined,
      totalCount: typeof r.totalCount === "number" ? r.totalCount : undefined,
   }
}

/**
 * Run a paged list verb, rendering one page at a time and prompting to load the
 * next page until the user stops or the results are exhausted.
 *
 * The API's `totalCount` is documented as an estimate and is unreliable on some
 * endpoints (it can exceed the number of items actually returned, and pages may
 * come back partially filled). So we never compute a total page count from it —
 * "is there more?" is decided purely by whether pages keep returning items, plus
 * an early stop once a reliable totalCount has been fully seen.
 */
export const runPaged = async (sdk: CmsSdkInstance, verb: VerbSpec, baseCtx: VerbContext, global: GlobalOptions): Promise<void> => {
   const start = (baseCtx.query?.pageIndex as number | undefined) ?? 0
   let pageIndex = start
   let seen = 0

   while (true) {
      const ctx: VerbContext = { ...baseCtx, query: { ...(baseCtx.query ?? {}), pageIndex } }
      const result = await verb.run(sdk, ctx)
      const info = pageInfo(result)
      const count = info?.items ?? 0

      // A later page that comes back empty means we've reached the end — don't
      // render a misleading empty table for it.
      if (pageIndex > start && count === 0) {
         if (!global.quiet) console.error("No more results.")
         break
      }

      render(result, global)
      seen += count

      // Stop when the page is empty, or when a reliable total has been reached.
      const reachedTotal = info?.totalCount != null && seen >= info.totalCount
      if (count === 0 || reachedTotal) break

      if (!(await Confirm.prompt({ message: `Load next page? (${seen} shown so far)`, default: true }))) break
      pageIndex++
   }
}
