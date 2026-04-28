import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest/jest.setup.js"],
  testRegex: String.raw`.*\.test\.ts$`,
  testPathIgnorePatterns: ["/node_modules/"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json", "json-summary"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results",
        outputName: "junit.xml",
        addFileAttribute: true,
        reportTestSuiteErrors: true,
      },
    ],
  ],
  moduleNameMapper: {
    "^@hometest-service/shared/(.*)$": "<rootDir>/../shared/$1",
    "^@middy/(.*)$": "<rootDir>/node_modules/@middy/$1/index.js",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: { module: "CommonJS" },
      },
    ],
    "^.+\\.jsx?$": ["babel-jest", { configFile: "./babel.config.cjs" }],
  },
  transformIgnorePatterns: [
    String.raw`/node_modules/(?!(\.pnpm/)?(@middy|uuid|@aws-sdk))`, // add ESM packages here
  ],
};
export default config;
