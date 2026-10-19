import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const webFiles = ["apps/web/**/*.{js,mjs,jsx,ts,tsx}"];

export default [...nextVitals, ...nextTypescript]
  .map((config) => ({
    ...config,
    files: webFiles
  }))
  .concat({
    files: webFiles,
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  });
