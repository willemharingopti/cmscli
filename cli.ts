// Bootstrap entry. The SDK runs dotenv.config() at import time, which (dotenv
// v17) prints a startup banner to stdout and would corrupt --json output. Set
// the quiet flag *before* the SDK module is loaded, then hand off to main.ts.
Deno.env.set("DOTENV_CONFIG_QUIET", "true")

await import("./src/main.ts")
