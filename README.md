# Burn My Money
## Because fake gambling is fun
### NOTE: I, Hedgehawk11, do not condone gambling actual money, hence this project's existence, I also recommend you don't run this during matches where you know your team is getting creamed (EX: Round 1 Match 1, you are on alliance 8), or better yet, don't run it when your team is playing.

Small Node.js app for FRC gambling.

Rules implemented:
- Bets move money from a gambler's balance into their team's shared pool.
- Match resolution pays the full pool out proportionally to winners.
- If only one alliance received bets for a match, those bets are refunded.
- A Superuser account creates teams, each with exactly one team admin (I might add multi-admin support in the future tho).
- Team admins manage their own team: create accounts, mint/burn currency, resolve matches, and review debts.
- Each team has its own independent pool, so teams can operate at different exchange rates.

## Roles

| Role | Powers |
| --- | --- |
| Superuser | Create teams (name + admin credentials), list teams, change a team's admin, delete teams (cascades to members/bets/pool). Only 1 per instance |
| Team admin | One per team. Create/delete team members, mint/burn member balances, resolve team matches, view team state and debt report. |
| Gambler | Member of a team, created by their team admin. Places bets, views own bets. |

## Stack

- Node.js
- Express
- MongoDB (Mongoose)
- JWT auth

## Quick Start

#### If you just want your team to just be added into the main vercel instance, just create an issue, i'll get you set up
#### as a note, I am running the vercel mongo instance off of atlas free tier, so if there is a problem, I might have exeeded the 500 connection limit

## Self host

1. Install dependencies:

	 npm install

2. Copy (and edit) environment file:

	 cp .env.example .env
	 nano .env

4. Start server:

	 npm start

Server default port: 3000

Health check:

	 GET /health

Quick local smoke test:

	 curl -s http://localhost:3000/health

Expected response:

	 {"ok":true}

## Deployment

Use this checklist for any deployment target.

1. Use Node.js 20+.
2. Use a MongoDB database reachable from your host.
3. Set all required environment variables.
4. Set a strong JWT secret (do not use default).
5. Set a non-default Superuser password.
6. Run the app with `npm start`.
7. Confirm `/health` returns `{"ok":true}`.

### Vercel

Vercel runs this app. Deploy the repo as-is (literally just deploy this repo and config .env).

1. In Vercel project settings, set every variable from "Required Environment Variables" below.
2. In MongoDB Atlas, allow connections from anywhere (`0.0.0.0/0`) because Vercel.

### Required Environment Variables

Set these in your host's environment settings (not committed files):

- `PORT` (example: `3000`, many hosts inject this automatically)
- `MONGODB_URI` (MongoDB connection string)
- `JWT_SECRET` (long random secret)
- `SUPERVISOR_USERNAME` (how you create teams on your instance)
- `SUPERVISOR_PASSWORD` (password for above)

Generate a secure JWT secret:

	 openssl rand -base64 48

## Default Superuser Account

On boot, the app auto-creates the Superuser if missing:
- username: Superuser
- password: change-me

You can override with env vars SUPERVISOR_USERNAME and SUPERVISOR_PASSWORD.

## Auth

Login:

POST /auth/login

Body:

{
	"username": "Superuser",
	"password": "change-me"
}

Use returned token in Authorization header:

Bearer <token>

If a username exists on multiple teams, login with a teamId (fetched from GET /auth/teams?username=X) to disambiguate:

{
	"username": "johnpork",
	"password": "secret",
	"teamId": "664d2e9f1b2c3d4e5f6a7b8c"
}

Usernames are unique per team, so the same username can exist on different teams.

## User Endpoints (Authenticated)

- GET /api/me
- GET /api/my-bets
- POST /api/bets
- POST /auth/change-password
	- Update your own password. Requires the current password.
	- Body: `{ "currentPassword": "...", "newPassword": "..." }` (newPassword must be at least 6 characters)

Place bet body:

{
	"matchId": "2026miket_qm12",
	"alliance": "red",
	"amount": 50
}

## Superuser Endpoints

Require the Superuser token.

- POST /super/teams
	- Create a team and its admin account
- GET /super/teams
	- List all teams with admin, member count, and pool
- PUT /super/teams/:id/admin
	- Change a team's admin to an existing team member
	- Body: `{ "username": "..." }`
- DELETE /super/teams/:id
	- Delete a team and all of its members, bets, results, and pool

Example create team body:

{
	"name": "Team XXXX",
	"adminUsername": "teamXXXXadmin",
	"adminPassword": "strongpassword",
	"initialBalance": 1000
}

## Team Admin Endpoints

Require the team admin token.

- GET /team/state
	- View team pool and all member balances
- POST /team/users
	- Create a member account (and optionally mint initial balance)
- DELETE /team/users/:username
	- Delete a team member
	- Query param burnBalance=true to burn balance when deleting
	- Otherwise deleted member's balance moves into the team pool
- PATCH /team/users/:username/balance
	- mode=add mints money
	- mode=remove burns money
- POST /team/matches/resolve
	- Set winning alliance and distribute the team pool proportionally to winning gamblers
- GET /team/debts
	- Shows who owes who and how much within the team based on settled matches

Example resolve body:

{
	"matchId": "2026miket_qm12",
	"winningAlliance": "red"
}

If no one bet on the winning alliance, the team pool carries forward.
If only one alliance had bets on a match, those bets are refunded.

# AI DISCLAIMER
See my buzzers project for a better explanation\
TLDR: Started as learning thing I thought I could learn from, got useful, got complicated, got to be a mess, I ain't learning much here
