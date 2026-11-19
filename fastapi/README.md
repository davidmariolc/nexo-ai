# FastAPI Starter

Deploy your [FastAPI](https://fastapi.tiangolo.com/) project to Vercel with zero configuration.

This project serves a REST API with JSON responses.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel/vercel/tree/main/examples/fastapi&template=fastapi)

_Live Example: https://vercel-plus-fastapi.vercel.app/_

Visit the [FastAPI documentation](https://fastapi.tiangolo.com/) to learn more.

## Project Structure

The application is organized by feature. Each feature owns its routes, business logic, and dependencies:

```
app/
├── __init__.py
├── main.py              # FastAPI application entry point
├── router.py            # Feature router assembly
├── features/
│   ├── __init__.py
│   └── items/
│       ├── __init__.py
│       ├── router.py    # Item endpoints and HTTP responses
│       ├── service.py   # Item business logic
│       └── dependencies.py # Item request dependencies
└── core/
    ├── __init__.py
    └── config.py        # Application settings
```

To add a feature, create a package under `app/features/` and register its router in `app/router.py`. Keep shared application configuration in `app/core/`. Add schemas or persistence modules within each feature when needed.

## Getting Started

Install the required dependencies using [uv](https://docs.astral.sh/uv/):

```bash
uv sync
```

## Running Locally

```bash
vercel dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API name and version as JSON |
| `GET` | `/api/v1/items/` | List sample items |
| `GET` | `/api/v1/items/{item_id}` | Get item by ID |
| `POST` | `/api/v1/chat/` | Generate a reply or manage a conversation using JSON |
| `POST` | `/api/v1/chat/stream` | Generate a reply using server-sent events |
| `GET` | `/docs` | Interactive API docs (Swagger UI) |

The streaming route accepts `prompt` and an optional `conversation_id`. Each
`data:` frame contains JSON with a `type`. The `delta` frames contain text to
append. The final `done` frame contains the conversation ID, full message list,
and token usage. An `error` frame contains a message if generation fails after
the stream opens. Only completed turns are saved to the conversation.

## Deploying to Vercel

Deploy your project to Vercel with the following command:

```bash
npm install -g vercel
vercel --prod
```

Or `git push` to your repository with our [git integration](https://vercel.com/docs/deployments/git).

To view the source code for this template, [visit the example repository](https://github.com/vercel/vercel/tree/main/examples/fastapi).
