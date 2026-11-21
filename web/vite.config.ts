import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH is set by the deploy workflow (e.g. "/daily-booth/" on github pages).
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
});
