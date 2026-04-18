# Contributing

Thank you for your interest in Flowspace. This guide covers how to set up your environment and the norms we follow.

## Quick start

```bash
git clone https://github.com/fossasia/flowspace.git
cd flowspace
npm install
cp .env.example .env.local   # adjust as needed
npm run dev                  # http://localhost:5173
```

For a full local stack with Jitsi:

```bash
docker compose up -d --build
# Flowspace → http://localhost:8780
# Jitsi web → http://localhost:8001
```

See [Getting Started](./getting-started.md) for a step-by-step walkthrough.

## Development workflow

```bash
npm run typecheck       # TypeScript strict check
npm run test            # Vitest + coverage (must stay at 100%)
npm run build           # Production build
npm run docs:dev        # VitePress docs preview
npm run test:e2e        # Playwright smoke tests (requires a running preview)
```

CI runs all of the above on every push; all checks must pass before merging.

## Testing philosophy

Every TypeScript source file under `src-vue/` must maintain **100% coverage** across lines, statements, functions, and branches. This is enforced via `vitest.config.ts` thresholds.

- Write tests **next to the file they cover** (`foo.ts` → `foo.test.ts`).
- Extract testable logic into plain `.ts` helpers before putting it in Vue SFCs.
- No `/* v8 ignore */` comments — if a branch is untestable, restructure the code.
- E2E tests (Playwright) cover critical user flows but do **not** require a live Jitsi server.

See [Testing strategy](./testing.md) for more detail.

## Commit conventions

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

<body — explain why, not what>
```

Common types: `feat`, `fix`, `perf`, `style`, `refactor`, `test`, `docs`, `chore`, `ci`.

Keep **tests** and **docs** changes in **separate commits** from source changes. For larger batches, split test commits into logical groups (e.g. composables, components, utils).

## Code style

- TypeScript strict mode (`strict: true` in `tsconfig.json`).
- No `any` — use proper types or `unknown`.
- Vue SFCs use `<script setup lang="ts">`.
- Formatting is handled by Prettier (`.prettierrc.json`).
- No eslint yet — contributions to add it are welcome.

## Pull request checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes with 100% coverage
- [ ] `npm run build` produces a valid build
- [ ] `npm run docs:build` produces a valid docs build
- [ ] New features have tests colocated with the source
- [ ] Commit messages follow conventional commits
- [ ] Tests and docs are in separate commits from source changes

## Eventyay plugin development

The `eventyay-flowspace` plugin lives in the Eventyay repository at `plugins/eventyay-flowspace/`.

To run the plugin's own test suite:

```bash
cd plugins/eventyay-flowspace
pip install pytest PyJWT -e .
pytest tests/
```

The plugin tests are self-contained and do not require a running Django instance. See the plugin's own `README.rst` for installation instructions.
