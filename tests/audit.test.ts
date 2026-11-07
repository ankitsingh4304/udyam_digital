import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.UDYAM_AUDIT_LOG = path.join(mkdtempSync(path.join(tmpdir(), "audit-")), "audit.jsonl");
const audit = await import("@/server/audit-log");

describe("hash-chained audit log", () => {
  it("records consent, then withdrawal, and the chain verifies", () => {
    const id = audit.newCaseId();
    audit.appendAudit("CONSENT_GIVEN", id, { purposes: { kyc: true, installation: true, offers: false } });
    expect(audit.activeConsent(id)?.kyc).toBe(true);
    audit.appendAudit("CONSENT_WITHDRAWN", id, {});
    expect(audit.activeConsent(id)).toBeUndefined();
    expect(audit.verifyAuditChain().ok).toBe(true);
  });

  it("editing any past entry breaks the chain at that entry", () => {
    const list = structuredClone(audit.auditEntries());
    (list[0].data as Record<string, unknown>).purposes = { kyc: true, installation: true, offers: true }; // someone flips "offers" after the fact
    expect(audit.verifyAuditChain(list)).toEqual({ ok: false, brokenAt: list[0].seq });
  });

  it("deleting an entry is detected too", () => {
    const list = structuredClone(audit.auditEntries());
    expect(audit.verifyAuditChain(list.slice(1)).ok).toBe(false);
  });
});
