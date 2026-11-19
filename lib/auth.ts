import crypto from "crypto";
import { cookies } from "next/headers";
import { supabase } from "./supabase";

export const SESSION_COOKIE_NAME = "mf_auth_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  username: string;
  displayName: string;
  role: "admin" | "staff";
  branchCode?: string | null;
  exp: number;
}

export interface StoredUser {
  username: string;
  displayName: string;
  role: "admin" | "staff";
  branchCode?: string | null;
  passwordHash: string;
  createdAt: string;
}

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "metfone-express-contract-secret-2026"
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = (storedHash || "").split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signSession(user: Omit<SessionUser, "exp">): string {
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as SessionUser;
    if (!parsed.username || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySession(token);
  } catch {
    return null;
  }
}

export async function getOrInitAuthUsers(): Promise<StoredUser[]> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "auth_users")
    .maybeSingle();

  let parsed: unknown = data?.value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed as StoredUser[];
  }

  // Seed default admin account if none exists yet
  const defaultAdmin: StoredUser = {
    username: process.env.AUTH_ADMIN_USER || "admin",
    displayName: "Administrator",
    role: "admin",
    branchCode: null,
    passwordHash: hashPassword(process.env.AUTH_ADMIN_PASS || "Abcapple20191@"),
    createdAt: new Date().toISOString(),
  };

  await supabase.from("settings").upsert({
    key: "auth_users",
    value: [defaultAdmin],
  });

  return [defaultAdmin];
}

export async function saveAuthUsers(users: StoredUser[]): Promise<void> {
  await supabase.from("settings").upsert({
    key: "auth_users",
    value: users,
  });
}

export async function resolveUserBranch(user: { username: string; role: string; branchCode?: string | null }): Promise<string | null> {
  if (user.branchCode && user.branchCode.trim()) {
    return user.branchCode.trim().toUpperCase();
  }
  // If username matches a branch code (case-insensitive) e.g. "mona", "bat", "PNPA"
  const clean = (user.username || "").trim().toUpperCase();
  if (clean && clean !== "ADMIN" && clean !== (process.env.AUTH_ADMIN_USER || "admin").toUpperCase()) {
    const { data: branch } = await supabase
      .from("branches")
      .select("code")
      .eq("code", clean)
      .maybeSingle();

    if (branch && branch.code) {
      return branch.code.toUpperCase();
    }
  }
  return null;
}
