import type { Annotation, Scope } from './types';

interface NormalizedUrl {
  domain: string;
  normalized: string;
}

export function normalizeUrl(rawUrl: string): NormalizedUrl {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { domain: '', normalized: '' };
  }
  const domain = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/\/$/, '') || '/';
  return { domain, normalized: domain + path };
}

export function deriveUrlKey(rawUrl: string, scope: Scope): string {
  const { domain, normalized } = normalizeUrl(rawUrl);
  if (scope === 'domain') return domain;
  return normalized;
}

export function matchesUrl(annotation: Annotation, currentUrl: string): boolean {
  const { domain, normalized } = normalizeUrl(currentUrl);
  const key = annotation.urlKey;

  if (annotation.scope === 'domain') {
    return domain === key;
  }
  // exact
  return normalized === key;
}
