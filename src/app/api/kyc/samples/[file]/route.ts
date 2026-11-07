import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/server/data";

export const runtime = "nodejs";

/** Serves the hackathon specimen images (K01–K12) for the "try a sample applicant" demo. */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  if (!/^K(0[1-9]|1[0-2])_(gst_certificate|udyam_certificate|signatory_id|address_proof)\.png$/.test(params.file))
    return new Response("Not found", { status: 404 });
  try {
    const buf = readFileSync(path.join(DATA_DIR, "kyc_documents", params.file));
    return new Response(new Uint8Array(buf), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
