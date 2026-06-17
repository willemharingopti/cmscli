import type { GlobalOptions } from "./sdk.ts"

/** A stored connection profile. Secrets live here in plaintext (file is 0600). */
export interface Profile {
   baseUrl?: string
   clientId?: string
   clientSecret?: string
   displayLocale?: string
}

export interface ConfigFile {
   defaultProfile?: string
   profiles: Record<string, Profile>
}

/** Path to the config file: $XDG_CONFIG_HOME/cmscli/config.json (or ~/.config/...). */
export const configPath = (): string => {
   const base = Deno.env.get("XDG_CONFIG_HOME") ?? `${Deno.env.get("HOME") ?? "."}/.config`
   return `${base}/cmscli/config.json`
}

const EMPTY: ConfigFile = { profiles: {} }

/** Load the config, returning an empty config when the file does not exist. */
export const loadConfig = (): ConfigFile => {
   let raw: string
   try {
      raw = Deno.readTextFileSync(configPath())
   } catch (e) {
      if (e instanceof Deno.errors.NotFound) return { ...EMPTY }
      throw e
   }
   try {
      const parsed = JSON.parse(raw) as ConfigFile
      return { defaultProfile: parsed.defaultProfile, profiles: parsed.profiles ?? {} }
   } catch (e) {
      throw new Error(`Config file at ${configPath()} is not valid JSON: ${(e as Error).message}`)
   }
}

/** Persist the config, creating the directory and restricting permissions to 0600. */
export const saveConfig = async (cfg: ConfigFile): Promise<void> => {
   const path = configPath()
   const dir = path.slice(0, path.lastIndexOf("/"))
   await Deno.mkdir(dir, { recursive: true })
   await Deno.writeTextFile(path, JSON.stringify(cfg, null, 2) + "\n")
   try {
      await Deno.chmod(path, 0o600)
   } catch {
      // chmod is a no-op / unsupported on some platforms (e.g. Windows) — ignore.
   }
}

/**
 * Merge profile values into the parsed flags. Precedence (highest first):
 *   credentials:   --flag > selected profile > env (resolved later by the SDK)
 *   displayLocale: --flag > profile > CMS_DISPLAY_LOCALE env > system default
 *
 * The selected profile is `--profile` if given, otherwise `defaultProfile`.
 * An explicit `--profile` that does not exist is an error.
 */
export const resolveOptions = (global: GlobalOptions): GlobalOptions => {
   const cfg = loadConfig()
   const name = global.profile ?? cfg.defaultProfile
   let profile: Profile | undefined
   if (name) {
      profile = cfg.profiles[name]
      if (global.profile && !profile) throw new Error(`Profile "${name}" not found. Run: cms config list`)
   }
   return {
      ...global,
      clientId: global.clientId ?? profile?.clientId,
      clientSecret: global.clientSecret ?? profile?.clientSecret,
      baseUrl: global.baseUrl ?? profile?.baseUrl,
      displayLocale: global.displayLocale ?? profile?.displayLocale ?? Deno.env.get("CMS_DISPLAY_LOCALE") ?? undefined,
   }
}
