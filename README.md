# cms — Optimizely CMS CLI

A command-line interface for the Optimizely CMS, built on
[`@willemharingopti/cmssdk`](https://jsr.io/@willemharingopti/cmssdk). It exposes
the full SDK surface — every resource and operation — as either scriptable
commands or a guided interactive menu.

```
cms <resource> <verb> [arguments] [flags]
cms                                    # no arguments → interactive mode
```

- **Runtime:** [Deno](https://deno.com) 2.x
- **Resources covered:** content, applications, blueprints, content types,
  sources, bindings, display templates, locales, property groups, property
  formats, and the manifest.

---

## Install

### Run from source (development)

```sh
deno task dev <args>          # e.g. deno task dev applications list
```

### Install as a global `cms` command

```sh
deno task install            # deno install -A -f -n cms ./cli.ts
cms applications list
```

### Compile a standalone binary

```sh
deno task compile            # produces ./cms (no Deno needed to run)
./cms applications list
```

---

## Authentication & configuration

The CLI needs three credentials for your CMS instance:

| Value         | Env variable               | Flag              |
| ------------- | -------------------------- | ----------------- |
| Client ID     | `OPTIMIZELY_CMS_CLIENT_ID`     | `--client-id`     |
| Client secret | `OPTIMIZELY_CMS_CLIENT_SECRET` | `--client-secret` |
| Base URL      | `OPTIMIZELY_CMS_BASE_URL`      | `--base-url`      |

There are three ways to supply them, applied in this order of precedence:

1. **Flags** — `--client-id`, `--client-secret`, `--base-url`
2. **Profiles** — named sets of credentials stored in a config file (see below)
3. **Environment** — the `OPTIMIZELY_CMS_*` variables, read from a local `.env`
   file or the shell

A minimal `.env` for quick local use:

```dotenv
OPTIMIZELY_CMS_CLIENT_ID=your-client-id
OPTIMIZELY_CMS_CLIENT_SECRET=your-client-secret
OPTIMIZELY_CMS_BASE_URL=https://your-instance.cms.optimizely.com
# optional: locale used to format dates in table output
CMS_DISPLAY_LOCALE=nl-NL
```

### Profiles

For switching between instances (prod, staging, …) use profiles. They are stored
at `~/.config/cmscli/config.json` (`$XDG_CONFIG_HOME` is respected) with file
permissions `0600`, since the file contains secrets.

```sh
# create / update a profile
cms config set prod \
  --base-url https://prod.cms.optimizely.com \
  --client-id ABC --client-secret SECRET \
  --display-locale en-GB --make-default

cms config list             # show all profiles (secrets redacted)
cms config show prod        # show one profile (secret redacted)
cms config use staging      # change the default profile
cms config remove old       # delete a profile
cms config path             # print the config file location
```

Select a profile per command with `--profile <name>`; otherwise the default
profile is used. A profile may set only some fields — e.g. just a
`displayLocale`, letting credentials fall through to environment variables.

```sh
cms content list --profile staging
```

---

## Global flags

| Flag                       | Description                                             |
| -------------------------- | ------------------------------------------------------ |
| `--profile <name>`         | Use a named profile                                    |
| `--client-id <id>`         | Override client id                                     |
| `--client-secret <secret>` | Override client secret                                 |
| `--base-url <url>`         | Override base URL                                       |
| `--json`                   | Output raw JSON instead of tables                      |
| `--quiet`                  | Suppress non-essential output                          |
| `--debug`                  | Enable SDK debug logging (HTTP calls)                  |
| `--display-locale <bcp47>` | Locale for dates in tables, e.g. `nl-NL` (also `CMS_DISPLAY_LOCALE`) |

---

## Output

- **Lists** render as tables. Date-time values are shown in your configured
  locale; everything else stays verbatim.
- **Single objects** print as pretty JSON.
- **`--json`** always emits raw JSON (clean for piping to `jq`), with dates left
  as their original ISO-8601 strings.
- **Result pages** — `list` commands fetch one page from the API at a time. In an
  interactive terminal, after each page you are asked whether to load the next
  one, so you can walk through all results. Use `--page-size` to change the page
  size and `--page-index` to jump to a starting page. With `--json` or piped
  output, a single page is returned (use `--page-index` to script through pages).

```sh
cms content list --json | jq '.items[].key'
```

---

## Providing request bodies

Create/patch/import commands accept a JSON body from any of:

```sh
cms applications create --data '{"displayName":"Site","type":"website"}'
cms applications create --file ./app.json
cat app.json | cms applications create            # stdin
```

---

## Commands

The eight standard resources share the same five verbs:

```
cms <resource> list                    # list (supports --page-index / --page-size)
cms <resource> get <key>
cms <resource> create   (body)
cms <resource> patch <key>   (body)
cms <resource> delete <key>
```

Resources: `applications`, `blueprints`, `contenttypes`, `sources`, `bindings`,
`displaytemplates`, `locales`, `propertygroups`.

### Property formats (read-only)

```sh
cms propertyformats list
cms propertyformats get <key> [--allow-deleted]
```

### Manifest

```sh
cms manifest export [--sections locales --sections contentTypes] \
                    [--include-readonly] [--output manifest.json]
cms manifest import --file manifest.json
```

`--sections` is repeatable. Without `--output` the manifest prints to stdout.

### Content

The richest resource. The scope of each verb is encoded in its name and
arguments:

```sh
# collection
cms content list [--locales en --statuses published] [--page-size N]
cms content create   (body)
cms content upload   (body) --media <path>   # multipart: JSON metadata + binary file

# by key
cms content get <key>
cms content patch <key>   (body)
cms content delete <key>
cms content copy <key> [body]          # body (copy options) is optional
cms content undelete <key>
cms content path <key>
cms content assets <key>
cms content items <key>
cms content versions <key>
cms content create-version <key>   (body)

# by key + version
cms content get-version <key> <version>
cms content patch-version <key> <version>   (body)
cms content delete-version <key> <version>
cms content media <key> <version>
cms content previews <key> <version>

# publishing workflow (by key + version)
cms content ready   <key> <version>
cms content approve <key> <version>
cms content reject  <key> <version>
cms content publish <key> <version>
cms content draft   <key> <version>

# by key + locale
cms content list-locale <key> <locale>
cms content delete-locale <key> <locale>
```

`--locales` and `--statuses` are repeatable. Valid statuses: `draft`, `ready`,
`published`, `previous`, `scheduled`, `rejected`, `inReview`.

`upload` creates a content item together with its binary media in a single
multipart request. The JSON body (via `-d/--data`, `-f/--file` or stdin) is the
content metadata — the same shape as `create` — while `--media` points at the
binary file to upload. For example:

```sh
cms content upload -d '{"contentType":"image"}' --media ./logo.png
```

---

## Interactive mode

Run `cms` with no arguments to launch a guided session:

1. Pick a resource.
2. Pick an action.
3. For arguments like `<key>`, the CLI fetches real values and offers them in a
   searchable list (with a manual-entry fallback).
4. For bodies, choose a file or paste JSON.
5. Destructive actions ask for confirmation.

The interactive menu and the scriptable commands are generated from the same
command registry, so they always stay in sync.

---

## Examples

```sh
# list applications as a table
cms applications list

# fetch one content item as JSON
cms content get f6723128c8a941da8386bec612fa0fbb --json

# only published English content
cms content list --statuses published --locales en

# export just locales and content types to a file
cms manifest export --sections locales --sections contentTypes --output backup.json

# create a content type from a file, against the staging profile
cms contenttypes create --file article.json --profile staging
```

---

## Development

```sh
deno task check              # type-check
deno fmt                     # format (see deno.json fmt settings)
deno task dev <args>         # run locally
```

### Project layout

```
cli.ts                     # bootstrap entry (silences dotenv banner, loads main)
src/
  main.ts                  # builds the Cliffy command tree from the registry
  registry.ts              # the resource/verb model that drives CLI + interactive
  resources.ts             # the registry contents (all resources)
  commands/
    crud.ts                # generic factory for the 8 standard CRUD resources
    content.ts             # the content resource (bespoke routing)
    propertyformats.ts     # read-only resource
    manifest.ts            # export/import singleton
    config.ts              # the `cms config` command
  config/
    sdk.ts                 # builds a configured SDK instance
    profiles.ts            # profile file load/save + option resolution
  input/body.ts            # --data / --file / stdin body resolution
  output/render.ts         # table / JSON rendering + locale-aware dates
  interactive/session.ts   # the no-args guided menu
  shared/errors.ts         # error reporting
```

Adding a new operation is usually a matter of declaring it in the registry — it
then appears in both the command tree and the interactive menu automatically.
