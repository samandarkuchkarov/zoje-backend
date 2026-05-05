# Zoje Backend

Node.js API for the Zoje catalog. Product data lives in PostgreSQL; the frontend reads products from this API instead of importing static JSON.

## Stack

- Node.js + TypeScript
- Express
- PostgreSQL
- Plain SQL migrations

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API runs at `http://localhost:4000`.
PostgreSQL is exposed on host port `55432`.
Backend-hosted image assets are served from `http://localhost:4000/assets`.

## Free Deploy Notes

Use a free external Postgres database, for example Neon, and host this backend as a Docker app.

1. Create the Postgres database and copy its connection string.
2. Set deployment environment variables:
   - `DATABASE_URL`
   - `CORS_ORIGIN`
   - `PUBLIC_BASE_URL`
   - `AUTH_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. Build the Docker image from this folder.
4. Start command is `pnpm deploy:start`.
5. Run `pnpm deploy:seed` once after the first deploy to import products.

Do not run `deploy:seed` on every start, because it can overwrite product edits made in admin.

## Endpoints

- `GET /health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products?featured=true`
- `GET /api/products?category=industrial&sort=priceAsc`
- `GET /api/products/:slug`
- `GET /api/products/:slug/related`

## Environment

| Variable | Description |
|---|---|
| `PORT` | API port, defaults to `4000` |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins |
| `PUBLIC_BASE_URL` | Public backend URL used to generate full asset URLs |
| `SEED_PRODUCTS_PATH` | JSON source for the initial seed |
