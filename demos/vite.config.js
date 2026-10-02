import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const pages = ["reveal", "scroll-scene", "faq-morph", "hero", "three-stage", "cursor"];

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        ...Object.fromEntries(pages.map((page) => [page, resolve(root, page, "index.html")])),
      },
    },
  },
});
