import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/types";

const COOKIE_NAME = "mylist_session";
const SESSION_DAYS = 30;

// ---------------------------------------------------------------------------
// Session secret resolution
// 1. `SESSION_SECRET` env var (REQUIRED in production — see .env.example).
// 2. Otherwise a strong random secret is generated once and persisted to
//    `db/.session-secret` so local/dev and self-hosted deployments keep
//    sessions valid across server restarts without any manual setup.
// 3. On read-only filesystems (some serverless platforms) a deterministic
//    fallback is used with a loud warning — set SESSION_SECRET there.
// ---------------------------------------------------------------------------
let cachedSecret: Uint8Array | null = null;

function fileSecretPath(): string {
  return join(process.cwd(), "db", ".session-secret");
}

function devFallbackSecret(): Uint8Array {
  // Keep everything in-memory first: cheap, safe, no side effects.
  if (cachedSecret) return cachedSecret;
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    cachedSecret = new TextEncoder().encode(secret);
    return cachedSecret;
  }
  // Try a persistent on-disk secret (survives restarts, per-installation).
  try {
    const path = fileSecretPath();
    if (existsSync(path)) {
      const stored = readFileSync(path, "utf8").trim();
      if (stored.length >= 32) {
        console.warn(
          "[auth] SESSION_SECRET not set — using persisted secret from db/.session-secret",
        );
        cachedSecret = new TextEncoder().encode(stored);
        return cachedSecret;
      }
    }
    const generated = randomBytes(32).toString("hex");
    mkdirSync(join(process.cwd(), "db"), { recursive: true });
    writeFileSync(path, generated, { mode: 0o600 });
    console.warn(
      "[auth] SESSION_SECRET not set — generated & persisted one at db/.session-secret (set SESSION_SECRET in production)",
    );
    cachedSecret = new TextEncoder().encode(generated);
    return cachedSecret;
  } catch {
    // Read-only filesystem — last-resort deterministic fallback.
    console.warn(
      "[auth] SESSION_SECRET missing and filesystem is read-only — using an ephemeral fallback. Set SESSION_SECRET!",
    );
    cachedSecret = new TextEncoder().encode(
      "mylist-ephemeral-dev-secret-change-me!!",
    );
    return cachedSecret;
  }
}

function getSecret(): Uint8Array {
  return devFallbackSecret();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  userId: string,
  email: string,
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
}): AuthUser {
  return { id: user.id, email: user.email, name: user.name };
}

/** Returns the authenticated user for a request, or null. */
export async function getSessionUser(
  req: NextRequest,
): Promise<AuthUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    if (!userId) return null;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return toAuthUser(user);
  } catch {
    return null;
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}