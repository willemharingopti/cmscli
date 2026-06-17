/**
 * Print an error and exit non-zero. The SDK throws Error instances whose
 * message is already a formatted problem-details block, so we just surface it.
 */
export const fail = (err: unknown): never => {
   const message = err instanceof Error ? err.message : String(err)
   console.error(`%cerror:%c ${message}`, "color: red; font-weight: bold", "")
   Deno.exit(1)
}

/** Extract a human-readable message without exiting (used by interactive mode). */
export const messageOf = (err: unknown): string => err instanceof Error ? err.message : String(err)
