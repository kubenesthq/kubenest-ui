// Next 16 removed `next lint`; lint runs via the ESLint CLI against this flat
// config. `eslint-config-next` v16 ships native flat-config arrays, so they're
// imported directly (the old FlatCompat shim breaks under ESLint 9).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
      "artifacts/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Pre-existing debt that predates this lint config being runnable at all
    // (lint was broken since the Next 16 upgrade). Kept visible as warnings, not
    // build-breaking errors; a follow-up bead tracks the cleanup. New code
    // should still be clean. The first two are React-Compiler-era react-hooks
    // v7 rules — advisory for a codebase that predates them.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  {
    // Config files legitimately use CommonJS-style requires for plugins.
    files: ["*.config.{js,cjs,mjs,ts}", "tailwind.config.ts", "postcss.config.mjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
