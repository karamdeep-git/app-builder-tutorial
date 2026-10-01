# Magento Catalog Manager (Adobe App Builder)

An Adobe App Builder application for managing an Adobe Commerce / Magento store:
products, categories, indexers, and a set of whitelisted Magento CLI operations,
all driven from a single React + Adobe Spectrum UI and TypeScript backend actions.

## Features

- **Products** — list, search, view, edit, and delete products.
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
- **Customers** — list, view, create, and delete customers.
- **Login** — admin session login against Adobe Commerce, used to gate the app.

The Indexing and Command Manager features require a small companion Magento
module (`Kinex_Reindex` / `Kinex_CommandManager`) installed on the Commerce
instance, since Adobe I/O Runtime actions have no direct process/filesystem
access to run `bin/magento` commands or read indexer state — see
[SESSION_SUMMARY.md](SESSION_SUMMARY.md) for how those are wired up.

## Documentation

- **[CONFIGURATION.md](CONFIGURATION.md)** — every credential and URL the app
  uses: what it is, where to get it, where to set it (file + env var), with
  example comments.
- **[AIO_CLI_REFERENCE.md](AIO_CLI_REFERENCE.md)** — reference for the `aio`
  CLI commands used to develop and deploy this project.
- **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** — full project walkthrough:
  setup, features, architecture decisions, and bugs fixed along the way.

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

## Project Structure

```
app-builder-tutorial/
├── actions-src/                    # TypeScript source for backend actions
│   ├── auth/                       # Admin login
│   ├── customer/                   # Customer list/get/create/delete
│   ├── product/                    # Product list/get/search/update/delete,
│   │                                # categories lookup, events consumer
│   ├── category/                   # Category list/get/create/update/delete
│   ├── indexer/                    # Indexer list, async reindex + status
│   ├── commands/                   # Whitelisted CLI command runner
│   │   └── list/run/status/history
│   ├── logger.ts, responses.ts     # Shared logging/response helpers
│   ├── types/                      # Shared TypeScript types
│   └── utils/
│       ├── adobe-commerce/         # OAuth 1.0a Commerce REST client
│       ├── io-auth/                # Adobe IMS authentication
│       ├── io-events/              # Adobe IO Events publishing
│       ├── lib-files/              # Adobe I/O lib-files storage
│       └── lib-state/              # Adobe I/O lib-state storage
├── actions/                        # Compiled JavaScript (generated, deployed)
├── web-src/src/components/         # React + Adobe Spectrum UI
│   ├── App.js, SideBar.js          # Shell, routing, navigation
│   ├── ProductList.js, ProductEditDialog.js, ProductSearchResults.js
│   ├── CategoryManager.js
│   ├── Indexing.js
│   ├── CommandManager.js
│   ├── Dashboard.js, Home.js, About.js, Login.js, ActionsForm.js
├── packages/commerce-sdk-auth/     # Local package: Commerce SDK auth helper
├── test/                           # Jest tests (one suite per action)
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

| Package    | Actions                                              |
| ---------- | ----------------------------------------------------- |
| `auth`     | `login`                                                |
| `customer` | `list`, `get`, `create`, `delete`                      |
| `product`  | `list`, `get`, `search`, `update`, `delete`, `categories`, `events-consumer` |
| `category` | `list`, `get`, `create`, `update`, `delete`            |
| `indexer`  | `list`, `reindex`, `reindex-status`                    |
| `commands` | `list`, `run`, `status`, `history`                     |

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

Run the full suite with `npm test`.
