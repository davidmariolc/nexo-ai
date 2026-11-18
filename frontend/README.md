# Nexo AI · Frontend

Nexo AI is a single-conversation chat built with React, TypeScript and Vite.

## Run the chat locally

Start FastAPI on port `5001` from the `fastapi` directory with its local settings configured.

```sh
uv run uvicorn app.main:app --port 5001
```

Then run `pnpm dev` from the `frontend` directory. Vite proxies `/api/v1` to FastAPI in development and preview. Serve that path from the same origin as the frontend in production.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances. You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Linting and formatting

Ultracite uses Oxlint with its `core` and `react` presets, and Oxfmt for formatting. Use Node.js 22.22.2 or later in the 22.x line, or Node.js 24.15 or later.

Run these commands from the frontend directory.

```sh
pnpm check
pnpm fix
pnpm exec ultracite doctor
```

Project-specific lint rules are in [oxlint.config.ts](oxlint.config.ts). Formatter settings are in [oxfmt.config.ts](oxfmt.config.ts).
