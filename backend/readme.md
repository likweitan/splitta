# Splitta CAP application

This directory contains the CAP Node.js backend and Cloud Foundry application router. The React/Vite
frontend is in the sibling `frontend/` directory.

## Local development

Copy `.env.example` to `.env`, set `AICORE_MODEL` to the name of a vision-capable model available
in your AI Core resource group, and provide AI Core credentials using `AICORE_SERVICE_KEY` or a
local service binding. Never commit `.env` or its service key.

To use a service key, create one for your AI Core instance and put its JSON in `AICORE_SERVICE_KEY`
as shown in `.env.example`. Keep the JSON on a single line: CAP reads `.env` line by line, so a
multi-line value is truncated and fails to parse. Alternatively, bind the instance using `cds bind -2 <AI_CORE_INSTANCE>`
and run CAP with the hybrid profile: `bun run watch --profile hybrid`.

Start the CAP service:

```bash
bun install --frozen-lockfile
bun run watch
```

Then start the React app in another terminal:

```bash
cd ../frontend
bun install --frozen-lockfile
bun run dev
```

The Vite dev server proxies `/odata/v4` to CAP on port 4004. The CAP service uses SQLite locally
and exposes authenticated OData V4 endpoints under `/odata/v4/receipt` and `/odata/v4/directory`.
Public receipt reads and payment updates are limited to the custom operations under
`/odata/v4/public-receipt`.
Receipt images are sent to SAP AI Core Orchestration by the authenticated
`ReceiptService.extractReceipt` action; its AI Core credentials remain on the backend.

## Webhooks

Users can register HTTPS webhooks (for example a Microsoft Teams Workflows "Post to a channel when
a webhook request is received" URL) on the Integrations page and choose which events they receive:
items being marked as paid on their receipts, and new receipts being created. Messages are posted
as Teams Adaptive Cards after the change commits; the `testWebhook` action sends a test card.
Set the optional `APP_URL` environment variable (for example `https://splitta.example.com`) to add
an "Open receipt" link to the cards.

## Cloud Foundry and SAP HANA

The MTA builds the React frontend, packages it into the Application Router, and deploys the CAP
service with an SAP HANA HDI container, XSUAA, and an existing AI Core service binding. The MTA
expects the Cloud Foundry AI Core service instance to be named `ai-core`; adjust the
`splitta-ai-core` resource in `mta.yaml` if your instance has a different name. After deployment,
set `AICORE_MODEL` on the `splitta-srv` application to the vision-capable model deployed in your
AI Core resource group, then restage the app:

```bash
cf set-env splitta-srv AICORE_MODEL <model-name>
cf restage splitta-srv
```

From this directory, log in and target the Cloud Foundry org and space, then build and deploy:

```bash
cf login
cf target
bun install --frozen-lockfile
bunx cds up
```

`cds up` builds the MTA archive and deploys it to the currently targeted space. The target space
must provide the `hana` and `xsuaa` services. The MTA build uses Bun to install dependencies and
build the frontend and CAP service. Cloud Foundry's Node.js buildpack uses npm for the generated
CAP service and Application Router. When changing CAP dependencies, run `bun install` and
`npm install --package-lock-only` from `backend/` so both the Bun and deployment locks stay current.
