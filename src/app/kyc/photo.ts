/**
 * Prepare a phone photo for upload: phones take 8–50 MP pictures (5–15 MB) and iPhones may send HEIC.
 * Large or unusual images are shrunk to 2000 px and re-encoded as JPEG in the browser, which makes
 * uploads fast on mobile data. Small PNG/JPEG files (e.g. the sample documents) are sent untouched,
 * so their saved readings still match.
 */
const MAX_SIDE = 2000;
const KEEP_BYTES = 2_000_000;

export async function preparePhoto(file: File): Promise<File | null> {
  const simple = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Browser can't decode it (e.g. HEIC outside Safari). Send as-is only if the server can read it.
    return simple ? file : null;
  }
  const side = Math.max(bitmap.width, bitmap.height);
  if (simple && file.size <= KEEP_BYTES && side <= MAX_SIDE + 200) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / side);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) return simple ? file : null;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
