# Help Desk

A full-stack IT support and equipment management application built with React, Express, and SQLite.

Employees submit requests and track their equipment. Technicians triage the support queue, assign work, and record updates. Administrators manage staff access.

## Features

- Account registration, bcrypt password hashing, and expiring JWT sessions
- Employee, technician, and administrator permissions enforced by the API
- Ticket creation, search, priority filters, and status filters
- Technician assignment, status updates, comments, and activity history
- Equipment inventory with assignment, maintenance, and retirement
- Admin screen for changing account roles
- Overview counts by status, category, and priority
- Responsive forms, loading states, and API error messages
- GitHub Actions API integration tests and production client build

## Quick start

Use Node.js 22.12 or later in the Node 22 release line and npm.

```sh
git clone https://github.com/jenilkumar1301/help-desk.git
cd help-desk
npm install --prefix server
npm install --prefix client
```

Configure the API:

```sh
cd server
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value after JWT_SECRET= in server/.env. Never commit this file. No reusable passwords or default accounts are included.

Start the server from server/:

```sh
npm run dev
```

In a second terminal, from help-desk/client/:

```sh
npm run dev
```

Open the address printed by Vite, normally http://localhost:5173. The API uses http://localhost:4000/api.

If Vite chooses another port, update CLIENT_URL in server/.env and restart the API. For a different API address, set VITE_API_URL in client/.env before starting or building the client.

SQLite creates help-desk.db in the server working directory. Always run server commands there so they use the same database. Back up that database if you want to keep your demo data.

## Create your first administrator

1. Register your account through the app.
2. In another terminal, from server/, run the following with the email you registered:

```sh
npm run promote -- your-email@example.com admin
```

3. Refresh the app. The People screen is now available.
4. Register a second account and use People to grant it technician access.

The local promotion command requires access to the server machine. Public registration always creates an employee. Current roles are read from the database on every authenticated request, so demoting staff removes API access immediately. Administrators cannot change their own role in the UI.

## Demo walkthrough

1. Sign in as an employee and create a Network ticket with high priority.
2. Sign in as a technician in another browser profile or private window.
3. Open the support queue, assign the ticket, and mark it in progress.
4. Add a troubleshooting comment and inspect the activity history.
5. Add a laptop in Equipment and assign it to the employee.
6. Return to the employee account: the ticket conversation and assigned laptop are visible.
7. Resolve the ticket and inspect Overview.
8. Search for the asset and retire it when no longer in use.

Overview is a snapshot of current tickets, not a historical SLA or resolution-time report. Employee counts include only their own tickets.

## Verification

```sh
npm test --prefix server
npm run build --prefix client
```

GitHub Actions runs these checks on main pushes and pull requests. The API tests use an isolated in-memory database and randomly generated test credentials.

The [verified workflow run](https://github.com/jenilkumar1301/help-desk/actions/runs/34883663626) passed dependency installation, API integration tests, and the React production build. Browser interaction and visual checks have not yet been performed.

Test coverage includes account validation, ticket ownership, comments and history access, staff-only mutations, asset visibility, duplicate tags, role escalation, immediate demotion, and JSON errors.

Dependency lockfiles are not committed yet. After installing locally, commit the generated server/package-lock.json and client/package-lock.json to make dependency resolution repeatable.

## Project structure

- client/src/components — authentication, tickets, equipment, and people screens
- client/src/App.jsx — navigation, session checks, ticket list, and overview
- server/src/routes — account, ticket, asset, and user APIs
- server/src/middleware — authentication and role checks
- server/src/database.js — SQLite schema and indexes
- server/src/scripts/promote.js — local role administration
- server/test/api.test.js — API integration tests

## API summary

All routes below except registration, login, and health require a Bearer token.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/auth/register | Register employee |
| POST | /api/auth/login | Sign in |
| GET | /api/auth/me | Read current account |
| GET | /api/health | Health check |
| GET / POST | /api/tickets | List visible tickets / create request |
| GET / PATCH | /api/tickets/:id | Read ticket / staff update |
| GET / POST | /api/tickets/:id/comments | Read / add comments |
| GET | /api/tickets/:id/activity | Read change history |
| GET / POST | /api/assets | List visible assets / staff creation |
| PUT | /api/assets/:id | Staff asset update |
| GET | /api/users | Staff user directory |
| PATCH | /api/users/:id/role | Admin role update |

## Scope and deployment notes

This is a portfolio MVP. Run it locally for demonstrations. It has not been deployed.

Tokens are stored in browser local storage and expire after eight hours; logout clears the browser token rather than revoking it server-side. Before using real organizational data, review session storage, HTTPS, database backups, and deployment-specific security. The authentication limiter is per-process and needs a shared store for multiple API instances. Password reset, email verification, attachments, and SLA reporting are outside this version.

## Resume description

Built a full-stack IT help desk application with React, Express, and SQLite, implementing role-based access, ticket assignment and activity history, equipment tracking, and automated API integration tests.
