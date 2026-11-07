/**
 * Demo back-office accounts. In production these come from the partner management system
 * with real authentication (SSO for staff, OTP for partners). PINs can be overridden by env.
 */
export type Role = "partner" | "admin";
export interface Account {
  id: string;
  role: Role;
  name: string;
  /** Partners only see leads in their city. */
  city?: string;
  pin: string;
}

const PARTNER_PIN = process.env.PARTNER_DEMO_PIN || "1234";
const ADMIN_PIN = process.env.ADMIN_DEMO_PIN || "9999";

export const ACCOUNTS: Account[] = [
  { id: "P-NAG-01", role: "partner", name: "Sharma Telecom", city: "Nagpur", pin: PARTNER_PIN },
  { id: "P-MUM-01", role: "partner", name: "Mumbai Connect", city: "Mumbai", pin: PARTNER_PIN },
  { id: "P-DEL-01", role: "partner", name: "Capital Comms", city: "Delhi", pin: PARTNER_PIN },
  { id: "P-BLR-01", role: "partner", name: "Namma Networks", city: "Bengaluru", pin: PARTNER_PIN },
  { id: "ADMIN", role: "admin", name: "Accel Business Operations", pin: ADMIN_PIN },
];

export const findAccount = (id: string, pin: string) => ACCOUNTS.find((a) => a.id === id.trim().toUpperCase() && a.pin === pin.trim());
