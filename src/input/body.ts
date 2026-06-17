export interface BodyInput {
   data?: string
   file?: string
}

/**
 * Resolve a JSON request body from, in order: an inline --data string, a --file
 * path, or piped stdin. Throws a clear error if nothing usable is provided.
 */
export const resolveBody = async (input: BodyInput, optional = false): Promise<unknown> => {
   let raw: string | undefined

   if (input.data !== undefined) {
      raw = input.data
   } else if (input.file) {
      raw = await Deno.readTextFile(input.file)
   } else if (!Deno.stdin.isTerminal()) {
      raw = await new Response(Deno.stdin.readable).text()
   }

   if (raw === undefined || raw.trim() === "") {
      if (optional) return undefined
      throw new Error("No request body provided. Use --data '<json>', --file <path>, or pipe JSON via stdin.")
   }

   try {
      return JSON.parse(raw)
   } catch (e) {
      throw new Error(`Invalid JSON body: ${(e as Error).message}`)
   }
}
