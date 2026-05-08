import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "artifacts/**",
      "data/**",
      "public/app.css",
      "thoughts/**",
      "*.sqlite",
      "*.sqlite-*",
    ],
  },
  {
    files: ["**/*.{js,mjs,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      // TODO(phase-0a): tighten — downgraded to keep Phase 0a baseline green;
      // phases that rebuild these surfaces will adopt next/link + next/image.
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    // Architectural boundary: src/ must stay framework-free
    files: ["src/**/*.{js,mjs,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-dom", "react-dom/*"],
              message:
                "src/ must remain framework-agnostic. Move framework code into app/ (server.mjs is frozen).",
            },
          ],
        },
      ],
    },
  },
];
