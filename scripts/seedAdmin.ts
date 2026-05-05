import { config } from '../src/config.js';
import { pool, closePool } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

async function main() {
  const { salt, hash } = await hashPassword(config.adminPassword);
  await pool.query(
    `
    INSERT INTO admins (email, password_hash, password_salt, updated_at)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      updated_at = now()
    `,
    [config.adminEmail.toLowerCase(), hash, salt]
  );

  console.log(`Seeded admin ${config.adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
