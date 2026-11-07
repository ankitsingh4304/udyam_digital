import type { ExtractedDocsInput } from "@/domain/kyc/types";

/**
 * What the extraction layer reads from data/kyc_documents/K01–K12.
 * Source: Tesseract 5 run on every image (blur = Laplacian variance), line-wrapped
 * addresses re-joined. One field corrected to the vision-model read: K10's GSTIN,
 * where Tesseract reads 'J' as 'I' (the printed glyph is 'J').
 * Printed defects are kept exactly as printed (K02/K08 '0', K06 digits).
 */
const ok = (blurScore: number, skewDeg = 0) => ({ blurScore, skewDeg });

export const KYC_FIXTURES: Record<string, ExtractedDocsInput> = {
  K01: {
    gst: { quality: ok(1258), gstin: "37IHKXV5167L1ZS", legalName: "Neha Kaur (Prop. Vindhya Tours & Travels)", tradeName: "Vindhya Tours & Travels", constitution: "Proprietorship", address: "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383", dateOfLiability: "2025-06-07" },
    udyam: { quality: ok(937), udyamNumber: undefined, enterpriseName: "Vindhya Tours & Travels", majorActivity: "Services", city: "Visakhapatnam", state: "Andhra Pradesh", dateOfRegistration: "2024-03-24" },
    signatory: { quality: ok(1864), name: "Neha Kaur", designation: "Office admin", business: "Vindhya Tours & Travels", validTill: "2028-03-26" },
    addressProof: { quality: ok(1016), billedTo: "Vindhya Tours & Travels", address: "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383", billDate: "2026-06-26" },
  },
  K02: {
    gst: { quality: ok(1247, 8), gstin: "19E0GXH4115Y1ZL", legalName: "Joseph Shah (Prop. Harmony Dental Care)", tradeName: "Harmony Dental Care", constitution: "Proprietorship", address: "Shop/Unit 199, Station Road, Kolkata, West Bengal - 347550", dateOfLiability: "2022-04-17" },
    udyam: { quality: ok(964), udyamNumber: "UDYAM-WB-00-5053330", enterpriseName: "Harmony Dental Care", majorActivity: "Services", city: "Kolkata", state: "West Bengal", dateOfRegistration: "2023-01-11" },
    signatory: { quality: ok(1825), name: "Joseph Shah", designation: "Manager", business: "Harmony Dental Care", validTill: "2028-09-10" },
    addressProof: { quality: ok(981), billedTo: "Harmony Dental Care", address: "Shop/Unit 199, Station Road, Kolkata, West Bengal - 347550", billDate: "2026-05-22" },
  },
  K03: {
    gst: { quality: ok(1213), gstin: "27XUIXG0767D1ZP", legalName: "Joseph Singh (Prop. Ganesh Woodcraft)", tradeName: "Ganesh Woodcraft", constitution: "Proprietorship", address: "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231", dateOfLiability: "2020-02-10" },
    udyam: { quality: ok(974), udyamNumber: "UDYAM-MH-00-9516696", enterpriseName: "Ganesh Woodcraft", majorActivity: "Manufacturing", city: "Nagpur", state: "Maharashtra", dateOfRegistration: "2024-11-21" },
    signatory: { quality: ok(1798), name: "Joseph Singh", designation: "Owner", business: "Ganesh Woodcraft", validTill: "2028-07-04" },
    addressProof: { quality: ok(967), billedTo: "Ganesh Woodcraft", address: "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231", billDate: "2026-05-30" },
  },
  K04: {
    gst: { quality: ok(1) },
    udyam: { quality: ok(966), udyamNumber: "UDYAM-MH-00-6131836", enterpriseName: "Saffron Dental Care LLP", majorActivity: "Services", city: "Nagpur", state: "Maharashtra", dateOfRegistration: "2025-05-17" },
    signatory: { quality: ok(1838), name: "Fatima Pillai", designation: "Partner", business: "Saffron Dental Care LLP", validTill: "2028-08-03" },
    addressProof: { quality: ok(998), billedTo: "Saffron Dental Care LLP", address: "Shop/Unit 75, Lake View Colony, Nagpur, Maharashtra - 137452", billDate: "2026-05-28" },
  },
  K05: {
    gst: { quality: ok(1170), gstin: "32TZAXB5481U1Z1", legalName: "Balaji Realty LLP", tradeName: "Balaji Realty LLP", constitution: "Limited Liability Partnership", address: "Shop/Unit 38, Civil Lines, Kochi, Kerala - 752083", dateOfLiability: "2020-07-26" },
    signatory: { quality: ok(1772), name: "Anita Shah", designation: "Owner", business: "Balaji Realty LLP", validTill: "2029-09-11" },
    addressProof: { quality: ok(946), billedTo: "Balaji Realty LLP", address: "Shop/Unit 38, Civil Lines, Kochi, Kerala - 752083", billDate: "2026-06-11" },
  },
  K06: {
    gst: { quality: ok(1213), gstin: "08YKZXS8189L1Z0", legalName: "Pooja Shah (Prop. Saffron Unisex Salon)", tradeName: "Saffron Unisex Salon", constitution: "Proprietorship", address: "Shop/Unit 71, Market Yard, Jaipur, Rajasthan - 194057", dateOfLiability: "2019-09-25" },
    udyam: { quality: ok(945), udyamNumber: "UDYAM-RJ-00-6577157", enterpriseName: "Saffron Unisex Salon", majorActivity: "Services", city: "Jaipur", state: "Rajasthan", dateOfRegistration: "2023-01-24" },
    signatory: { quality: ok(1800), name: "Pooja Shah", designation: "Owner", business: "Saffron Unisex Salon", validTill: "2028-09-15" },
    addressProof: { quality: ok(969), billedTo: "Saffron Unisex Salon", address: "Shop/Unit 71, Market Yard, Jaipur, Rajasthan - 194057", billDate: "2026-06-11" },
  },
  K07: {
    gst: { quality: ok(1207), gstin: "07CPCXN0398P1ZT", legalName: "Neha Banerjee (Prop. Shri Physio Clinic)", tradeName: "Neelgiri Physio Clinic", constitution: "Proprietorship", address: "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596", dateOfLiability: "2024-01-13" },
    udyam: { quality: ok(931), udyamNumber: "UDYAM-DL-00-9565547", enterpriseName: "Neelgiri Physio Clinic", majorActivity: "Services", city: "Delhi", state: "Delhi", dateOfRegistration: "2024-07-14" },
    signatory: { quality: ok(1865), name: "Neha Banerjee", designation: "Manager", business: "Neelgiri Physio Clinic", validTill: "2030-05-05" },
    addressProof: { quality: ok(967), billedTo: "Neelgiri Physio Clinic", address: "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596", billDate: "2026-07-05" },
  },
  K08: {
    gst: { quality: ok(1262), gstin: "24X0RXG9365M1Z3", legalName: "Joseph Rao (Prop. Green Leaf Legal Associates)", tradeName: "Green Leaf Legal Associates", constitution: "Proprietorship", address: "Shop/Unit 238, Ring Road, Vadodara, Gujarat - 348176", dateOfLiability: "2018-12-01" },
    udyam: { quality: ok(972), udyamNumber: "UDYAM-GJ-00-8477445", enterpriseName: "Green Leaf Legal Associates", majorActivity: "Services", city: "Vadodara", state: "Gujarat", dateOfRegistration: "2022-11-12" },
    signatory: { quality: ok(1912), name: "Joseph Rao", designation: "Office admin", business: "Green Leaf Legal Associates", validTill: "2027-09-18" },
    addressProof: { quality: ok(999), billedTo: "Green Leaf Legal Associates", address: "Shop/Unit 238, Ring Road, Vadodara, Gujarat - 348176", billDate: "2026-05-26" },
  },
  K09: {
    gst: { quality: ok(1274), gstin: "37LDYXK0296F1ZB", legalName: "Anita Kulkarni (Prop. Kaveri Insurance Advisors)", tradeName: "Kaveri Insurance Advisors", constitution: "Proprietorship", address: "Shop/Unit 217, Civil Lines, Visakhapatnam, Andhra Pradesh - 405337", dateOfLiability: "2023-09-20" },
    udyam: { quality: ok(998), udyamNumber: "UDYAM-AP-00-9751562", enterpriseName: "Kaveri Insurance Advisors", majorActivity: "Services", city: "Visakhapatnam", state: "Andhra Pradesh", dateOfRegistration: "2023-07-04" },
    signatory: { quality: ok(1925), name: "Anita Kulkarni", designation: "Office admin", business: "Kaveri Insurance Advisors", validTill: "2027-12-22" },
    addressProof: { quality: ok(1015), billedTo: "Kaveri Insurance Advisors", address: "Shop/Unit 217, Civil Lines, Visakhapatnam, Andhra Pradesh - 405337", billDate: "2026-07-10" },
  },
  K10: {
    gst: { quality: ok(1185), gstin: "27QHJXK0658U1ZL", legalName: "Kaveri Stays LLP", tradeName: "Kaveri Stays LLP", constitution: "Limited Liability Partnership", address: "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043", dateOfLiability: "2022-07-13" },
    udyam: { quality: ok(949), udyamNumber: "UDYAM-MH-00-7183141", enterpriseName: "Kaveri Stays LLP", majorActivity: "Services", city: "Mumbai", state: "Maharashtra", dateOfRegistration: "2024-01-09" },
    signatory: { quality: ok(1770), name: "Nisha Arora", designation: "Owner", business: "Kaveri Stays LLP", validTill: "2029-06-01" },
    addressProof: { quality: ok(960), billedTo: "Kaveri Stays LLP", address: "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043", billDate: "2026-06-18" },
  },
  K11: {
    gst: { quality: ok(1250), gstin: "03KGZXT1320R1ZZ", legalName: "Trinity Bake House Pvt Ltd", tradeName: "Trinity Bake House Pvt Ltd", constitution: "Private Limited Company", address: "Shop/Unit 188, Industrial Area Phase 2, Ludhiana, Punjab - 541498", dateOfLiability: "2019-08-19" },
    udyam: { quality: ok(960), udyamNumber: "UDYAM-PB-00-9719478", enterpriseName: "Trinity Bake House Pvt Ltd", majorActivity: "Services", city: "Ludhiana", state: "Punjab", dateOfRegistration: "2025-09-15" },
    signatory: { quality: ok(1861), name: "Vikram Pillai", designation: "Owner", business: "Trinity Bake House Pvt Ltd", validTill: "2028-12-23" },
    addressProof: { quality: ok(1004), billedTo: "Trinity Bake House Pvt Ltd", address: "Shop/Unit 188, Industrial Area Phase 2, Ludhiana, Punjab - 541498", billDate: "2025-10-31" },
  },
  K12: {
    gst: { quality: ok(1234), gstin: "37NBLXS1145E1ZU", legalName: "Pooja Agarwal (Prop. Star Electronics)", tradeName: "Star Electronics", constitution: "Proprietorship", address: "Shop/Unit 216, Nehru Nagar, Visakhapatnam, Andhra Pradesh - 762071", dateOfLiability: "2017-01-08" },
    udyam: { quality: ok(975), udyamNumber: "UDYAM-AP-00-5186772", enterpriseName: "Star Electronics", majorActivity: "Services", city: "Visakhapatnam", state: "Andhra Pradesh", dateOfRegistration: "2024-02-03" },
    signatory: { quality: ok(1789), name: "Pooja Agarwal", designation: "Owner", business: "Star Electronics", validTill: "2029-03-03" },
    addressProof: { quality: ok(999), billedTo: "Star Electronics", address: "Shop/Unit 216, Nehru Nagar, Visakhapatnam, Andhra Pradesh - 762071", billDate: "2026-07-06" },
  },
};
