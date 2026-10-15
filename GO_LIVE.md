# Going live — from Stage to production

What's needed to move Magento Catalog Manager from the **Stage** workspace (talking to
the local `testapp` Magento through ngrok) to **Production** (talking to the real store).
Items marked ✅ are already done in this repo.

## 1. Code (this repo)

- ✅ Every admin web action requires an Adobe IMS token (`require-adobe-auth: true`),
  enforced by `test/security-config.test.ts`.
- ✅ Shared, specific error responses everywhere; no internal error text reaches the
  browser (`actions-src/utils/adobe-commerce/errors.ts`).
- ✅ Login doesn't send Magento's admin token to the browser.
- ✅ App Builder template pages (Home, About, "Your App Actions") removed.
- ✅ `index.html` served `no-cache`, so deploys show up on the next page load.
- ✅ Duplicate notifications can't appear (see `CONFIGURATION.md` §5d).
- ⬜ **Commit everything**, in both this repo and the Magento project
  (`testapp/app/code/Kinex/*`).
- ⬜ **Fix the product event codes**: `EventCode.PRODUCT_SAVED`/`PRODUCT_DELETED` in
  `actions-src/utils/io-events/adobe-events-api.ts` have an extra `_commit`, so
  `product/events-consumer` ignores every real event (`CONFIGURATION.md` §5b).
- ⬜ **Lower log levels**: most packages still declare `LOG_LEVEL: debug`, and their
  actions call `initializeLogger("process-function")`, which always uses `debug`. At
  debug, order searches write customer emails into logs. Customer, dashboard and
  inventory actions already run at `info`; do the same for the rest.
- ⬜ Optional: give the older actions the 15s Commerce timeout the customer and
  dashboard actions use (`timeoutMs` in `AdobeCommerceClient.create`). Check slow
  operations (product save, category delete) first.

## 2. Adobe side

- ⬜ `aio app use` → pick the **Production** workspace of the TestKnm project. It has its
  own namespace, URLs and OAuth Server-to-Server credential, written into `.env`/`.aio`.
- ⬜ Put the **production Magento** values in `.env` (section 3 below), then
  `aio app deploy`.
- ⬜ Recreate the **Adobe I/O Events registration** in the Production workspace (it's
  per workspace): Commerce provider → `com.adobe.commerce.observer.sales_order_place_after`
  → runtime action `order/events-consumer`. Without it, there are no new-order
  notifications.
- ⬜ **Submit for approval** in Developer Console (Production workspace). Your org's
  System Admin approves it. It then appears in Experience Cloud's app list, with no
  `devMode` link and no "No Apps available" message.
- ⬜ **Access:** users need to be in the org and on the workspace's product profiles
  (Adobe Admin Console). The IMS validator rejects anyone else with a 401.
- ⬜ Optional: log forwarding (Splunk, New Relic, Azure, …) for the Production namespace.

## 3. Production Magento

- ⬜ **Public HTTPS URL** in `COMMERCE_BASE_URL` (trailing slash), not ngrok.
- ⬜ **New Integration** (System → Extensions → Integrations) on the live store, which
  gives new OAuth keys. Grant only what the app uses, not "All". The resources
  confirmed in this codebase are:
  - `Magento_Customer::customer`, `::manage`, `::delete`, `::group`
  - `Magento_Catalog::products`, `::categories`, `::catalog_inventory`
  - `Magento_Backend::store`
  - Sales: order view, cancel, hold/unhold, and shipments (tick them in the
    Integration's resource tree)
  - `Kinex_Reindex::reindex`, `Kinex_CommandManager::execute`,
    `Kinex_StorefrontStock::api`, `Kinex_ZLF31QCAN::api`

  Then test every page, since a missing resource shows up as "This app's Magento
  integration isn't allowed to perform this operation."
- ⬜ **Install the Kinex modules** through the store's normal deploy pipeline
  (`setup:upgrade`, `setup:di:compile`, `setup:static-content:deploy` in production
  mode). `Kinex_ZLF31QCAN` no longer needs a post-install activation step.
- ⬜ **Decide on Command Manager in production:** it runs `bin/magento` commands
  (`setup:upgrade`, `di:compile`, …) on the live server. It's whitelisted and wrapped in
  maintenance mode, but it's still a powerful button.
- ⬜ **Magento health** — each of these broke on `testapp`:
  - cron installed (`bin/magento cron:install`), or events and notifications never send
  - caches enabled
  - search engine matches what's actually running (OpenSearch 2.x is the supported
    version for 2.4.7)
  - Adobe I/O Events: module enabled, `events:generate:module` + `setup:di:compile` run,
    `events:subscribe observer.sales_order_place_after` with the `order.`-prefixed
    fields (`CONFIGURATION.md` §5b)
- ⬜ **Storefront stock widget** (Stores → Configuration → General → Storefront Stock
  Widget): the Production `storefront/stock` URL, the real storefront origin, and the
  ERP URL/key.
- ⬜ `app.config.yaml` declares `COMMC` 2.4.4–2.4.8; the live store must be in that range.

## 4. Verify after the production deploy

```bash
# Every admin action refuses calls without an Adobe token:
curl -i https://<prod-namespace>.adobeio-static.net/api/v1/web/order/search        # -> 401

# The dashboard reads the live store:
aio rt action invoke dashboard/__secured_stats --result

# The hourly low-stock schedule exists and is active:
aio rt trigger list && aio rt rule list

# Then, in the app: log in, open each page, place a test order and watch the bell.
```

## 5. Rolling back

Redeploy the previous commit (`git checkout <commit> && aio app deploy`). Magento-side
module changes roll back with the Magento project's own git history plus
`setup:upgrade`. The `Kinex_ZLF31QCAN` migration only sets `admin_user.is_active`, which
you can also change back in Magento Admin.
