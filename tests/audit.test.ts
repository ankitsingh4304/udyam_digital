import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { _useLocalStoreForTests } from "@/server/store";

_useLocalStoreForTests(path.join(mkdtempSync(path.join(tmpdir(), "store-")), "store.json"));
const audit = await import("@/server/audit-log");

describe("hash-chained audit log", () => {
  it("chains entries and the chain verifies", async () => {
    const id = audit.newCaseId();
    await audit.appendAudit("CONSENT_GIVEN", id, { purposes: { kyc: true, installation: true, offers: false } });
    await audit.appendAudit("CONSENT_WITHDRAWN", id, {});
    const list = await audit.auditEntries();
    expect(list.map((e) => e.seq)).toEqual([1, 2]);
    expect(audit.verifyAuditChain(list).ok).toBe(true);
  });

  it("concurrent writers still produce one unbroken chain", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => audit.appendAudit("KYC_PROCESSED", `case_0000000${i % 10}`, { verdict: "PASS" })));
    const list = await audit.auditEntries();
    expect(new Set(list.map((e) => e.seq)).size).toBe(list.length);
    expect(audit.verifyAuditChain(list).ok).toBe(true);
  });

  it("editing any past entry breaks the chain at that entry", async () => {
    const list = structuredClone(await audit.auditEntries());
    (list[0].data as Record<string, unknown>).purposes = { kyc: true, installation: true, offers: true }; // someone flips "offers" after the fact
    expect(audit.verifyAuditChain(list)).toEqual({ ok: false, brokenAt: list[0].seq });
  });

  it("deleting an entry is detected too", async () => {
    const list = structuredClone(await audit.auditEntries());
    expect(audit.verifyAuditChain(list.slice(1)).ok).toBe(false);
  });
});

describe("store on a read-only filesystem", () => {
  it("still records in memory and never throws", async () => {
    const { writeFileSync } = await import("node:fs");
    const blocker = path.join(mkdtempSync(path.join(tmpdir(), "ro-")), "file");
    writeFileSync(blocker, "x"); // a file where a folder is expected → writes fail (ENOTDIR)
    _useLocalStoreForTests(path.join(blocker, "sub", "store.json"));
    const e = await audit.appendAudit("CONSENT_GIVEN", audit.newCaseId(), { purposes: { kyc: true } });
    expect(e.seq).toBe(1);
    expect((await audit.auditEntries()).length).toBe(1);
  });
});
