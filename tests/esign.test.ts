import { describe, expect, it } from "vitest";
import { esignFor, startEsign, verifyEsign } from "@/server/esign";
import { signToken } from "@/server/signed-token";

const passing = signToken({ caseId: "case_a", verdict: "PASS", business: "Kaveri", iat: 0 });
const rejected = signToken({ caseId: "case_b", verdict: "REJECT", business: "X", iat: 0 });

describe("mock Aadhaar-OTP e-sign", () => {
  it("signs with the right code and the token unlocks only the same case", () => {
    const s = startEsign(passing, 1000);
    if ("error" in s) throw new Error(s.error);
    expect(s.demoOtp).toMatch(/^\d{6}$/);
    const v = verifyEsign(s.challenge, s.demoOtp, 2000);
    if ("error" in v) throw new Error(v.error);
    expect(esignFor(v.esignToken, "case_a")?.business).toBe("Kaveri");
    expect(esignFor(v.esignToken, "case_other")).toBeUndefined();
  });
  it("refuses a failed document check, a wrong code, an expired code and a swapped token", () => {
    expect(startEsign(rejected)).toMatchObject({ status: 409 });
    const s = startEsign(passing, 0);
    if ("error" in s) throw new Error(s.error);
    const wrong = s.demoOtp === "000000" ? "111111" : "000000";
    expect(verifyEsign(s.challenge, wrong, 10)).toMatchObject({ status: 401 });
    expect(verifyEsign(s.challenge, s.demoOtp, 6 * 60_000)).toMatchObject({ status: 410 });
    // The challenge itself, or the KYC token, is not an e-sign.
    expect(esignFor(s.challenge, "case_a")).toBeUndefined();
    expect(esignFor(passing, "case_a")).toBeUndefined();
  });
});
