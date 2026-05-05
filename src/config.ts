import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://zoje:zoje_password@127.0.0.1:55432/zoje',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000',
  authSecret:
    process.env.AUTH_SECRET ?? 'local_dev_zoje_admin_secret_change_me',
  adminEmail: process.env.ADMIN_EMAIL ?? 'samandar8939522@gmail.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'samandar2001',
};
