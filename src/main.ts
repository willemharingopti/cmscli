import { Command } from "@cliffy/command"
import { CompletionsCommand } from "@cliffy/command/completions"
import { resources } from "./resources.ts"
import { buildSdk, type GlobalOptions, type LogLevel, setupLogging } from "./config/sdk.ts"
import { resolveOptions } from "./config/profiles.ts"
import { configCommand } from "./commands/config.ts"
import { resolveBody } from "./input/body.ts"
import { render } from "./output/render.ts"
import { runPaged } from "./pagination.ts"
import { fail } from "./shared/errors.ts"
import { runInteractive } from "./interactive/session.ts"
import denoJson from "../deno.json" with { type: "json" }

// Cliffy camelCases flags, so the parsed options already line up with GlobalOptions.
const toGlobal = (o: Record<string, unknown>): GlobalOptions => ({
   profile: o.profile as string | undefined,
   clientId: o.clientId as string | undefined,
   clientSecret: o.clientSecret as string | undefined,
   baseUrl: o.baseUrl as string | undefined,
   debug: o.debug as boolean | undefined,
   json: o.json as boolean | undefined,
   quiet: o.quiet as boolean | undefined,
   logFile: o.logFile as string | undefined,
   logLevel: o.logLevel as LogLevel | undefined,
   // Profile + env fallbacks are applied later by resolveOptions().
   displayLocale: o.displayLocale as string | undefined,
})

const cleanQuery = (q: Record<string, unknown>): Record<string, unknown> | undefined => {
   const entries = Object.entries(q).filter(([, v]) => v !== undefined)
   return entries.length ? Object.fromEntries(entries) : undefined
}

const toCamel = (kebab: string): string => kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

const root = new Command()
   .name("cms")
   .version(denoJson.version)
   .description("CLI for the Optimizely CMS SDK. Run without arguments for interactive mode.")
   .globalOption("--profile <name:string>", "Config profile to use")
   .globalOption("--client-id <id:string>", "OAuth client id (overrides env/profile)")
   .globalOption("--client-secret <secret:string>", "OAuth client secret (overrides env/profile)")
   .globalOption("--base-url <url:string>", "CMS base URL (overrides env/profile)")
   .globalOption("--json", "Output raw JSON instead of tables")
   .globalOption("--quiet", "Suppress non-essential output")
   .globalOption("--debug", "Mirror SDK logs to the console (shorthand for --log-level debug)")
   .globalOption("--log-file <path:string>", "Write SDK logs to a file")
   .globalOption("--log-level <level:string>", "Lowest log level to record: trace|debug|info|warning|error|fatal")
   .globalOption("--display-locale <locale:string>", "BCP-47 locale for table dates (e.g. nl-NL); also CMS_DISPLAY_LOCALE")
   .action(async (options) => {
      // No subcommand -> interactive menu.
      await runInteractive(resources, resolveOptions(toGlobal(options as Record<string, unknown>)))
   })

root.command("config", configCommand)
root.command("completions", new CompletionsCommand())

// Build a subcommand tree from the registry: <resource> <verb> [args] [flags].
for (const resource of resources) {
   const resCmd = new Command().description(resource.description)

   for (const verb of resource.verbs) {
      const verbCmd = new Command().description(verb.description)

      if (verb.args.length > 0) {
         verbCmd.arguments(verb.args.map((a) => `<${a.name}:string>`).join(" "))
      }
      if (verb.hasBody) {
         verbCmd
            .option("-d, --data <json:string>", "Inline JSON request body")
            .option("-f, --file <path:file>", "Path to a JSON request body file")
      }
      if (verb.paged) {
         verbCmd
            .option("--page-index <n:number>", "Zero-based page index")
            .option("--page-size <n:number>", "Items per page")
      }
      for (const flag of verb.flags ?? []) {
         if (flag.type === "boolean") verbCmd.option(`--${flag.name}`, flag.description)
         else if (flag.type === "number") verbCmd.option(`--${flag.name} <value:number>`, flag.description)
         else if (flag.type === "array") verbCmd.option(`--${flag.name} <value:string>`, flag.description, { collect: true })
         else verbCmd.option(`--${flag.name} <value:string>`, flag.description)
      }
      for (const ex of verb.examples ?? []) {
         verbCmd.example(ex.name, ex.description)
      }

      verbCmd.action(async (options, ...posArgs) => {
         try {
            const opts = options as unknown as Record<string, unknown>
            const global = resolveOptions(toGlobal(opts))
            await setupLogging(global)
            const sdk = buildSdk(global)

            const args: Record<string, string> = {}
            verb.args.forEach((a, i) => (args[a.name] = String(posArgs[i])))

            const flagValues: Record<string, unknown> = {}
            for (const flag of verb.flags ?? []) {
               const key = toCamel(flag.name)
               if (opts[key] !== undefined) flagValues[key] = opts[key]
            }

            const body = verb.hasBody ? await resolveBody({ data: opts.data as string | undefined, file: opts.file as string | undefined }, verb.bodyOptional) : undefined
            const query = verb.paged ? cleanQuery({ pageIndex: opts.pageIndex, pageSize: opts.pageSize }) : undefined
            const ctx = { args, body, query, options: flagValues }

            // Interactive terminal + a paged verb -> walk pages on demand.
            // (--json / piped output stays single-shot for scripting.)
            const canNavigate = verb.paged && !global.json && Deno.stdin.isTerminal() && Deno.stdout.isTerminal()
            if (canNavigate) {
               await runPaged(sdk, verb, ctx, global)
               return
            }

            const result = await verb.run(sdk, ctx)

            // A verb that declares an `output` flag writes its result to that file.
            if (typeof flagValues.output === "string") {
               await Deno.writeTextFile(flagValues.output, JSON.stringify(result, null, 2))
               if (!global.quiet) console.error(`Wrote ${flagValues.output}`)
            } else {
               render(result, global)
            }
         } catch (e) {
            fail(e)
         }
      })

      resCmd.command(verb.name, verbCmd)
   }

   root.command(resource.name, resCmd)
}

await root.parse(Deno.args)
