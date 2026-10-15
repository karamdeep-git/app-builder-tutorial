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

Custom login gate for the app itself, layered on top of Adobe's own IMS auth
(`require-adobe-auth: true` on every admin web action — see `CONFIGURATION.md` §1a).

- **`actions-src/auth/login`** — validates a username/password against Magento's own
  admin token endpoint (`POST /rest/V1/integration/admin/token`). Real Magento admin
  credentials are required to log in; there's no separate user store.
- **`web-src/src/components/Login.js`** / **`Dashboard.js`** — full-page login,
  redirects to a dashboard landing page on success.
- Session persisted in `sessionStorage` (cleared on tab close). The whole app (sidebar,
  all pages) is hidden until logged in.
- **Scope note**: this login gates the *app's UI*; the actions themselves are
  protected by the IMS validator (`require-adobe-auth: true`), so they can't be
  called directly without a valid Adobe token for the org — see §7.

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

## 5a. Customer Management (`web-src/src/components/CustomerManager.js`)

Search, view, create and delete Magento customers, entirely through Magento's
default REST API (no custom module). Details, endpoint table and error mapping are in
`CONFIGURATION.md` §5c.

- Replaced four leftover template actions that stored "customers" in Adobe I/O State
  and never reached Magento.
- Create sends no password: Magento emails the customer a set-password link.
- Added a shared `commerceErrorResponse` helper (specific 400/404/429/502/504
  responses instead of a blanket 500), a shared `buildSearchCriteriaQuery`, and an
  optional `timeoutMs` on `AdobeCommerceClient`. The error helper was later rolled out
  to every web action (and `describeError()` to every page); the timeout is still
  opt-in, customer actions only.
- Removed the App Builder template pages (Home, About, "Your App Actions") from the
  menu, routes and codebase.
- Customer search terms and Magento error values are kept out of error-level logs.

## 5b. Scheduled low-stock alerts (`actions-src/inventory/low-stock-check`)

A `web: "no"` action with no URL, run every 60 minutes by an Adobe I/O Runtime alarms
trigger declared in `app.config.yaml`. It finds products at or below 5 units through
Magento's default `GET /V1/stockItems/lowStock`, filters out parents, untracked and
disabled products, and posts one notification per run to the existing bell, only for
products that are newly low. Notifications gained a `type` (`order` | `low_stock`),
and older entries still read as orders. Demo and details are in `CONFIGURATION.md` §5d.

Also found and fixed while testing the Customers page: 17 of 18 Magento caches on
`testapp` were disabled, so every request (and every per-minute cron process) rebuilt
Magento's config from scratch. Requests took 15–33s and the machine load was ~53.
`bin/magento cache:enable` brought requests to ~0.05s.

## 5c. Orders and notifications (`OrderList.js`, `NotificationBell.js`)

- **Orders:** search (order #, name, email), status and date filters, a detail
  dialog with addresses, items, totals and tracking, and cancel / hold / release
  buttons. All of it uses Magento's default REST (`GET /V1/orders`,
  `POST /V1/orders/{id}/cancel|hold|unhold`). There's no free-form status change,
  because Magento has no default way to do one. Details in `CONFIGURATION.md` §5a.
- **New-order notifications:** Magento's `sales_order_place_after` event goes through
  Adobe I/O Events to the non-web `order/events-consumer`, which stores the
  notification in Adobe I/O State. The app polls every 15s and toasts new arrivals
  with a chime. Getting events to actually flow needed three Magento-side fixes:
  cron wasn't installed, the event plugin was never generated, and the field paths
  needed an `order.` prefix. Details in `CONFIGURATION.md` §5b, including what the
  registration's **journaling endpoint** is for.

## 5d. Admin Users (`AdminUserManager.js`, `Kinex_ZLF31QCAN`)

Activate and deactivate Magento admin users using **Magento's own
`admin_user.is_active` flag**, the same "This account is Active / Inactive" setting as
System → Permissions → All Users. Magento has no REST API for admin users at all
(`Magento_User` ships no `webapi.xml`), so `Kinex_ZLF31QCAN` is only that missing API:

- Earlier versions kept a second status in their own `zlf31qcan` table, plus a login
  observer that required both. That was replaced: a one-time data patch moved anyone
  the old status was blocking to native `is_active = 0`, so nobody regained access.
  The old table is left in place, unused.
- Deactivating also revokes the user's existing admin API tokens, since Magento only
  checks `is_active` when issuing a new one. The API refuses to deactivate the last
  active admin.
- Verified live: last-admin refusal (400), activate/deactivate round trip, unknown id
  (404).

## 5e. Dashboard (`Dashboard.js`, `actions-src/dashboard/stats`)

A hero figure for **today's sales** (store timezone, base currency, canceled orders
excluded) with today's order count, plus tiles for total orders, customers,
**enabled products** (replacing the old "Cached products" count, which came from this
app's own cache) and active admins. One action loads every section in parallel, and
each section fails on its own with its reason. Details in `CONFIGURATION.md` §5e.

## 5f. Security hardening and error handling

- **`require-adobe-auth: true`** on every admin web action, enforced by
  `test/security-config.test.ts`. See `CONFIGURATION.md` §1a.
- **Login** no longer sends Magento's admin token to the browser. Magento issuing it
  proves the password is right; the app only needs the username.
- **`product/image`**: `..` path traversal blocked (its old pattern allowed it), and
  responses marked `Cache-Control: private`.
- **Errors:** every web action uses the shared `commerceErrorResponse`
  (400/404/429/502/504 with a clear message) instead of `500 Request failed: <raw
  internal error>`, and every page shows that message via `describeError()`. The
  public `storefront/stock` only ever answers "Stock information is unavailable".
- **Customer data in logs:** customer actions log at `info`, and URLs with search
  terms, plus Magento error bodies, only appear at `debug`.
- **`index.html` is served `no-cache`** (`web.response-headers` in
  `app.config.yaml`), so a deploy is picked up on the next page load.
- **Template pages removed:** Home, About and "Your App Actions" are gone.

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
- **Duplicate low-stock alerts** — the alarms trigger fires right after every deploy,
  and a manual run started one second later. Both read the "already alerted" list
  before either saved it. Adobe I/O State has no compare-and-set, so the job now skips
  an identical alert from the last 60s, and `loadNotifications()` collapses duplicates
  on every read.
- **Old app still showing after a deploy** — `index.html` had no `Cache-Control`, so
  Chrome reused an old copy for hours, and that copy loaded the old JS bundle. Fixed
  with `web.response-headers` (`no-cache` for `*.html`).
- **"Failed to load page" / "No Apps available" in Experience Cloud** — after loading,
  Experience Cloud shortens the address and drops `localDevUrl=`. Reloading or
  bookmarking that shortened address loses the app. Always open the full link.
- **Catalog Search reindex: "No alive nodes found in your cluster"** — Magento's engine
  was locked to `elasticsearch7` on port 9250 in `app/etc/config.php`, and nothing
  runs there. Homebrew OpenSearch runs on 9200, so the engine is now overridden in
  `env.php` (`config:set --lock-env catalog/search/engine opensearch`).
- **Slow deploys** — on some days Adobe I/O Runtime accepted action uploads at 20–50s
  each instead of about 5s, making a deploy take about 25 minutes. Not caused by the
  code (bundle sizes unchanged); the deploy only looks frozen because its output is
  buffered.

## 7. Known limitations / deliberately deferred

- **`require-adobe-auth` is `true`** on every admin web action (restored after an
  earlier revert to `false`, when Experience Cloud Shell role-grant issues —
  `FORBIDDEN_BY_ROLE` for a non-Developer-role user — blocked testing). The app must
  now be opened through the Experience Cloud Shell, and that role issue, if it
  recurs for a user, has to be fixed in Adobe Admin Console. The only public web
  action is `storefront/stock` (anonymous storefront shoppers have no IMS token);
  `test/security-config.test.ts` fails if any other web action loses the
  annotation. Details in `CONFIGURATION.md` §1a.
- **Store-view scoping for `name` and other store-view-scoped EAV attributes** (not
  `status`, which has the admin-session workaround) has no fix — Magento's REST API
  simply cannot write the "All Store Views" scope for these, and there's no
  equivalent Admin mass-action to drive instead.
- **Custom Magento modules depend on internal, unversioned Admin routes/CLI
  behavior** (the admin-session mechanism for status, and nothing — reindex/commands
  use real APIs on a module we own, so those are stable). The admin-session approach
  specifically could break on a Magento upgrade since it's not a public API.
- **Product events are silently ignored** — `EventCode.PRODUCT_SAVED`/`PRODUCT_DELETED`
  in `actions-src/utils/io-events/adobe-events-api.ts` carry an erroneous `_commit`, so
  `product/events-consumer` no-ops on every real event. This predates this work, is
  documented in `CONFIGURATION.md` §5b and listed in `GO_LIVE.md`.
- **Notifications share one Adobe I/O State key** — a read-modify-write with no
  locking, so two writers at the same instant can lose an update. Duplicates are
  handled; a lost update is accepted at this scale.
- **Dashboard "today"** uses the store timezone's offset at the moment of the request,
  so on DST-change days it can start an hour early or late. Today's sales are summed
  over at most 3,000 orders (`partial: true` past that).
- **Unused `zlf31qcan` table** — left in the database on purpose (dropping it deletes
  data); safe to remove in a later cleanup.
- **OpenSearch 3.7 vs Magento 2.4.7** — Magento officially supports OpenSearch 2.x.
  Indexing and search work, but if storefront search misbehaves, install 2.x.
- A separate, unrelated side task this session: installed a fresh Magento 2.4.8-p5
  codebase at `/Users/kinex/Sites/magento248p7` (no DB setup or `setup:install` was
  run — just the Composer install).

## 8. Where things live

| Area | Path |
|---|---|
| App Builder actions | `actions-src/{auth,dashboard,product,order,notifications,customer,category,indexer,commands,admin-users,inventory,storefront}/` |
| Shared Commerce error mapping | `actions-src/utils/adobe-commerce/errors.ts` (`commerceErrorResponse`, `describeCommerceError`) |
| Shared searchCriteria builder | `actions-src/utils/adobe-commerce/search-criteria.ts` |
| Status-sync admin-session client | `actions-src/utils/adobe-commerce/admin-session-client.ts` |
| Frontend pages | `web-src/src/components/{Login,Dashboard,ProductList,OrderList,CustomerManager,CategoryManager,Indexing,CommandManager,AdminUserManager}.js` |
| Frontend error text | `web-src/src/utils.js` (`describeError`) |
| Schedule (alarms trigger + rule) | `app.config.yaml` → `inventory` package |
| Magento module: reindexing | `testapp/app/code/Kinex/Reindex/` |
| Magento module: CLI commands | `testapp/app/code/Kinex/CommandManager/` |
| Magento module: storefront stock config | `testapp/app/code/Kinex/StorefrontStock/` |
| Magento module: admin users API | `testapp/app/code/Kinex/ZLF31QCAN/` |
| Security regression test | `test/security-config.test.ts` |
| Tests | `test/*.test.ts` (47 suites, 382 passing) |
| Going to production | `GO_LIVE.md` |

---

*Generated as a project recap — see git history / commit messages for exact diffs.*
