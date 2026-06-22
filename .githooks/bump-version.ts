// Bumps the patch segment of the "version" field in deno.json.
// Targeted text replace (not a full re-serialize) to keep the diff minimal.
const path = "deno.json"
const text = await Deno.readTextFile(path)

const m = text.match(/("version"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")/)
if (!m) {
   console.error("bump-version: no semver \"version\" field found in deno.json")
   Deno.exit(1)
}

const [major, minor, patch] = [m[2], m[3], Number(m[4]) + 1]
const next = `${m[1]}${major}.${minor}.${patch}${m[5]}`
await Deno.writeTextFile(path, text.replace(m[0], next))
console.log(`bump-version: ${major}.${minor}.${Number(m[4])} -> ${major}.${minor}.${patch}`)
