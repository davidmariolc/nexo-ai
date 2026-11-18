import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxy = {
  "/api/v1": "http://127.0.0.1:5001",
};

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  preview: { proxy },
  server: { proxy },
});
