import { createHash } from 'crypto';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashContent(text: string): string {
  const normalized = normalizeText(text);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
