import js from "@eslint/js";
import globals from "globals";
import nextConfig from "eslint-config-next";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/generated/**",
      "**/artifacts/**",
      "**/cache/**",
      "**/dist/**",
      "**/coverage/**",
      "**/build/**",
      "**/*.generated.*",
      "**/imports/**",
      "**/site/**",
      "**/src/**",
    ],
  },
  js.configs.recommended,
  ...nextConfig,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": "warn",
      "no-useless-escape": "warn",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: { globals: { ...globals.mocha } },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
    },
  },
];
