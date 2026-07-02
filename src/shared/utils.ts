import path from "node:path";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function safeFilename(value: string | null | undefined, fallback = "untitled"): string {
  const cleaned = cleanText(value)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

export function messageKey(chatId: string, messageId: string): string {
  return `${chatId}::${messageId}`;
}

export function makeTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function ensureInside(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const rootResolved = path.resolve(root);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(`Refusing to write outside export folder: ${relativePath}`);
  }
  return resolved;
}
