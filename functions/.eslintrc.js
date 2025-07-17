module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint"
  ],
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    ".eslintrc.js",
  ],
  rules: {
    "quotes": ["error", "double"],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "warn",
  },
}; 