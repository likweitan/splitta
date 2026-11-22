# Splitta

Splitta is a receipt management and expense-splitting app. This repository is a monorepo containing
the React frontend and SAP CAP backend deployed together to Cloud Foundry.

Use Bun 1.4.0 for contributor workflows. Install it from the
[Bun installation guide](https://bun.com/docs/installation).

## Repository layout

```text
backend/       CAP Node.js service, HANA model, Application Router, and MTA deployment
frontend/      React + TypeScript application
```

## Local development

Start the CAP service in one terminal:

```bash
cd backend
bun install --frozen-lockfile
cp .env.example .env
# Configure AI Core credentials/model in .env, then:
bun run watch
```

Start the frontend in another terminal:

```bash
cd frontend
bun install --frozen-lockfile
cp .env.example .env
CAP_DEV_USER=alice bun run dev
```

The Vite dev server proxies `/odata/v4` to CAP on port 4004. `CAP_DEV_USER=alice` enables CAP's
mock user for local UI testing only; do not use it in production. See the [backend guide](backend/readme.md)
and [frontend guide](frontend/README.md) for configuration and deployment details.

## Checks

```bash
(cd backend && bun run test)
(cd frontend && bun run lint && bun run build)
```

## Deployment

The backend MTA builds the frontend and packages it in the Application Router alongside the CAP
service. Follow the [backend deployment guide](backend/readme.md) to deploy to Cloud Foundry.
