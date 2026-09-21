# Contributing

Thanks for helping improve Telegram Profile Photo Rotator.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- For security issues, use the [security policy](SECURITY.md). Do not open a public issue.
- Search [existing issues](https://github.com/CByBB/TG-pfp-rotator/issues) before opening a new one.

## Development setup

Requirements: Node.js 20+ and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/CByBB/TG-pfp-rotator.git
cd TG-pfp-rotator
pnpm install
cp .env.example .env
```

Fill `.env` with your own `BOT_TOKEN`, `API_ID`, and `API_HASH`. Never commit that file.

```bash
pnpm dev
```

## Checks

Run these before you open a pull request:

```bash
pnpm lint
pnpm format
pnpm typecheck
pnpm build
```

Husky runs `lint-staged` (ESLint + Prettier) on commit.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep the change focused. Do not mix refactors with feature work.
3. Do not commit `.env`, `data/`, sessions, or personal photos.
4. Update the README when behavior or commands change.
5. Open a PR against `main` and describe **why** the change is needed.

## Project notes

- TypeScript, ESM, file-based storage only (no database).
- Bot UI is grammY. Account login and profile-photo updates are GramJS.
- User-facing copy should stay short and plain. Avoid operator/debug language in Telegram messages.

## License

By contributing, you agree that your work is licensed under the [MIT License](LICENSE).
