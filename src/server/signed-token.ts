import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small signed tokens (payload.signature, base64url). Lets orders and KYC results travel
 * in URLs without a database, and survive serverless instances that share no memory.
 * Production would store orders in Postgres; the token format would stay as the public order reference.
 */
const DEV_SECRET = "udyam-dev-secret-change-me";
const secret = () => process.env.ORDER_SECRET || DEV_SECRET;

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 22);

export function signToken(payload: unknown): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken<T>(token: string): T | undefined {
  const [body, sig] = token.split(".");
  if (!body || !sig) return undefined;
  const expected = sign(body);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return undefined;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return undefined;
  }
}
