export default {
  preset: "ts-jest/presets/default-esm", // Use this preset for ESM support
  globals: {
    "ts-jest": {
      useESM: true,
      tsconfig: "./tsconfig.json", // Or directly embed necessary options here
    },
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1", // Redirect JS imports to the original TS files
  },
  clearMocks: true,
  moduleFileExtensions: ["js", "ts", "cjs", "mjs"],
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testRunner: "jest-circus/runner",
  // transformIgnorePatterns: ["node_modules/(?!lodash-es/)"],
  transform: {
    // "^.+\\.(ts|tsx|js|jsx)$": "babel-jest",
  },
  verbose: true,
}
