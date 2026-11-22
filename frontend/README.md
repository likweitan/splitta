# Splitta

Splitta is an AI-powered receipt management and expense-splitting app. Users can upload or scan receipts, let the system extract itemized details, review totals, split costs with others, and share the result via a public link or QR code.

This directory contains the React + TypeScript frontend for Splitta. The SAP CAP Node.js backend
lives alongside it in [`../backend/`](../backend).

## Features

- AI-assisted receipt ingestion and line-item extraction
- Shared receipt breakdowns for splitting costs between people
- Public receipt links for easy sharing
- Team-aware account flow and dashboard experience
- QR-based sharing for quick access to receipts
- SAP CAP backend for receipt data and persistence
- SAP BTP XSUAA sign-in

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- SAP CAP Node.js
- SAP BTP XSUAA
- SAP HANA Cloud (Cloud Foundry deployment)
- Lucide icons

## Getting started

1. Install the locked dependencies with Bun 1.4.0:

```bash
bun install --frozen-lockfile
```

2. Copy the environment template (no frontend API URL is needed):

```bash
cp .env.example .env
```

3. Start the CAP backend in a terminal:

```bash
cd ../backend
bun install --frozen-lockfile
bun run watch
```

4. Start the React dev server in another terminal:

```bash
CAP_DEV_USER=alice bun run dev
```

The optional `CAP_DEV_USER` lets the Vite proxy use CAP's built-in mock user (`alice`) for local UI
testing. In Cloud Foundry, the Application Router performs XSUAA sign-in and forwards the
authenticated token to CAP; do not set `CAP_DEV_USER` in production.

## Project structure

```text
backend/
  db/schema.cds
  srv/receipt-service.cds
  app/router/
src/
  components/     Shared UI and feature components
  contexts/       Auth and app context providers
  pages/          Route-level screens and flows
  lib/api.ts     CAP OData client
  App.tsx         Route definitions and auth guards
```

## Scripts

```bash
bun run dev      # start Vite dev server
bun run build    # type-check + production build
bun run preview  # preview the production build
bun run lint     # run ESLint
```

## Cloud Foundry deployment

The backend MTA builds and serves both the React app and CAP APIs through an Application Router.
See [the backend deployment guide](../backend/readme.md) for setup and deployment steps.

## Notes

- Receipt extraction runs through an authenticated CAP action and SAP AI Core Orchestration. Configure
  the AI Core service binding and `AICORE_MODEL` in the backend before processing uploads.

## License

This project is currently distributed without a formal repository license declaration.
