import { Command } from "@cliffy/command"
import { Table } from "@cliffy/table"
import { configPath, loadConfig, type Profile, saveConfig } from "../config/profiles.ts"
import { fail } from "../shared/errors.ts"

const mask = (secret?: string): string => secret ? "***" : ""

/** A copy of the profile safe to print (secret redacted). */
const redact = (p: Profile): Profile => ({ ...p, clientSecret: p.clientSecret ? "***" : undefined })

const isJson = (opts: Record<string, unknown>): boolean => opts.json === true

export const configCommand = new Command()
   .description("Manage connection profiles (stored at ~/.config/cmscli/config.json)")
   .action(function () {
      this.showHelp()
   })
   // ---- path ----
   .command("path", "Print the config file path")
   .action(() => console.log(configPath()))
   // ---- list ----
   .command("list", "List all profiles")
   .action((options) => {
      try {
         const opts = options as unknown as Record<string, unknown>
         const cfg = loadConfig()
         const names = Object.keys(cfg.profiles)
         if (isJson(opts)) {
            const redacted = Object.fromEntries(names.map((n) => [n, redact(cfg.profiles[n])]))
            console.log(JSON.stringify({ defaultProfile: cfg.defaultProfile, profiles: redacted }, null, 2))
            return
         }
         if (names.length === 0) {
            console.log("No profiles configured. Add one with: cms config set <name> --base-url <url> ...")
            return
         }
         new Table()
            .header(["", "profile", "baseUrl", "clientId", "clientSecret", "displayLocale"])
            .body(names.map((n) => {
               const p = cfg.profiles[n]
               return [n === cfg.defaultProfile ? "*" : "", n, p.baseUrl ?? "", p.clientId ?? "", mask(p.clientSecret), p.displayLocale ?? ""]
            }))
            .border(true)
            .render()
         if (cfg.defaultProfile) console.log(`\n* = default profile`)
      } catch (e) {
         fail(e)
      }
   })
   // ---- show ----
   .command("show <name:string>", "Show a single profile (secret redacted)")
   .action((options, name: string) => {
      try {
         const opts = options as unknown as Record<string, unknown>
         const cfg = loadConfig()
         const p = cfg.profiles[name]
         if (!p) fail(new Error(`Profile "${name}" not found.`))
         console.log(JSON.stringify(redact(p), null, isJson(opts) ? 0 : 2))
      } catch (e) {
         fail(e)
      }
   })
   // ---- set (create/update) ----
   .command("set <name:string>", "Create or update a profile")
   .option("--base-url <url:string>", "CMS base URL")
   .option("--client-id <id:string>", "OAuth client id")
   .option("--client-secret <secret:string>", "OAuth client secret")
   .option("--display-locale <locale:string>", "BCP-47 locale for table dates")
   .option("--make-default", "Also set this as the default profile")
   .action(async (options, name: string) => {
      try {
         const opts = options as unknown as Record<string, unknown>
         const cfg = loadConfig()
         const existing = cfg.profiles[name] ?? {}
         const updated: Profile = {
            ...existing,
            ...(opts.baseUrl !== undefined ? { baseUrl: opts.baseUrl as string } : {}),
            ...(opts.clientId !== undefined ? { clientId: opts.clientId as string } : {}),
            ...(opts.clientSecret !== undefined ? { clientSecret: opts.clientSecret as string } : {}),
            ...(opts.displayLocale !== undefined ? { displayLocale: opts.displayLocale as string } : {}),
         }
         cfg.profiles[name] = updated
         if (opts.makeDefault || !cfg.defaultProfile) cfg.defaultProfile = name
         await saveConfig(cfg)
         console.log(`Saved profile "${name}"${cfg.defaultProfile === name ? " (default)" : ""}.`)
      } catch (e) {
         fail(e)
      }
   })
   // ---- use (set default) ----
   .command("use <name:string>", "Set the default profile")
   .action(async (_options, name: string) => {
      try {
         const cfg = loadConfig()
         if (!cfg.profiles[name]) fail(new Error(`Profile "${name}" not found.`))
         cfg.defaultProfile = name
         await saveConfig(cfg)
         console.log(`Default profile is now "${name}".`)
      } catch (e) {
         fail(e)
      }
   })
   // ---- remove ----
   .command("remove <name:string>", "Delete a profile")
   .action(async (_options, name: string) => {
      try {
         const cfg = loadConfig()
         if (!cfg.profiles[name]) fail(new Error(`Profile "${name}" not found.`))
         delete cfg.profiles[name]
         if (cfg.defaultProfile === name) cfg.defaultProfile = undefined
         await saveConfig(cfg)
         console.log(`Removed profile "${name}".`)
      } catch (e) {
         fail(e)
      }
   })
