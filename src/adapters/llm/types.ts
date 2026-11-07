export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonRequest {
  system: string;
  messages: ChatMessage[];
  /** Optional image for document reading (base64, no data: prefix). */
  image?: { base64: string; mimeType: string };
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  /** False when no image-capable model is configured; the chain skips it for vision calls. */
  readonly supportsVision?: boolean;
  /** Returns the raw text the model produced (expected to be JSON when json=true). */
  complete(req: JsonRequest, opts: { json: boolean; vision?: boolean; signal?: AbortSignal }): Promise<string>;
}

/** Thrown for rate limits so the chain can back off this provider. */
export class RateLimitError extends Error {
  constructor(
    public provider: string,
    public retryAfterMs: number,
  ) {
    super(`${provider} rate limited; retry after ${retryAfterMs} ms`);
  }
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
  ) {
    super(`${provider} ${status}: ${message}`);
  }
}
