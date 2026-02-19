module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  moduleNameMapper: {
    "^@velogen/shared$": "<rootDir>/../../packages/shared/src/index.ts"
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "coverage",
  testEnvironment: "node"
};
