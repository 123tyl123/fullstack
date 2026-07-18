# Backend

Go + Gin + Gorm + MySQL backend scaffold.

## Run

```powershell
cd backend
Copy-Item .env.example .env
go mod tidy
go run ./cmd/api
```

Normal startup only starts the HTTP server. It does not create or migrate tables.

## Migrate

Run migrations only when you want to create or update tables:

```powershell
cd backend
go run ./cmd/migrate up
```

## Auth

API docs: `docs/auth-api.md`

Profile API docs: `docs/profile-api.md`

Register:

```text
POST /api/auth/register
```

```json
{
  "username": "admin",
  "nickname": "Admin",
  "email": "admin@example.com",
  "password": "password123"
}
```

Login:

```text
POST /api/auth/login
```

```json
{
  "account": "admin",
  "password": "password123"
}
```

Login and register return:

- `access_token`
- `refresh_token`
- `expires_in`
- `refresh_expires_at`
- `user`

Default server address:

```text
http://localhost:8080
```

Health check:

```text
GET /api/health
```

## Environment

Edit `.env` or set environment variables before starting the server.

```text
APP_ENV=debug
SERVER_PORT=8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=fullstack
```

## Structure

```text
cmd/api             application entry
cmd/migrate         manual migration command
docs                design docs
internal/config     environment config
internal/database   MySQL and Gorm setup
internal/handler    HTTP handlers
internal/migration  migration registration
internal/model      Gorm models
internal/response   unified JSON response helpers
internal/router     Gin routes and middleware
```
