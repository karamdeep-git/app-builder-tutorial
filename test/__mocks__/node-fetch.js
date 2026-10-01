// node-fetch v3 is ESM-only, which ts-jest's CommonJS transform can't parse.
// Nothing under test actually calls fetch, so a plain stub is enough to let
// modules that import node-fetch (e.g. adobe-events-api.ts) load under Jest.
function fetch() {
  throw new Error("node-fetch is mocked in tests; do not call it");
}

module.exports = fetch;
module.exports.default = fetch;
