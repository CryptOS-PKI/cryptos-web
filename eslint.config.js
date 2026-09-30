/*
Apache License 2.0

Copyright 2026 Shane

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { createESLintConfig } from "@the-rabbit-hole/eslint-config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// The shared config (@the-rabbit-hole/eslint-config) bundles the TypeScript,
// React, Perfectionist, Unicorn, and Prettier rule sets and ships func-style.
// React Fast Refresh and the React Hooks rules are Vite-app concerns not in the
// shared config, so they are layered on here alongside it.
export default [
  {
    // Vendored Connect-ES stubs bridged in from the api repo's generated TS
    // output (see src/gen/fleet's header comment); regenerated there, not
    // hand-edited here, so none of the source conventions below apply.
    ignores: ["src/gen/**"],
  },
  ...createESLintConfig(),
  {
    // A few of the shared config's Unicorn defaults fight conventions this repo
    // is committed to; each is turned off (or narrowed) with a specific reason.
    rules: {
      // Filenames are PascalCase for React components and kebab-case for
      // everything else (shadcn/ui primitives, routes). Unicorn defaults to
      // camelCase, which neither convention uses.
      "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
      // React and DOM APIs legitimately use null: useRef(null), querySelector,
      // event targets. Coercing to undefined would be wrong.
      "unicorn/no-null": "off",
      // The Apache 2.0 header carries the canonical http:// license URL that
      // golic injects and `task license` verifies; prefer-https would rewrite
      // it and break the license gate.
      "unicorn/prefer-https": "off",
      // "Props", "ref", "env", and "e" (event/error) are idiomatic in React and
      // TypeScript; expanding them hurts readability.
      "unicorn/prevent-abbreviations": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // shadcn/ui primitives export a cva variants helper next to the component,
    // and the context modules export a provider next to its hook. Both are
    // intentional co-exports, so the Fast Refresh heuristic does not apply.
    files: ["src/components/ui/**/*.tsx", "src/context/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
