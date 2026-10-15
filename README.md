# Magento Catalog Manager (Adobe App Builder)

An Adobe App Builder application for managing an Adobe Commerce / Magento store:
a live sales dashboard, products, orders, customers, categories, indexers, admin
users, scheduled low-stock alerts and a set of whitelisted Magento CLI operations.
It's all driven from one React + Adobe Spectrum UI and TypeScript backend actions,
and uses Magento's default REST API wherever one exists.

## Features

- **Dashboard** — today's sales and order count (in the store's own timezone), plus
  totals for orders, customers, enabled products and active admins, all read live from
  Magento. See [CONFIGURATION.md §5e](CONFIGURATION.md).
- **Products** — list, search, view, edit and delete products, with thumbnails
  (fetched through the authenticated `product/image` proxy).
- **Orders** — search and filter orders, view details and tracking, and cancel, hold
  or release a hold. Default Magento REST only. See [CONFIGURATION.md §5a](CONFIGURATION.md).
- **Notifications** — a bell that shows new orders within about 15 seconds (Adobe I/O
  Events → `order/events-consumer`) and low-stock alerts, with a toast and a sound.
  Duplicates are never shown. See [CONFIGURATION.md §5b](CONFIGURATION.md).
- **Categories** — create, rename, activate/deactivate, toggle `is_anchor`, and
  delete categories (including subcategories), with Magento's own cascading
  delete and protected-root behavior reflected in the UI.
- **Indexing** — reindex a single indexer, a selection, or all indexers, with
  live per-indexer status (pending/running/completed) polled from an async job
  run on the Magento server. Automatically wraps the run in maintenance mode.
- **Command Manager** — run a fixed, whitelisted set of `bin/magento` CLI
  commands (`setup:upgrade`, `cache:flush`, `cache:clean`,
  `setup:static-content:deploy -f`, `setup:di:compile`, maintenance
  enable/disable) from the UI, sequentially, with live progress and history.
- **Customers** — search, view (with addresses), create, and delete Magento
  customers via Magento's default REST API. New customers get Magento's email to
  set their own password; admins never handle customer passwords.
- **Admin Users** — activate and deactivate Magento admin users using Magento's own
  "This account is Active / Inactive" flag. Deactivating also revokes the user's API
  tokens, and the last active admin can't be deactivated.
- **Low-stock alerts** — a scheduled, URL-less (`web: "no"`) action checks stock
  every hour and posts newly low products to the notification bell. See
  [CONFIGURATION.md §5d](CONFIGURATION.md).
- **Storefront stock widget** — the only public action: anonymous shoppers' product
  pages read live stock from your ERP through `storefront/stock`. See
  [CONFIGURATION.md §3](CONFIGURATION.md).
- **Login** — verified against Magento's own admin login
  (`POST /V1/integration/admin/token`); Magento's admin token never reaches the
  browser.
- **Security** — every admin backend action requires a valid Adobe IMS token
  (`require-adobe-auth: true`), so the app must be opened through the Experience
  Cloud Shell. A test fails the build if any web action loses that protection. Errors
  shown to admins are clear and specific but never leak internal detail. See
  [CONFIGURATION.md §1a](CONFIGURATION.md).

Four features need a small companion Magento module on the Commerce instance, because
Magento has no REST API for them and Adobe I/O Runtime actions can't run
`bin/magento` or touch the server's files:

| Module | Used by | Why |
|---|---|---|
| `Kinex_Reindex` | Indexing | no REST API to run a reindex |
| `Kinex_CommandManager` | Command Manager | runs a fixed whitelist of `bin/magento` commands |
| `Kinex_StorefrontStock` | Storefront stock widget | serves the widget's ERP settings, with the key decrypted server-side |
| `Kinex_ZLF31QCAN` | Admin Users, Dashboard | Magento has no admin-user REST API; the module only reads/writes Magento's native `is_active` |

Everything else uses Magento's default REST API. The modules live in the Magento
codebase (`testapp/app/code/Kinex/`), not in this repo. See
[CONFIGURATION.md §5](CONFIGURATION.md).

## Documentation

- **[CONFIGURATION.md](CONFIGURATION.md)** — every credential and URL the app
  uses: what it is, where to get it, where to set it (file + env var), with
  example comments.
- **[AIO_CLI_REFERENCE.md](AIO_CLI_REFERENCE.md)** — reference for the `aio`
  CLI commands used to develop and deploy this project.
- **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** — full project walkthrough:
  setup, features, architecture decisions, and bugs fixed along the way.
- **[GO_LIVE.md](GO_LIVE.md)** — what's needed to move from the Stage workspace to
  production: what's already done, and what's left for the Adobe, Magento and code
  sides.

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone git@github.com:karamdeep-git/app-builder-tutorial.git
   cd app-builder-tutorial
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Connect to Adobe App Builder**:

   Select the Organization > Project > Workspace for this project:

   ```bash
   aio login
   aio console org select
   aio console project select
   aio console workspace select
   ```

   Sync your local application with the App Builder project:

   ```bash
   aio app use
   # Choose the option 'm' (merge)
   ```

4. **Configure environment**:

   ```bash
   cp env.sample .env
   # Edit .env with your Adobe Commerce credentials — see CONFIGURATION.md
   ```

5. **Build the project**:

   ```bash
   npm run build
   ```

   For development, use watch mode to rebuild on file changes:

   ```bash
   npm run watch
   ```

6. **Run tests**:

   ```bash
   npm test
   ```

7. **Deploy to Adobe App Builder**:

   ```bash
   aio app deploy
   ```

8. **Open the app through Experience Cloud**, using the full link `aio app deploy`
   prints. The bare `adobeio-static.net` URL only shows an "Open in Experience Cloud"
   screen, because every action needs your Adobe sign-in. Bookmark the full link, not
   the address bar: after loading, Experience Cloud shortens the address and drops the
   `localDevUrl=` part, and reloading that shortened address fails.

   ```text
   https://experience.adobe.com/?devMode=true#/@kinexmedia/custom-apps/?localDevUrl=https://4033606-testknm-stage.adobeio-static.net/index.html
   ```

## Project Structure

```
app-builder-tutorial/
├── actions-src/                    # TypeScript source for backend actions
│   ├── auth/                       # Admin login (verified by Magento)
│   ├── dashboard/                  # Headline numbers for the Dashboard
│   ├── product/                    # Product list/get/search/update/delete, image
│   │                               # proxy, categories lookup, events consumer
│   ├── order/                      # Order search/get/cancel/hold/unhold,
│   │                               # new-order events consumer
│   ├── notifications/              # Bell: list, mark-read (Adobe I/O State)
│   ├── customer/                   # Customer list/get/create/delete/options
│   ├── category/                   # Category list/get/create/update/delete
│   ├── indexer/                    # Indexer list, async reindex + status
│   ├── commands/                   # Whitelisted CLI command runner
│   │   └── list/run/status/history
│   ├── admin-users/                # Admin user list/activate/deactivate
│   ├── inventory/                  # Scheduled low-stock check (web: "no")
│   ├── storefront/                 # Public stock lookup for the storefront widget
│   ├── logger.ts, responses.ts     # Shared logging/response helpers
│   ├── types/                      # Shared TypeScript types
│   └── utils/
│       ├── adobe-commerce/         # OAuth 1.0a Commerce REST client, shared error
│       │                           # mapping (errors.ts), searchCriteria builder
│       ├── io-auth/                # Adobe IMS authentication
│       ├── io-events/              # Adobe IO Events publishing
│       ├── lib-files/              # Adobe I/O lib-files storage
│       └── lib-state/              # Adobe I/O lib-state storage
├── actions/                        # Compiled JavaScript (generated, deployed)
├── web-src/src/
│   ├── components/                 # React + Adobe Spectrum UI
│   │   ├── App.js, SideBar.js      # Shell, routing, navigation, notification polling
│   │   ├── Login.js, Dashboard.js
│   │   ├── ProductList.js, ProductEditDialog.js
│   │   ├── OrderList.js, OrderDetail.js
│   │   ├── CustomerManager.js, CustomerDetail.js, CustomerCreateDialog.js
│   │   ├── CategoryManager.js, Indexing.js, CommandManager.js
│   │   ├── AdminUserManager.js, NotificationBell.js
│   ├── utils.js                    # actionWebInvoke + describeError (clear error text)
│   ├── notificationText.js         # Low-stock notification wording
│   └── notificationSound.js        # New-order chime
├── packages/commerce-sdk-auth/     # Local package: Commerce SDK auth helper
├── test/                           # Jest tests (one suite per action, plus the
│                                   # security-config and error-mapping suites)
├── app.config.yaml                 # App Builder manifest (packages/actions)
├── package.json
└── tsconfig*.json
```

## TypeScript Configuration

### Source Code Organization

Unlike typical Adobe App Builder projects where source code lives directly in
`actions/`, this project uses a TypeScript workflow:

- **Source code**: `actions-src/` — all TypeScript files
- **Compiled output**: `actions/` — compiled JavaScript (generated by the build)
- **Adobe App Builder**: deploys only from `actions/`

### TypeScript Configuration Files

- **`tsconfig.json`**: main configuration with CommonJS module system
- **`tsconfig.cjs.json`**: CommonJS-specific configuration
- **`tsconfig.es.json`**: ES modules configuration
- **`tsconfig.types.json`**: type declaration generation

The build compiles TypeScript from `actions-src/` to JavaScript in `actions/`;
`app.config.yaml` always points at the compiled `actions/` paths, never at
`actions-src/`.

## Backend Packages

Each package below is a directory under `actions-src/`, wired into
`app.config.yaml` via `$include: ./actions-src/<package>/actions.config.yaml`:

| Package | Actions |
| --- | --- |
| `auth` | `login` |
| `dashboard` | `stats` |
| `product` | `list`, `get`, `search`, `update`, `delete`, `image`, `categories`, `events-consumer` (non-web) |
| `order` | `search`, `get`, `cancel`, `hold`, `unhold`, `events-consumer` (non-web) |
| `notifications` | `list`, `mark-read` |
| `customer` | `list`, `get`, `create`, `delete`, `options` |
| `category` | `list`, `get`, `create`, `update`, `delete` |
| `indexer` | `list`, `reindex`, `reindex-status` |
| `commands` | `list`, `run`, `status`, `history` |
| `admin-users` | `list`, `activate`, `deactivate` |
| `inventory` | `low-stock-check` (non-web, runs hourly via an alarms trigger) |
| `storefront` | `stock` (the only public web action) |

Every web action except `storefront/stock` has `require-adobe-auth: true`.

## Adobe Commerce Integration

Backend actions talk to Adobe Commerce via `AdobeCommerceClient`
(`actions-src/utils/adobe-commerce/adobe-commerce-client.ts`), which supports:

1. **OAuth 1.0a** — the authentication method this project uses against the
   Commerce REST API.
2. **IMS (Identity Management System)** — supported for SaaS Commerce setups.

### Usage Example

```typescript
import { AdobeCommerceClient } from "../utils/adobe-commerce/adobe-commerce-client";

export async function main(params: CategoryGetParams): Promise<AppResponse> {
  const client = AdobeCommerceClient.create(params, {
    storeCode: "default",
    storeUrl: params.COMMERCE_BASE_URL,
  });

  const category = await client.get(`/categories/${params.categoryId}`);

  return successResponse("Category", { category });
}
```

## Development Workflow

### Available Scripts

```bash
# Build TypeScript to JavaScript
npm run build

# Watch for changes and rebuild
npm run watch

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Development Process

1. **Write TypeScript** in `actions-src/`
2. **Build** with `npm run build` (or `npm run watch` during development)
3. **Test** with `npm test`
4. **Deploy** with `aio app deploy` — Adobe App Builder uses the compiled
   JavaScript in `actions/`

## Environment Variables

See [CONFIGURATION.md](CONFIGURATION.md) for the full reference (what each
value is, where to get it, and where it's set). Summary:

### Adobe Commerce (OAuth 1.0a)

- `COMMERCE_BASE_URL`, `COMMERCE_CONSUMER_KEY`, `COMMERCE_CONSUMER_SECRET`,
  `COMMERCE_ACCESS_TOKEN`, `COMMERCE_ACCESS_TOKEN_SECRET`

### Adobe IMS

- `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_TECHNICAL_ACCOUNT_ID`,
  `OAUTH_TECHNICAL_ACCOUNT_EMAIL`, `OAUTH_ORG_ID`, `OAUTH_SCOPES`, `OAUTH_HOST`

### Adobe IO Events

- `IO_MANAGEMENT_BASE_URL`, `IO_CONSUMER_ID`, `IO_PROJECT_ID`, `IO_WORKSPACE_ID`

## Testing

Jest with TypeScript support, one suite per action, mocking `axios` for
Commerce API calls:

```typescript
// test/category-get.test.ts
import { main } from "../actions-src/category/get";

describe("category get action", () => {
  it("extracts is_anchor out of custom_attributes as a boolean", async () => {
    // ...
  });
});
```

Run the full suite with `npm test` (47 suites, 382 tests at the time of writing).
Two suites guard the whole app rather than one action:

- `test/security-config.test.ts` reads every `actions.config.yaml` through
  `app.config.yaml`. It fails if any web action is missing `require-adobe-auth: true`,
  unless that action is on its short, explained allow-list (only `storefront/stock`).
- `test/action-error-mapping.test.ts` checks that every older package returns the
  shared, specific error responses instead of a raw `500`.
