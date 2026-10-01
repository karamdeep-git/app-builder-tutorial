# Adobe I/O CLI (`aio`) — Command Reference

Full reference for the `aio` CLI used throughout this project (`@adobe/aio-cli`
v11.1.2). Run any command with `--help` for its full flag list — this doc focuses on
*what each command is for* and *when you'd actually reach for it* on this project.

Run via `npx aio <command>` from the project root (uses the version pinned in
`package.json`), or install globally with `npm install -g @adobe/aio-cli` to just
use `aio <command>` anywhere.

---

## Quick reference — the commands this project actually uses

| Command | What it does here |
|---|---|
| `aio app use` | One-time (or per-workspace-switch) setup: pick Org/Project/Workspace, writes `.env` + `.aio` |
| `aio app build` | Compiles TypeScript (`actions-src/` → `actions/`) and bundles the frontend (`web-src/` → `dist/`) |
| `aio app build --no-actions` | Same, but skip rebuilding actions — just the frontend (faster, used constantly while iterating on UI) |
| `aio app deploy` | Build + push everything (actions and web assets) live to Adobe I/O Runtime/CDN |
| `aio app deploy --web-assets` | Deploy only the frontend, skip redeploying actions (faster when only `web-src/` changed) |
| `aio app logs` | Tail/fetch logs from deployed actions |
| `aio runtime action invoke <name> --result` | Manually call one deployed action directly, bypassing the frontend — the main tool for debugging a single action |
| `aio runtime activation list` | See recent invocations of your actions (debugging) |
| `aio runtime activation logs <id>` | Full logs for one specific invocation |
| `aio login` | Re-authenticate the CLI itself when a session expires |
| `aio console where` | "What org/project/workspace am I currently pointed at?" — sanity check before deploying |

---

## `aio app` — the command group you use every day

```text
aio app create     Create a new Adobe I/O App with default parameters
aio app init       Create a new Adobe I/O App (interactive wizard)
aio app use        Import an Adobe Developer Console configuration (writes .env/.aio)
aio app build      Build an Adobe I/O App
aio app deploy     Deploy an Adobe I/O App
aio app dev        Run your App Builder app locally (hot-reload dev server)
aio app run        Run an Adobe I/O App
aio app test       Run tests for an Adobe I/O App
aio app clean      Remove all build artifacts from the local machine
aio app undeploy   Undeploys an Adobe I/O App
aio app list       List components for Adobe I/O App
aio app info       Display settings/configuration in use by an Adobe I/O App
aio app get-url    Get action URLs
aio app logs       Fetch logs for an Adobe I/O App
aio app add        Add a new component to an existing app (e.g. a new action package)
aio app delete     Delete a component from an existing app
aio app pack       Package an app for redistribution
aio app install    Install an app packaged by `aio app pack`
```

### `aio app use`

```bash
aio app use
# Interactive: pick Org -> Project -> Workspace
# Writes/overwrites: .env (secrets, see CONFIGURATION.md) and .aio (names/URLs)
```
Run this once per machine, and again any time you need to point the project at a
*different* Adobe Developer Console project or workspace (e.g. switching from
"Stage" to "Production"). You can also pass a downloaded console JSON file directly:
`aio app use ~/Downloads/console.json`, which skips the interactive picker.

### `aio app build`

```bash
aio app build                 # full build: actions (tsc) + web assets (Parcel)
aio app build --no-actions    # web assets only - what we use while iterating on UI,
                               # since it skips re-running tsc on actions-src/
```
This is what actually runs `tsc` (via the `pre-app-build` hook in `app.config.yaml`)
and regenerates `web-src/src/config.json` with the current action URLs. Does **not**
push anything anywhere — purely local compilation, output goes to `dist/`.

### `aio app deploy`

```bash
aio app deploy                # build + deploy everything (actions + frontend)
aio app deploy --web-assets   # skip redeploying actions, just push the frontend
```
This is the one that actually makes your changes live — pushes compiled actions to
Adobe I/O Runtime and the frontend bundle to the static CDN. Always builds first
(same as running `aio app build` immediately before). Takes 30s–2min depending on
how much changed.

### `aio app dev`

```bash
aio app dev
```
Runs a local dev server with actions running against a local OpenWhisk-compatible
runtime emulator and the frontend hot-reloading — useful for fast iteration without
deploying, though this project mostly used real deploys for testing since the
actions talk to real Commerce/Magento state.

### `aio app logs`

```bash
aio app logs                  # recent logs across all deployed actions
aio app logs --action product/update   # just one action
aio app logs --tail           # follow/stream live
```

---

## `aio runtime` (alias `aio rt`) — talking to Adobe I/O Runtime (OpenWhisk) directly

Lower-level than `aio app` — useful when you need to poke at a *specific* deployed
action rather than the whole app.

```text
aio runtime action       Manage your actions        (alias: aio rt action)
aio runtime activation   Manage your activations    (alias: aio rt activation)
aio runtime trigger      Manage your triggers
aio runtime rule         Manage your rules
aio runtime package      Manage your packages
aio runtime namespace    Manage your namespaces
aio runtime api          Manage your api routes
aio runtime property     Get/set runtime CLI properties (namespace, auth, apihost)
aio runtime sandbox      Manage runtime sandboxes
aio runtime ip-list      Fetch the Adobe I/O Runtime egress IP allowlist
aio runtime deploy       Lower-level deployment tool (aio app deploy uses this internally)
```

### `aio runtime action` subcommands

```text
aio runtime action list              Lists all deployed actions in the namespace
aio runtime action get <name>        Retrieves an action's metadata/code
aio runtime action invoke <name>     Invokes an action directly
aio runtime action create <name>     Creates an action (low-level - aio app deploy does this for you)
aio runtime action update <name>     Updates an action (low-level)
aio runtime action delete <name>     Deletes an action
```

**The one you'll actually reach for — `invoke`:**

```bash
# Invoke a web action with parameters, see the raw JSON result immediately -
# this is how every action in this project was smoke-tested without going
# through the browser at all.
aio runtime action invoke product/list --result

# With input parameters (-p key value):
aio runtime action invoke product/update --param-file payload.json --result

# Blocking vs async: --result implies --blocking under the hood (waits for the
# actual return value instead of just an activation id)
aio runtime action invoke indexer/reindex-status -p jobId "abc123" --result
```

### `aio runtime activation` subcommands

```text
aio runtime activation list              Lists recent activations (invocations)
aio runtime activation get <id>          Full details for one activation
aio runtime activation logs <id>         Just the console.log output for one activation
aio runtime activation result <id>       Just the return value for one activation
```

```bash
# Debugging flow used throughout this project when an action misbehaved:
aio runtime activation list --limit 5          # find the recent activation id
aio runtime activation logs <activation-id>    # see what it actually logged
```

### `aio runtime property`

```bash
aio runtime property get      # show current namespace/auth/apihost the CLI is using
aio runtime property set --namespace <ns> --auth <key>   # manually override (rarely needed - aio app use sets these via .env)
```

---

## `aio console` — managing the Adobe Developer Console project itself

This is the CLI equivalent of clicking around
[developer.adobe.com/console](https://developer.adobe.com/console) — used far less
often than `aio app`/`aio runtime` day-to-day, mostly for one-time setup or
switching contexts.

```text
aio console where               Show the currently selected Org/Project/Workspace
aio console open                Open the web console for the current selection
aio console org                 Manage Organizations (list/select)
aio console project             Manage Projects (list/create/select)
aio console workspace           Manage Workspaces (alias: aio console ws)
aio console api                 Manage API services subscribed to the Org
aio console publickey           Manage public key bindings for a Workspace
```

### `aio console project` / `aio console workspace`

```bash
aio console project list              # see all App Builder projects in the org
aio console project select            # switch which project subsequent commands target
aio console workspace list            # see workspaces (e.g. "Stage", "Production") in the current project
aio console workspace select          # switch workspace
aio console workspace download        # download the workspace's console.json (consumed by `aio app use <file>`)
```

```bash
# Sanity-check before deploying anything - "am I about to deploy to the right place?"
aio console where
#   Org: Kinex Media Partner Sandbox
#   Project: TestKnm
#   Workspace: Stage
```

---

## `aio event` — Adobe I/O Events (used for the product catalog sync)

This project's `product/events-consumer` action (real-time Commerce →
cache sync via `catalog_product_save_commit_after`/`catalog_product_delete_commit_
after`) depends on an Event Registration set up through this command group (or the
Developer Console UI equivalent).

```text
aio event provider          Manage Event Providers (e.g. the Commerce instance itself)
aio event registration      Manage Event Registrations (alias: aio event reg)
aio event eventmetadata     Manage the event types a Provider can emit
```

```bash
aio event registration list     # see what this Workspace is currently subscribed to
aio event registration get <id> # details of one registration (which events, which action it delivers to)
aio event registration create   # wire up a new provider+event-type -> action binding (interactive)
```

---

## `aio app state` / `aio app db` — inspecting the backing stores from the CLI

Handy for checking what's actually cached without writing a throwaway debug action.
This project uses **State** (`@adobe/aio-lib-state`) for the product cache — **not**
the newer Database storage.

```text
aio app state list              List all keys currently in State for this namespace
aio app state get <key>         Get one value (e.g. a cached product)
aio app state put <key> <value> Manually set a value (rarely needed - actions do this)
aio app state delete <key>      Delete one key
aio app state stats             Storage usage stats

aio app db ping                 Test DB connectivity (not used by this project)
aio app db provision            Provision a new database (not used by this project)
```

```bash
# Peek at a cached product directly, bypassing the app entirely:
aio app state get product-$(echo -n "24-MB01" | base64)
```

---

## Auth / session management

```text
aio login              Log the CLI into your Adobe account (opens a browser)
aio logout             Log the CLI out
aio context / aio ctx  Manage named CLI config "contexts" (switch between multiple logins)
```

```bash
aio login       # needed again whenever the CLI reports an auth/session error,
                # e.g. the "Something went wrong" browser-login failures hit earlier
                # in this project
```

---

## `aio config` — persistent CLI configuration (not project `.env`)

```text
aio config get <key>       Read a CLI-global config value
aio config set <key> <val> Set one
aio config delete <key>    Remove one
aio config clear           Wipe all CLI-global config
```
This is separate from this project's `.env` — it's `aio`'s *own* settings (e.g.
which analytics/telemetry prefs, cached login tokens), stored outside any project
directory. You'll rarely touch this directly.

---

## Everything else (rarely needed on this project)

```text
aio certificate     Generate/fingerprint/verify certificates for Adobe I/O
aio templates       Discover/install/uninstall App Builder templates
aio plugins         List/manage installed aio CLI plugins
aio autocomplete    Set up shell tab-completion for aio commands
aio update          Update the aio CLI itself
aio where           Show where the aio CLI is installed
aio info            Show CLI environment info (for bug reports)
aio open            Open a relevant URL (context-dependent)
aio discover        Discover available Adobe I/O APIs
aio report          Generate a diagnostic report
aio rollback        Roll back a deployment
aio telemetry       Manage CLI usage telemetry opt-in/out
```

---

## See also

- `CONFIGURATION.md` — every key/URL `aio app use` and `.env` actually populate.
- `SESSION_SUMMARY.md` — what was built this session and why.
