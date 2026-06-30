import { cmssdk, configureLogging } from "@willemharingopti/cmssdk"
import type { CmsSdkInstance, LoggingOptions } from "@willemharingopti/cmssdk"

// Structural shape of the SDK's credential options (iOptions isn't re-exported
// from the package entry, so we mirror the fields we set here).
type SdkOptions = { client_id?: string; client_secret?: string; base_url?: string }

/** Lowest log level the SDK records; mirrors LogTape's levels. */
export type LogLevel = NonNullable<LoggingOptions["level"]>

/** Connection + output options shared by every command (set via global flags). */
export interface GlobalOptions {
   profile?: string
   clientId?: string
   clientSecret?: string
   baseUrl?: string
   /** Mirror SDK logs to the console (shorthand: console sink at `--log-level`). */
   debug?: boolean
   json?: boolean
   quiet?: boolean
   /** Write SDK logs to this file path. */
   logFile?: string
   /** Lowest log level to record (trace|debug|info|warning|error|fatal). */
   logLevel?: LogLevel
   /** BCP-47 locale for formatting dates in table output (e.g. "nl-NL"). */
   displayLocale?: string
}

/**
 * Wire up SDK logging from the global flags. Logging is process-global in the
 * SDK (LogTape), so call this once *before* {@link buildSdk}; doing it up front
 * guarantees the first request is captured rather than racing the SDK's own
 * fire-and-forget setup. No-op when no logging flag is supplied.
 */
export const setupLogging = async (opts: GlobalOptions): Promise<void> => {
   if (!opts.debug && !opts.logFile && !opts.logLevel) return
   const logging: LoggingOptions = { console: Boolean(opts.debug) }
   if (opts.logFile) logging.file = opts.logFile
   if (opts.logLevel) logging.level = opts.logLevel
   await configureLogging(logging)
}

/**
 * Build a configured SDK instance.
 *
 * Precedence (highest first): explicit flags > environment variables. Named
 * profiles (Phase 4) will be merged in between, before the env fallback.
 *
 * When no explicit credentials are supplied we pass `undefined` so the SDK uses
 * its shared, token-caching client and resolves everything from the env.
 */
export const buildSdk = (opts: GlobalOptions): CmsSdkInstance => {
   const explicit: SdkOptions = {}
   if (opts.clientId) explicit.client_id = opts.clientId
   if (opts.clientSecret) explicit.client_secret = opts.clientSecret
   if (opts.baseUrl) explicit.base_url = opts.baseUrl
   // Logging is configured separately (setupLogging) so the first request is
   // captured; we deliberately don't pass it through the SDK's options here.

   const hasExplicit = Object.keys(explicit).length > 0
   return cmssdk(hasExplicit ? explicit : undefined)
}
