export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];

export const DELAY = { min: 500, max: 1500 };

export function randomViewport(): { width: number; height: number } {
  const idx = Math.floor(Math.random() * VIEWPORTS.length);
  return VIEWPORTS[idx] ?? { width: 1920, height: 1080 };
}

export function randomUserAgent(): string {
  const idx = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[idx] ?? USER_AGENTS[0] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
}

export function randomDelay(): number {
  return DELAY.min + Math.random() * (DELAY.max - DELAY.min);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
