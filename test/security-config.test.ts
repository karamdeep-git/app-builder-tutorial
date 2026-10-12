import fs from "fs";
import path from "path";

// No @types/js-yaml in this project - only `load` is needed here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require("js-yaml") as { load: (src: string) => unknown };

interface ActionConfig {
  web?: string | boolean;
  annotations?: Record<string, unknown>;
}

interface PackageConfig {
  actions?: Record<string, ActionConfig> & { $include?: string };
}

const ROOT = path.resolve(__dirname, "..");

// Web actions that are deliberately reachable without an Adobe IMS token.
// Adding to this list is a security decision - document the reason next to
// the action in its actions.config.yaml as well.
const PUBLIC_WEB_ACTIONS: Record<string, string> = {
  "storefront/stock": "called by anonymous storefront shoppers, who have no IMS token",
};

function loadYaml<T>(file: string): T {
  return yaml.load(fs.readFileSync(file, "utf8")) as T;
}

function isWebAction(action: ActionConfig): boolean {
  const web = action.web ?? action.annotations?.["web-export"];
  return web === true || web === "yes" || web === "raw";
}

// Mirrors how aio resolves the manifest: every package under
// application.runtimeManifest.packages, with `$include` expanded relative to
// app.config.yaml. Reading it from app.config.yaml (not a hardcoded list)
// means a newly added package is covered automatically.
function loadAllActions(): Array<{ id: string; action: ActionConfig }> {
  const appConfig = loadYaml<{ application: { runtimeManifest: { packages: Record<string, PackageConfig> } } }>(
    path.join(ROOT, "app.config.yaml")
  );

  return Object.entries(appConfig.application.runtimeManifest.packages).flatMap(([pkgName, pkg]) => {
    const actions = pkg.actions?.$include
      ? loadYaml<Record<string, ActionConfig>>(path.join(ROOT, pkg.actions.$include))
      : (pkg.actions ?? {});
    return Object.entries(actions).map(([actionName, action]) => ({ id: `${pkgName}/${actionName}`, action }));
  });
}

describe("action security configuration", () => {
  const allActions = loadAllActions();
  const webActions = allActions.filter(({ action }) => isWebAction(action));

  it("finds the app's actions (guards against this test silently checking nothing)", () => {
    expect(webActions.length).toBeGreaterThan(30);
  });

  it.each(webActions.filter(({ id }) => !(id in PUBLIC_WEB_ACTIONS)).map(({ id, action }) => [id, action]))(
    "%s requires an Adobe IMS token",
    (_id, action) => {
      expect((action as ActionConfig).annotations?.["require-adobe-auth"]).toBe(true);
    }
  );

  it.each(Object.keys(PUBLIC_WEB_ACTIONS))("allow-listed public action %s still exists as a web action", (id) => {
    expect(webActions.map((a) => a.id)).toContain(id);
  });
});
