# Repository Guidelines

## Project Structure & Module Organization
- Backend: Node/Express app in `src/` (entry: `src/app.js`). Feature folders include `controllers/`, `routes/`, `models/`, `services/`, `middleware/`, `sockets/`, `templates/`, `utils/`, `workers/`.
- Frontend: Vite + React (TypeScript) in `frontend/` with `src/` and `public/`.
- Tests: Centralized in `tests/` (`unit/`, `integration/`, `e2e/`, `performance/`, `realtime/`) and optional co-located `*.test.js` in `src/`.
- Database: SQL schema and migrations in `db/` (`db/schema.sql`, `db/migrations/`).

## Build, Test, and Development Commands
- Backend (from repo root):
  - `npm run dev`: Start API with nodemon.
  - `npm start`: Start API (production mode).
  - `npm test`: Run Jest test suite.
  - `npm run test:watch` / `npm run test:coverage`: Watch mode / coverage.
- Frontend (from `frontend/`):
  - `npm run dev`: Vite dev server.
  - `npm run build`: Type-check then build for production.
  - `npm run preview`: Preview production build.
  - `npm test` / `npm run test:coverage`: Vitest tests and coverage.
- Requirements: Node >= 16.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; keep lines concise and readable.
- Naming: camelCase for variables/functions; PascalCase for React components; match adjacent file patterns (e.g., `bookingController.js`, `public-profiles.js`).
- Imports: prefer relative paths within a module; keep folder boundaries clear (`controllers` ↔ `services`).
- Linting: Frontend uses ESLint (`frontend/npm run lint`). No enforced linter in backend—follow existing patterns and keep consistent.

## Testing Guidelines
- Backend: Jest with `jsdom` and `src/setupTests.js`; coverage threshold 80% (branches/functions/lines/statements).
- Test locations: place by type in `tests/{unit|integration|e2e}` or co-locate as `*.test.js(x)` near source.
- HTTP/API: use `supertest`. UI-like helpers available via Testing Library where applicable.
- Run examples: `npm test`, `npm run test:coverage`, `cd frontend && npm test`.

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (`feat:`, `fix:`, `chore:`). Reference issues/PRs (e.g., `(#15)`, `Issue #11`). Use imperative mood and scope where helpful.
- PRs: Include summary, linked issues, screenshots/GIFs for UI changes, test plan, and risk/rollback notes. Require CI green and coverage ≥ 80%.

## Security & Configuration
- Environment: manage secrets via `.env` (an example exists: `.env.test`). Never commit real secrets.
- Hardening: keep `helmet`, rate limits, and validation in place when touching `app.js`, `middleware/`, or `routes/`.
