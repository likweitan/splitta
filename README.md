# Splitta

Splitta is an AI-powered receipt management and expense-splitting app. Users can upload or scan receipts, let the system extract itemized details, review totals, split costs with others, and share the result via a public link or QR code.

This repository contains the React + TypeScript frontend for the Splitta web app.

## Features

- AI-assisted receipt ingestion and line-item extraction
- Shared receipt breakdowns for splitting costs between people
- Public receipt links for easy sharing
- Team-aware account flow and dashboard experience
- QR-based sharing for quick access to receipts
- PocketBase-powered authentication and data persistence

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- PocketBase
- Lucide icons

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Set up your PocketBase URL in `.env`:

```env
VITE_POCKETBASE_URL=https://your-pocketbase-instance.example.com
```

4. Start the dev server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

## Environment variables

The app expects the following client-side environment variable:

```env
VITE_POCKETBASE_URL=<your pocketbase instance url>
```

By default, the app falls back to:

```env
https://pocketbase.likweitan.eu.org
```

## Project structure

```text
src/
  components/     Shared UI and feature components
  contexts/       Auth and app context providers
  pages/          Route-level screens and flows
  pocketbase.ts   PocketBase client configuration
  App.tsx         Route definitions and auth guards
```

## Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
npm run lint     # run ESLint
```

## Notes

- The frontend expects a running PocketBase backend and matching collection/schema setup.
- Receipt processing is integrated with the app's receipt upload workflow and external webhook-based extraction pipeline.

## License

This project is currently distributed without a formal repository license declaration.
