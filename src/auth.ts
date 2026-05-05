import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { pool } from './db.js';

const scrypt = promisify(scryptCallback);
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

type TokenPayload = {
  sub: number;
  email: string;
  exp: number;
};

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', config.authSecret).update(value).digest('base64url');
}

export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return {
    salt,
    hash: derived.toString('hex'),
  };
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createToken(payload: Omit<TokenPayload, 'exp'>) {
  const tokenPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(tokenPayload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyToken(token: string): TokenPayload | undefined {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) return undefined;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return undefined;
    return payload;
  } catch {
    return undefined;
  }
}

export async function authenticateAdmin(email: string, password: string) {
  const result = await pool.query(
    'SELECT id, email, password_hash, password_salt FROM admins WHERE email = $1',
    [email.toLowerCase()]
  );
  const admin = result.rows[0] as
    | { id: number; email: string; password_hash: string; password_salt: string }
    | undefined;

  if (!admin) return undefined;

  const valid = await verifyPassword(password, admin.password_salt, admin.password_hash);
  if (!valid) return undefined;

  return {
    id: admin.id,
    email: admin.email,
    token: createToken({ sub: admin.id, email: admin.email }),
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? verifyToken(token) : undefined;

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.locals.admin = payload;
  next();
}
