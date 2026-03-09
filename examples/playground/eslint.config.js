import uxlint from "eslint-plugin-uxlint";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      uxlint,
    },
    rules: {
      "uxlint/apply": "warn",
    },
  },
];
