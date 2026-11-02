import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // By default Vite embeds small files directly in the JavaScript as base64 text.
    // Game data must stay a separate file so it can be fetched at runtime (and so a failed
    // load can show the Retry screen). Returning `false` means "never inline this file";
    // returning `undefined` keeps Vite's normal behaviour for everything else (images etc.).
    assetsInlineLimit: (filePath) => (filePath.endsWith('.json') ? false : undefined),
  },
});
