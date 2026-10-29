import js from "@eslint/js";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"];

export default [
  {
    ...js.configs.recommended,
    files: sourceFiles
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: sourceFiles
  })),
  {
    files: sourceFiles,
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false
        }
      ],
      "@typescript-eslint/no-import-type-side-effects": "error"
    }
  }
];
