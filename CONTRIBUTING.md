# Contributing

Thanks for contributing to Maya Dev UI.

## Run locally (short path)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run start
   ```

3. Useful checks before opening a PR:

   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run test:e2e
   ```

## Equivalent package-manager commands

If you use pnpm or yarn, use the same scripts:

```bash
pnpm run lint && pnpm run typecheck && pnpm run test
yarn run lint && yarn run typecheck && yarn run test
```

## Commit conventions

Use conventional-style commit messages:

- `feat: ...` for user-facing features
- `fix: ...` for bug fixes
- `docs: ...` for documentation changes
- `refactor: ...` for structural changes without behavior changes
- `test: ...` for test updates
- `chore: ...` for maintenance tasks

Keep commits focused and prefer one logical change per commit.

