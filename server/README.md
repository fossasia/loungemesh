# LoungeMesh Backend API Server

The LoungeMesh backend is built with Node.js, TypeScript, Express, Prisma ORM, PostgreSQL database, and Redis cache. It provides user management, authentication, scheduled call management, Google Calendar syncing, rate-limiting, and persistent state management for whiteboard drawing, session notes, active polls, and room permission settings.

---

## Getting Started

### Installation
From the root of the project, Jitsi and Node components must be installed:
```bash
npm install
npm --prefix server install
```

### Running in Development Mode
Start the Express server with local Hot Module Replacement (HMR) watch mode:
```bash
npm --prefix server run dev
```

---

## Configuration (`.env`)

All passwords, secrets, ports, and API credentials are configuration-driven using environment variables. Create a `.env` file in the root directory.

Key variables required by the server:

| Variable | Description |
|----------|-------------|
| `PORT` | Listening port for the Express API server (default: `5000`). |
| `DATABASE_URL` | PostgreSQL connection URL (e.g. `postgresql://user:pass@127.0.0.1:5432/db`). |
| `REDIS_URL` | Redis server connection URL (e.g. `redis://127.0.0.1:6379`). |
| `JWT_SECRET` | Secret key used to sign HTTP session cookie JSON Web Tokens (JWT). |
| `ENCRYPTION_KEY` | 32-byte (64 character) hexadecimal encryption key used to encrypt Google OAuth tokens using AES-256-GCM. |
| `ALLOWED_OAUTH_ORIGINS` | Comma-separated domains whitelisted for dynamic Google OAuth callback redirection. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Client credentials used to coordinate scheduled call calendars. |

---

## Database Schema & Prisma Migrations

Prisma ORM is used to manage database tables, structures, and schema evolution. Always execute schema migration commands against your local database or using database connection credentials.

### 1. Generating Prisma Client
Regenerate client typings when database models change:
```bash
# Execute local project Prisma CLI generator
DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:generate
```

### 2. Creating & Applying Migrations (Development)
When you modify `server/prisma/schema.prisma` in development, run the local migration command to generate the SQL migration file and apply it:
```bash
# Set connection URL and name your migration
DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:migrate -- --name your_migration_name
```
This generates a migration inside `server/prisma/migrations/` and updates your local database schema.

### 3. Deploying Migrations (Production/Staging)
During automated deployment or container initialization, apply outstanding migrations safely:
```bash
# Deploys only pending migration files without dev warnings
DATABASE_URL="postgresql://loungemesh:loungemesh@postgres:5432/loungemesh?schema=public" npm --prefix server run prisma:deploy
```

### 4. Database Schema Rollbacks

If a migration fails or you need to revert changes, use the following workflows:

#### Reverting to a Prior Schema State (Development)
If you want to rollback a change that has not been deployed to production:
1. Revert the modifications in `server/prisma/schema.prisma` back to the desired prior state.
2. Run the migration command again to create a new "rollback" migration:
   ```bash
   DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:migrate -- --name rollback_migration
   ```
3. Generate typings to update the local client:
   ```bash
   DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:generate
   ```

#### resetting the Database (Development Only)
If your migrations get out of sync or corrupted in development, reset and re-apply all migrations:
```bash
DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npx prisma migrate reset --schema=server/prisma/schema.prisma
```
*(Caution: This deletes all data and re-runs all migrations from scratch).*

#### Mark a Migration as Manually Rolled Back (Production)
If you had to manually restore database state from a backup or revert a migration at database level:
```bash
DATABASE_URL="postgresql://loungemesh:loungemesh@postgres:5432/loungemesh?schema=public" npx prisma migrate resolve --rolled-back <migration_folder_name> --schema=server/prisma/schema.prisma
```

---

## Prisma Studio
View, search, edit, and inspect table rows dynamically using the web GUI:
```bash
DATABASE_URL="postgresql://loungemesh:loungemesh@127.0.0.1:5432/loungemesh?schema=public" npm --prefix server run prisma:studio
```
Opens [http://localhost:5555](http://localhost:5555).
