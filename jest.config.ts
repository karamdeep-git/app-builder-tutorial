export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  // node-fetch v3 is ESM-only and breaks ts-jest's CommonJS transform when a
  // module importing it (e.g. adobe-events-api.ts) is pulled into a test.
  moduleNameMapper: {
    "^node-fetch$": "<rootDir>/test/__mocks__/node-fetch.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
