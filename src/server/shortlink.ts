import { randomBytes } from "node:crypto";
import { getStore } from "./store";

/**
 * Short links for chat messages: signed quote and order links are long; WhatsApp shows them
 * better short. The id is random (48 bits), so links can't be guessed; the target is unchanged.
 */
export async function shortLink(origin: string, path: string): Promise<string> {
  try {
    const id = randomBytes(6).toString("base64url");
    await getStore().set(`link:${id}`, path);
    return `${origin}/l/${id}`;
  } catch {
    return origin + path; // store unavailable: the long link still works
  }
}
export const resolveLink = (id: string) => getStore().get<string>(`link:${id}`);
