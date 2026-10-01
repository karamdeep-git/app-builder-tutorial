# App Builder Tutorial — Work Summary

A full Adobe App Builder application for managing a Magento/Adobe Commerce catalog,
built on top of the `app-builder-typescript-template`. This document summarizes
everything built, how it's wired together, and known limitations.

Deployed app: `https://4033606-testknm-stage.adobeio-static.net/index.html`
Adobe Developer Console project: **TestKnm** (Stage workspace)
Commerce instance: local Magento (`testapp`), reachable via an ngrok tunnel (URL
rotates on restart — see `COMMERCE_BASE_URL` in `.env`, documented in
`CONFIGURATION.md`)

---

## 1. Project setup

- Fixed a broken `npm install` caused by a missing `tsconfig.types.json` (mirrors the
  existing `tsconfig.cjs.json`/`tsconfig.es.json` pattern).
- Connected the local project to the **TestKnm** Adobe Developer Console project
  (Stage workspace) via `aio app use`.
- Added the Kinex Media company logo to the app header (`web-src/src/assets/
  kinex-logo.webp`), fetched from kinexmedia.com.

## 2. Admin login

Custom login gate for the app itself (separate from Adobe's own IMS/Experience Cloud
Shell auth, which this app does not currently require — `require-adobe-auth: false`
on all actions).

- **`actions-src/auth/login`** — validates a username/password against Magento's own
  admin token endpoint (`POST /rest/V1/integration/admin/token`). Real Magento admin
  credentials are required to log in; there's no separate user store.
- **`web-src/src/components/Login.js`** / **`Dashboard.js`** — full-page login,
  redirects to a dashboard landing page on success.
- Session persisted in `sessionStorage` (cleared on tab close). The whole app (sidebar,
  all pages) is hidden until logged in.
- **Scope note**: this only gates the *app's UI*. The underlying `product/*`,
  `indexer/*`, `commands/*` actions remain open (`require-adobe-auth: false`) — see
  §7.

## 3. Product catalog

- **List / Add / Edit / Delete** (`actions-src/product/{list,get,update,delete}`),
  backed by Adobe I/O State as a local cache, kept in sync via real Adobe I/O Events
  from Commerce (`catalog_product_save_commit_after` / `catalog_product_delete_commit_
  after` → `actions-src/product/events-consumer`, a non-web action).
- **Write-through to Magento**: Add/Edit/Delete make real changes in Commerce via
  OAuth 1.0a (`AdobeCommerceClient`), not just the local cache. New products get a
  default attribute set looked up dynamically.
- **Live search** (`actions-src/product/search`) queries Magento directly (not the
  cache), with pagination. Required hand-building the `searchCriteria` query string
  to work around an `oauth-1.0a` library bug that double-encodes bracketed keys.
- **Category assignment** — multi-select categories on Add/Edit (`actions-src/
  product/categories` flattens Magento's category tree). Magento silently ignores an
  empty `category_ids` array on save (no way to *clear* all categories that way), so
  removed categories are explicitly unlinked via `DELETE /categories/{id}/products/
  {sku}`.
- **Product status (Enable/Disable)** — a `Picker` on Add/Edit. Writing status via
  the public REST API only reaches the "Default Store View" scope, never "All Store
  Views" (a hard Magento REST API limitation, confirmed by testing and documented in
  §6). To get real All-Store-Views sync, `actions-src/product/update` additionally
  drives Magento's own internal Admin "mass status" controller via a scripted admin
  session (login with cookie + CSRF token, same mechanism the Admin UI's own "Change
  status" bulk action uses) — see `actions-src/utils/adobe-commerce/admin-session-
  client.ts`. This is best-effort and never fails the main update if it errors.

## 4. Indexing (`web-src/src/components/Indexing.js`)

Magento has no REST API for triggering a reindex — confirmed by reading Magento's own
source (`bin/magento indexer:reindex` is CLI-only; Admin UI can only flag indexers
invalid or toggle their mode, never actually run one). Solved with a small custom
Magento module:

- **`testapp/app/code/Kinex/Reindex/`** — exposes `GET /V1/kinex-reindex/indexers`,
  `POST /V1/kinex-reindex/jobs` (start a reindex job for given indexer ids, or all if
  empty), `GET /V1/kinex-reindex/jobs/:jobId` (poll status). A detached background
  process (`kinex:reindex:run` CLI command) does the actual work, writing live
  progress to a JSON job file under `var/kinex-reindex-jobs/`.
- Wraps the reindex in Magento maintenance mode (captures the prior on/off state,
  restores it exactly afterward — never a blind disable).
- **App Builder side**: `actions-src/indexer/{list,reindex,reindex-status}`.
- **UI**: table of all indexers with native multi-select (checkboxes), "Select All" /
  "Clear Selection", "Reindex Selected (N)", "Reindex All", and a per-row quick
  "Reindex" button. A live "Running... → Execution completed" panel polls every 2s
  and shows real-time ✓/⏳/○/✗ per indexer.

## 5. Magento Command Manager (`web-src/src/components/CommandManager.js`)

Runs a fixed whitelist of `bin/magento` CLI commands from the app: `setup:upgrade`,
`cache:flush`, `cache:clean`, `setup:static-content:deploy -f`, `setup:di:compile`.
Same async-job architecture as Indexing, in a second custom module:

- **`testapp/app/code/Kinex/CommandManager/`** — `Model/CommandRegistry.php` is a
  hardcoded PHP array (id → argv array), the single source of truth for what's
  runnable; nothing outside that list can ever execute. Commands run as real
  subprocesses (`Symfony\Process`, array-form — never a shell string built from user
  input). `GET /V1/kinex-commands/list`, `POST /V1/kinex-commands/run` (accepts a
  `stopOnFailure` policy), `GET /V1/kinex-commands/status/:jobId`,
  `GET /V1/kinex-commands/history`.
- Same maintenance-mode wrap/restore as Indexing.
- **UI**: checkboxes for each command, Select All/Clear, a "Stop on first failure"
  toggle, a confirmation dialog before running, live per-command progress, and an
  Execution History panel (who ran what, when, with what result).
- Verified every command actually works end-to-end on the real instance, including
  `di:compile` and `static-content:deploy` (full run of all 5 completes in ~60s on
  this instance).

## 6. Real bugs found and fixed along the way

- **Login payload shape mismatch** — frontend sent a flat `{username, password}`
  body; the backend expected it nested under `data` (this codebase's convention for
  any action with a `DataParams<T>` payload). Caught by testing against the real
  deployed action, not just mocks.
- **Status `Picker` showed "Select…" instead of the real value** — `selectedKey`
  was a number while `Item` keys were also numbers; react-spectrum's collection
  matching needs them as strings (same reason the category checkboxes already use
  `String(id)`).
- **Spinner stuck "loading" after an action finished** — in both the product-status
  flow and Indexing, the loading state was being cleared *after* a secondary
  list-refresh call instead of right when the actual action completed, so a slow
  refresh made the UI look hung even though the real work was long done. Fixed by
  decoupling the two, and (for Indexing) by setting the live progress panel
  *optimistically* before the network call even starts, so there's no gap with zero
  feedback.
- **Magento REST↔Admin store-view scoping** — `status` (and other non-global
  attributes) written via the OAuth REST API land on the "Default Store View" scope,
  never "All Store Views" — a genuine Magento platform limitation (not a bug in this
  app), worked around for `status` specifically via the admin-session mechanism in
  §3.
- **Maintenance mode blocking the app's own polling** — enabling Magento maintenance
  mode also blocked this app's own status-polling requests, since everything routes
  through the same local tunnel and Magento saw it all as one address. Fixed by
  allow-listing that address only for the duration of a job, restoring whatever was
  allow-listed before.
- **`Area code is not set` on rule-based indexers** — `catalogrule_*`, `targetrule_*`,
  and `salesrule_rule` failed when reindexed via the custom background CLI worker.
  Confirmed (by testing Magento's own `indexer:reindex` command) that Magento's
  official indexer commands explicitly set the admin area code before reindexing;
  added the same call to the custom worker.
- **Stale generated DI interceptor** — after changing a constructor signature,
  `generated/code/` (not `var/generation/`, the older-version location) held a stale
  interceptor class, causing the *entire* Magento CLI command list to silently
  collapse to a handful of core commands. Fixed by clearing `generated/code/Kinex`
  and re-running `setup:upgrade`.

## 7. Known limitations / deliberately deferred

- **`require-adobe-auth` is `false`** on every action (open/unauthenticated at the
  Adobe I/O Runtime level). This was originally `true`, but Experience Cloud Shell
  login/role-grant issues (`FORBIDDEN_BY_ROLE` for a non-Developer-role user) blocked
  testing, and the explicit decision was made to revert to open rather than keep
  troubleshooting. The custom admin login (§2) gates the *app UI* but not the actions
  themselves.
- **Store-view scoping for `name` and other store-view-scoped EAV attributes** (not
  `status`, which has the admin-session workaround) has no fix — Magento's REST API
  simply cannot write the "All Store Views" scope for these, and there's no
  equivalent Admin mass-action to drive instead.
- **Custom Magento modules depend on internal, unversioned Admin routes/CLI
  behavior** (the admin-session mechanism for status, and nothing — reindex/commands
  use real APIs on a module we own, so those are stable). The admin-session approach
  specifically could break on a Magento upgrade since it's not a public API.
- A separate, unrelated side task this session: installed a fresh Magento 2.4.8-p5
  codebase at `/Users/kinex/Sites/magento248p7` (no DB setup or `setup:install` was
  run — just the Composer install).

## 8. Where things live

| Area | Path |
|---|---|
| App Builder actions | `actions-src/{auth,product,indexer,commands}/` |
| Status-sync admin-session client | `actions-src/utils/adobe-commerce/admin-session-client.ts` |
| Frontend pages | `web-src/src/components/{Login,Dashboard,ProductList,ProductEditDialog,ProductSearchResults,Indexing,CommandManager}.js` |
| Magento module: reindexing | `testapp/app/code/Kinex/Reindex/` |
| Magento module: CLI commands | `testapp/app/code/Kinex/CommandManager/` |
| Tests | `test/*.test.ts` (129 passing) |

---

*Generated as a project recap — see git history / commit messages for exact diffs.*
