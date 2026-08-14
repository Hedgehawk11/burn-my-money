# burn-my-money

Small Node.js + MongoDB API for FRC gambling.

Rules implemented:
- Bets move money from a gambler's balance into their team's shared pool.
- Match resolution pays the full pool out proportionally to winners.
- If only one alliance received bets for a match, those bets are refunded.
- A Superuser account creates teams, each with exactly one team admin.
- Team admins manage their own team: create accounts, mint/burn currency, resolve matches, and review debts.
- Each team has its own independent pool, so teams can operate at different events.

## Roles

| Role | Powers |
| --- | --- |
| Superuser | Create teams (name + admin credentials), list teams, change a team's admin, delete teams (cascades to members/bets/pool). |
| Team admin | One per team. Create/delete team members, mint/burn member balances, resolve team matches, view team state and debt report. |
| Gambler | Member of a team, created by their team admin. Places bets, views own bets. |

## Stack

- Node.js
- Express
- MongoDB (Mongoose)
- JWT auth

## Quick Start

1. Install dependencies:

	 npm install

2. Copy environment file:

	 cp .env.example .env

3. Start server:

	 npm start

Server default port: 3000

Health check:

	 GET /health

Quick local smoke test:

	 curl -s http://localhost:3000/health

Expected response:

	 {"ok":true}

## Deployment (Production)

Use this checklist for any deployment target.

1. Use Node.js 20+.
2. Use a MongoDB database reachable from your host.
3. Set all required environment variables.
4. Set a strong JWT secret (do not use default).
5. Set a non-default Superuser password.
6. Run the app with `npm start`.
7. Confirm `/health` returns `{"ok":true}`.

### Vercel

Vercel runs this app as a serverless function. Deploy the repo as-is; the `api/index.js` handler and `vercel.json` rewrites are already configured.

1. In Vercel project settings, set every variable from "Required Environment Variables" below.
2. In MongoDB Atlas, allow connections from anywhere (`0.0.0.0/0`) because Vercel functions use dynamic IPs.
3. Deploy, then confirm `https://YOUR_DOMAIN/health` returns `{"ok":true}`.

### Required Environment Variables

Set these in your host's environment settings (not committed files):

- `PORT` (example: `3000`, many hosts inject this automatically)
- `MONGODB_URI` (MongoDB connection string)
- `JWT_SECRET` (long random secret)
- `SUPERVISOR_USERNAME`
- `SUPERVISOR_PASSWORD`

Generate a secure JWT secret:

	 openssl rand -base64 48

### Managed Host (Render/Railway/Fly.io style)

Use these exact app settings:

1. Runtime: Node
2. Build command: `npm install`
3. Start command: `npm start`
4. Health check path: `/health`
5. Environment variables: set every variable from "Required Environment Variables"

After deploy, verify:

	 curl -s https://YOUR_DOMAIN/health

### Ubuntu VM Deployment (systemd)

Install Node.js and clone the app:

	 sudo apt update
	 sudo apt install -y curl git
	 curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
	 sudo apt install -y nodejs
	 sudo mkdir -p /opt/burn-my-money
	 sudo chown "$USER":"$USER" /opt/burn-my-money
	 git clone https://github.com/Hedgehawk11/burn-my-money.git /opt/burn-my-money
	 cd /opt/burn-my-money
	 npm install --omit=dev

Create `/opt/burn-my-money/.env` with production values.

Create systemd unit `/etc/systemd/system/burn-my-money.service`:

```ini
[Unit]
Description=burn-my-money API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/burn-my-money
EnvironmentFile=/opt/burn-my-money/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Set ownership and start service:

	 sudo chown -R www-data:www-data /opt/burn-my-money
	 sudo systemctl daemon-reload
	 sudo systemctl enable burn-my-money
	 sudo systemctl start burn-my-money
	 sudo systemctl status burn-my-money --no-pager

Verify service and health endpoint:

	 journalctl -u burn-my-money -n 100 --no-pager
	 curl -s http://127.0.0.1:3000/health

Optional Nginx reverse proxy:

	 sudo apt install -y nginx
	 sudo tee /etc/nginx/sites-available/burn-my-money >/dev/null <<'EOF'
	 server {
	   listen 80;
	   server_name YOUR_DOMAIN;

	   location / {
	     proxy_pass http://127.0.0.1:3000;
	     proxy_http_version 1.1;
	     proxy_set_header Host $host;
	     proxy_set_header X-Real-IP $remote_addr;
	     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	   }
	 }
	 EOF
	 sudo ln -sf /etc/nginx/sites-available/burn-my-money /etc/nginx/sites-enabled/burn-my-money
	 sudo nginx -t
	 sudo systemctl reload nginx

Use certbot (Let's Encrypt) after DNS is pointed at your VM.

## Default Superuser Account

On boot, the app auto-creates the Superuser if missing:
- username: Superuser
- password: I<3MST3k

You can override with env vars SUPERVISOR_USERNAME and SUPERVISOR_PASSWORD.

## Auth

Login:

POST /auth/login

Body:

{
	"username": "Superuser",
	"password": "I<3MST3k"
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
	"name": "Team 1730",
	"adminUsername": "team1730admin",
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

## Mongo Connection

Configured in .env via MONGODB_URI.

Provided Atlas connection template used in .env.example:

mongodb+srv://Yoda:UseTHeFOrce@burn-my-money.oir3oyi.mongodb.net/frc-gambling?retryWrites=true&w=majority&appName=burn-my-money
