import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Docker Desktop's VM has a low inotify watch ceiling, which trips EMFILE
    // on the default fs watcher — polling sidesteps that entirely.
    watch: {
      usePolling: true,
    },
  },
});
