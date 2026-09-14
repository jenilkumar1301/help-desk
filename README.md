# Help Desk

An IT support project using React, Express, and SQLite. Employees can register, submit support requests, and search their tickets.

## Current implementation

- Registration and login with bcrypt password hashing and expiring JWTs
- Employee-scoped ticket dashboard, search, status filters, and counts
- Ticket creation with category and priority
- Technician-only ticket updates through the API
- Ticket comment API with ownership checks
- Responsive client layout

This is an in-progress portfolio project, not a production service. The source has been reviewed, but installation, build, and end-to-end testing are still pending.

## Run locally

Install Node.js 22.12 or newer with npm, then clone:

```sh
git clone https://github.com/jenilkumar1301/help-desk.git
cd help-desk/server
npm install
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into JWT_SECRET in server/.env. Keep it private. No default accounts or passwords are included.

Start the API:

```sh
npm run dev
```

In another terminal, from the repository root:

```sh
cd client
npm install
npm run dev
```

Open the local address printed by Vite. The default client address is http://localhost:5173 and the API uses port 4000. If the client port changes, update CLIENT_URL in server/.env and restart the API.

Register an employee account from the login page. The database is created automatically in the server working directory.

To check the client build:

```sh
npm run build
```

Run that command from client/. Dependency lockfiles have not yet been generated; commit them after a successful install.

## Roles

Public registration always creates an employee. Technician promotion tooling is not implemented yet, so the technician API cannot currently be exercised using registration alone. Role changes must not be exposed through public registration.

## API

All ticket endpoints require an Authorization: Bearer token header.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/health | Public |
| GET | /api/tickets | Own tickets for employees; all for technicians |
| POST | /api/tickets | Signed-in users |
| PATCH | /api/tickets/:id | Technicians and admins |
| GET | /api/tickets/:id/comments | Ticket owner or staff |
| POST | /api/tickets/:id/comments | Ticket owner or staff |

## Next milestones

- Technician account administration
- Ticket detail, comment, and status-update interface
- Asset inventory
- Ticket activity history
- Automated authorization and validation tests
- Login rate limiting and deployment hardening

JWTs currently use browser local storage, which makes preventing cross-site scripting especially important. Do not deploy this version with sensitive data.

## Manual checks still to run

1. Register and sign in; verify invalid credentials are rejected.
2. Create a ticket, refresh, and confirm persistence.
3. Search and filter tickets, including closed tickets.
4. Create a second account and verify the first account's tickets are hidden.
5. Using the API, verify the second account cannot read or add comments to the first account's ticket.
6. Verify an employee cannot PATCH a ticket or assign themselves a privileged role.
7. Stop the API and verify the dashboard displays an error.
8. Check the layout on a narrow screen and run the production client build.
