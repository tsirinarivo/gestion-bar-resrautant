/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: true
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/require-await": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "build/",
    "coverage/",
    "*.js",
    "*.mjs",
    "*.cjs"
  ]
};
