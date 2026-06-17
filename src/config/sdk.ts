import { cmssdk } from "@willemharingopti/cmssdk"
import type { CmsSdkInstance } from "@willemharingopti/cmssdk"

// Structural shape of the SDK's credential options (iOptions isn't re-exported
// from the package entry, so we mirror the fields we set here).
type SdkOptions = { client_id?: string; client_secret?: string; base_url?: string; debug?: boolean }

/** Connection + output options shared by every command (set via global flags). */
export interface GlobalOptions {
   profile?: string
   clientId?: string
   clientSecret?: string
   baseUrl?: string
   debug?: boolean
   json?: boolean
   quiet?: boolean
   /** BCP-47 locale for formatting dates in table output (e.g. "nl-NL"). */
   displayLocale?: string
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
   if (opts.debug) explicit.debug = true

   const hasExplicit = Object.keys(explicit).length > 0
   return cmssdk(hasExplicit ? explicit : undefined)
}
