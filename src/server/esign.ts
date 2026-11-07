import { createHmac, randomInt } from "node:crypto";
import { signToken, verifyToken } from "./signed-token";

/**
 * Mock Aadhaar-OTP e-sign of the customer application form (CAF).
 * Production: an ESP (e.g. NSDL/eMudhra) sends the OTP to the Aadhaar-linked mobile and returns a signed PDF.
 * Demo: the OTP is shown on screen. Stateless: the challenge token carries only an HMAC of the OTP.
 */
const TTL_MS = 5 * 60_000;
const hashOtp = (requestId: string, otp: string) =>
  createHmac("sha256", process.env.ORDER_SECRET || "udyam-dev-secret-change-me").update(`${requestId}:${otp}`).digest("base64url");

type Kyc = { caseId: string; verdict: string; business: string };
type Challenge = { kind: "esign-challenge"; requestId: string; caseId: string; business: string; otpHash: string; exp: number };
export type Esign = { kind: "esign"; caseId: string; business: string; requestId: string; signedAt: string; method: "aadhaar-otp-demo" };

export type EsignError = { status: number; error: string };

export function startEsign(kycToken: string, now = Date.now()): { requestId: string; challenge: string; demoOtp: string; mobile: string } | EsignError {
  const kyc = verifyToken<Kyc>(kycToken);
  if (!kyc?.caseId) return { status: 403, error: "Document check could not be confirmed. Check the documents again." };
  if (kyc.verdict !== "PASS" && kyc.verdict !== "PASS_WITH_WARNINGS") return { status: 409, error: "Documents must pass the check before signing." };
  const requestId = `ES-${now.toString(36).toUpperCase()}${randomInt(100, 999)}`;
  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const challenge: Challenge = { kind: "esign-challenge", requestId, caseId: kyc.caseId, business: kyc.business, otpHash: hashOtp(requestId, otp), exp: now + TTL_MS };
  return { requestId, challenge: signToken(challenge), demoOtp: otp, mobile: "+91 98XXX XX210" };
}

export function verifyEsign(challengeToken: string, otp: string, now = Date.now()): { esignToken: string; esign: Esign } | EsignError {
  const c = verifyToken<Challenge>(challengeToken);
  if (!c || c.kind !== "esign-challenge") return { status: 403, error: "This signing request is not valid. Start again." };
  if (now > c.exp) return { status: 410, error: "The code has expired. Send a new code." };
  if (!/^\d{6}$/.test(otp) || hashOtp(c.requestId, otp) !== c.otpHash) return { status: 401, error: "That code is wrong. Check and try again." };
  const esign: Esign = { kind: "esign", caseId: c.caseId, business: c.business, requestId: c.requestId, signedAt: new Date(now).toISOString(), method: "aadhaar-otp-demo" };
  return { esignToken: signToken(esign), esign };
}

/** The orders route accepts only an e-sign for the same case as the document check. */
export function esignFor(esignToken: string | undefined, caseId: string): Esign | undefined {
  if (!esignToken) return undefined;
  const e = verifyToken<Esign>(esignToken);
  return e?.kind === "esign" && e.caseId === caseId ? e : undefined;
}
