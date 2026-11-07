import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** True on serverless hosts (Vercel, AWS Lambda) where only the temp folder is writable. */
export const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.cwd().startsWith("/var/task")
);

const preferred = process.env.UDYAM_WRITABLE_DIR ?? (IS_SERVERLESS ? path.join(tmpdir(), "udyam") : path.join(process.cwd(), ".data"));

/**
 * A folder we can write to. If the preferred one can't be created (read-only filesystem),
 * fall back to the OS temp folder instead of failing the request.
 */
function resolveWritable(): string {
  for (const dir of [preferred, path.join(tmpdir(), "udyam")]) {
    try {
      mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      /* try the next candidate */
    }
  }
  return tmpdir();
}

export const WRITABLE_DIR = resolveWritable();
