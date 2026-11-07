import Papa from "papaparse";
import { editDistance } from "@/domain/kyc/gstin";
import type { GstinRecord, IRegistryService, UdyamRecord } from "@/domain/kyc/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Mock registry backed by mock_gstin_registry.csv and mock_udyam_registry.csv. */
export class CsvRegistryAdapter implements IRegistryService {
  private gstins = new Map<string, GstinRecord>();
  private udyams = new Map<string, UdyamRecord>();

  constructor(gstinCsv: string, udyamCsv: string) {
    for (const r of Papa.parse<Record<string, string>>(gstinCsv.trim(), { header: true }).data) {
      this.gstins.set(r.gstin, {
        gstin: r.gstin,
        legalName: r.legal_name,
        tradeName: r.trade_name,
        constitution: r.constitution,
        address: r.principal_place_of_business,
        state: r.state,
        registrationDate: r.registration_date,
        status: r.status as GstinRecord["status"],
      });
    }
    for (const r of Papa.parse<Record<string, string>>(udyamCsv.trim(), { header: true }).data) {
      this.udyams.set(r.udyam_number, {
        udyamNumber: r.udyam_number,
        enterpriseName: r.enterprise_name,
        enterpriseType: r.enterprise_type,
        majorActivity: r.major_activity,
        nicDescription: r.nic_description,
        state: r.state,
        city: r.city,
        dateOfRegistration: r.date_of_registration,
      });
    }
  }

  getGstin(gstin: string) {
    return this.gstins.get(gstin.trim().toUpperCase());
  }

  nearGstin(gstin: string, hint?: { tradeName?: string; city?: string }) {
    const g = gstin.trim().toUpperCase();
    const out: GstinRecord[] = [];
    for (const rec of this.gstins.values()) {
      if (rec.gstin === g) continue;
      const sameState = rec.gstin.slice(0, 2) === g.slice(0, 2);
      const close = sameState && editDistance(rec.gstin, g) <= 2;
      const sameName =
        !!hint?.tradeName &&
        norm(rec.tradeName) === norm(hint.tradeName) &&
        (!hint.city || norm(rec.address).includes(norm(hint.city)));
      if (close || sameName) out.push(rec);
    }
    return out;
  }

  getUdyam(udyamNumber: string) {
    return this.udyams.get(udyamNumber.replace(/\s+/g, "").toUpperCase());
  }

  findUdyamByName(enterpriseName: string, city?: string) {
    return [...this.udyams.values()].filter(
      (u) => norm(u.enterpriseName) === norm(enterpriseName) && (!city || norm(u.city) === norm(city)),
    );
  }
}
