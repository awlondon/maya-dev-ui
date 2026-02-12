# AGENTS.md

This file defines the default operating workflow for contributors and coding agents in this repository.

## 1) Clean checkout setup

This repo is currently npm-first (`package-lock.json` is authoritative), but equivalent commands are listed for pnpm and yarn.

### Node version

- Recommended: Node.js 20+.

### Install dependencies

From repo root:

- **npm**
  ```bash
  npm install
  ```
- **pnpm**
  ```bash
  pnpm install
  ```
- **yarn**
  ```bash
  yarn install
  ```

## 2) Development and build commands

Run these from repo root unless noted.

### Dev server

- **npm**
  ```bash
  npm run start
  ```
- **pnpm**
  ```bash
  pnpm run start
  ```
- **yarn**
  ```bash
  yarn run start
  ```

### Frontend-only dev server (Vite app in `pdco-frontend/`)

- **npm**
  ```bash
  npm run frontend:dev
  ```
- **pnpm**
  ```bash
  pnpm run frontend:dev
  ```
- **yarn**
  ```bash
  yarn run frontend:dev
  ```

### Production build

- **npm**
  ```bash
  npm run frontend:build
  ```
- **pnpm**
  ```bash
  pnpm run frontend:build
  ```
- **yarn**
  ```bash
  yarn run frontend:build
  ```

### Lint

- **npm**
  ```bash
  npm run lint
  ```
- **pnpm**
  ```bash
  pnpm run lint
  ```
- **yarn**
  ```bash
  yarn run lint
  ```

### Typecheck

- **npm**
  ```bash
  npm run typecheck
  ```
- **pnpm**
  ```bash
  pnpm run typecheck
  ```
- **yarn**
  ```bash
  yarn run typecheck
  ```

### Unit tests

- **npm**
  ```bash
  npm run test
  ```
- **pnpm**
  ```bash
  pnpm run test
  ```
- **yarn**
  ```bash
  yarn run test
  ```

### End-to-end tests (Playwright)

- **npm**
  ```bash
  npm run test:e2e
  ```
- **pnpm**
  ```bash
  pnpm run test:e2e
  ```
- **yarn**
  ```bash
  yarn run test:e2e
  ```

If Playwright browsers are missing:

```bash
npx playwright install
```

## 3) Subsystem map

Use this map when deciding where to make changes:

- **Editor subsystem**
  - `editorManager.js` (Monaco loader/bootstrap + editor lifecycle)
  - `app.js` (editor integration into app state and UI events)

- **Preview / iframe sandbox subsystem**
  - `sandboxController.js` (iframe execution controller + run/pause/stop)
  - `app.js` (wiring from editor actions to sandbox)

- **Agent harness subsystem**
  - `agent/` (run lifecycle, events, sync manager, store)
  - `agent/routes.js` (agent run API routes)
  - `server/__tests__/agent.routes.test.js`, `tests/agentRunner.test.js` (agent behavior coverage)

- **Persistence subsystem**
  - `core/persistence.js` (browser local persistence/migration)
  - `db/`, `utils/artifactDb.js`, `utils/profileDb.js` (server persistence helpers)
  - `data/migrations/` (schema evolution for users, artifacts, and agent runs)

## 4) Definition of done

A change is done only when all of the following are true:

1. Lint, typecheck, and tests are green.
2. No measurable performance regressions are introduced in critical flows (chat, editor input, preview execution, agent run lifecycle).
3. Risky or user-impacting behavior changes are gated behind feature flags and default-safe rollout paths.
4. Docs/tests are updated when behavior or operational workflows change.

