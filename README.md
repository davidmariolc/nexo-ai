# Nexo AI

Nexo AI es un chat de ejemplo para entender el **estado de una conversación** (*Conversation State*). Su objetivo es que el modelo pueda usar lo que se habló antes para responder a mensajes posteriores.

La interfaz usa React, TypeScript y Vite. FastAPI guarda el historial en memoria por identificador de conversación y se lo envía al modelo de Groq junto con cada mensaje nuevo. El historial se pierde al reiniciar el servidor.

## Probar el contexto

1. Envía «Recuerda que mi fruta favorita es el mango».
2. Pregunta «¿Cuál es mi fruta favorita?» para comprobar que el modelo usa el contexto anterior.
3. Escribe `/history` para consultar el hilo completo o `/reset` para borrar el historial y volver a empezar.

La ayuda aparece en la primera visita y se puede volver a abrir con el botón **?** junto a **Nuevo chat**.

## Ejecutar en local

Necesitas Python 3.12, `uv`, Node.js, `pnpm` y una clave de Groq.

1. Crea `fastapi/.env.local` y configura las variables con tu propia clave.

   ```dotenv
   GROQ_API_KEY=tu_clave_de_groq
   FRONTEND_URL=http://127.0.0.1:5173
   ```

   `FRONTEND_URL` define el origen permitido por CORS. Debe coincidir con el protocolo, el dominio y el puerto que usa el navegador para abrir la interfaz.

2. Desde la raíz del repositorio, inicia la API en una terminal.

   ```sh
   cd fastapi
   uv sync
   uv run uvicorn app.main:app --port 5001
   ```

3. Desde la raíz del repositorio, inicia la interfaz en otra terminal.

   ```sh
   cd frontend
   pnpm install
   pnpm dev --host 127.0.0.1
   ```

Abre [Nexo AI](http://127.0.0.1:5173/). Vite reenvía las solicitudes de `/api/v1` a FastAPI en el puerto `5001`.

## Desplegar el frontend en Vercel

Importa el repositorio como un proyecto Vite con `frontend` como **Root Directory**. El [rewrite de Vercel](frontend/vercel.json) reenvía las solicitudes desde `/api/v1` a la API de producción. Si cambia el dominio de FastAPI, actualiza el `destination` del rewrite.

Para más detalles, consulta la documentación del [frontend](frontend/README.md) y de la [API](fastapi/README.md).
