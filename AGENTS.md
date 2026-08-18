# AGENTS.md

Node.js + Express + Mongoose API for FRC gambling. Serves a vanilla-JS frontend from `public/` at `/`.

## Commands

- `npm start` — run long-lived server (`src/server.js`)
- `npm run dev` — `node --watch src/server.js` (auto-restart)
- `npm test` — no-op (`echo "No tests configured"`); there is no test framework
- No lint, formatter, typecheck, or CI. Verify by running the server.

## Setup / runtime

- `.env` is required; server exits if `MONGODB_URI` is unset (`src/server.js:7`, `src/db.js:9`). Copy `.env.example` to `.env`.
- `dotenv` is loaded only in `src/server.js`. The Vercel entry `api/index.js` does not load it — platform env vars only. If you add a new entrypoint that reads config, load dotenv there too or inject env.
- On startup (and on every Vercel invocation) `bootstrapAdmin` auto-creates the SystemState and the Superuser if missing. Default Superuser: `Superuser` / `I<3MST3k`, overridable via `SUPERVISOR_USERNAME`/`SUPERVISOR_PASSWORD` (`src/config.js`).
- Note: `config.js` default JWT secret is `replace-this-secret`; `.env.example` uses `change-me` — the warning in `server.js:12` only triggers on the former.

## Language / framework conventions

- CommonJS throughout (`"type": "commonjs"`): use `require`/`module.exports`, not `import`.
- Express 5 (async route handlers need no try/catch wrapper, but this repo wraps everything in try/catch anyway — keep that style).
- Money is integer-only everywhere: schemas use `min`/`type: Number` and routes validate with `Number.isInteger(amount)`. Never introduce fractional balances.
- No comments in code; error responses use `{ error: string }` shape.

## Architecture

- Two entrypoints:
  - `src/server.js` — long-running server for VMs (see README systemd setup).
  - `api/index.js` — Vercel serverless handler; `vercel.json` rewrites all routes to `/api`. It re-uses `connectAndBootstrap()`; `db.js` caches a `readyPromise` so the Mongo connection is reused across warm invocations — keep that caching when editing `db.js`.
- Route mounts (`src/app.js`): `/auth` (login), `/api` (`/me`, `/my-bets`, `/bets`), `/team` (admin), `/super` (superuser), `/health`.
- Models: `User` (role: `superuser`/`admin`/`gambler`, `teamId` nullable), `Team`, `Bet`, `MatchResult`, `SystemState` (per-team `poolBalance`, keyed `team:${teamId}` or `global`).
- Usernames are unique per team (compound `{ username, teamId }` index), NOT globally — the same username can exist on different teams. Logins and team member lookups must scope by `teamId` (`authRoutes.js` login, `teamRoutes.js`). `bootstrapAdmin` runs `User.syncIndexes()` so index changes are applied automatically.
- Login is disambiguated via an optional `teamId` in `POST /auth/login`; `GET /auth/teams?username=X` returns the teams a username belongs to (public, no auth).

## Auth & scoping

- JWT payload carries `{ userId, username, role, teamId }`; middleware (`src/middleware/auth.js`) checks role from the token only — never re-fetches the user.
- Team admins are scoped to `req.user.teamId` — every team route must verify a target user belongs to that team (`teamRoutes.js` does this with a 403).

## Match resolution (fragile — read before touching)

`src/services/matchResolution.js` settles per-team bet groups:
- one-sided bets (all on one alliance) → refunded out of pool
- no winners → pool carries forward
- winners → pool distributed proportionally by stake using Largest-remainder allocation (floor + distribute remainder by fraction, tie-broken by bet `_id`), then pool zeroed
`settleGroup` mutates `SystemState`, credits users, marks bets settled, upserts a `MatchResult`.

## Frontend

- Vanilla JS in `public/app.js` (no framework); auth token in `localStorage["burnmoney-token"]`, sent as `Authorization: Bearer`. Keep the same key if you change auth handling.
