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
    // These were temporarily downgraded to "warn" while the Next 16 lint setup
    // was first made runnable (kn-u0); kn-85e cleared the backlog and promoted
    // them back to "error". Mount-time-hydration / live-event effects that
    // legitimately call setState carry a `// eslint-disable-next-line` with a
    // reason at the call site.
    rules: {
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/immutability": "error",
      "react/no-unescaped-entities": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "error",
    },
  },
  {
    // Config files legitimately use CommonJS-style requires for plugins.
    files: ["*.config.{js,cjs,mjs,ts}", "tailwind.config.ts", "postcss.config.mjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
