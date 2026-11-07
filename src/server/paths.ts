import { tmpdir } from "node:os";
import path from "node:path";

/** Where runtime files may be written. Serverless hosts (Vercel) only allow /tmp. */
export const WRITABLE_DIR = process.env.UDYAM_WRITABLE_DIR ?? (process.env.VERCEL ? path.join(tmpdir(), "udyam") : path.join(process.cwd(), ".data"));
