import globals from "globals";

export default [
  {
    files: [
      "apps/api/**/*.{js,mjs,cjs,ts,mts,cts}",
      "scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
      "**/*.config.{js,mjs,cjs,ts,mts,cts}"
    ],
    languageOptions: {
      globals: globals.node
    }
  }
];
