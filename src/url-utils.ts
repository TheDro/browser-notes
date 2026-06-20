import type { Annotation, Scope } from './types';

interface NormalizedUrl {
  domain: string;
  path: string;
  normalized: string;
}

export function normalizeUrl(rawUrl: string): NormalizedUrl {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { domain: '', path: '', normalized: '' };
  }
  const domain = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/\/$/, '') || '/';
  return { domain, path, normalized: domain + path };
}

export function deriveUrlKey(rawUrl: string, scope: Scope): string {
  const { domain, normalized } = normalizeUrl(rawUrl);
  if (scope === 'domain') return domain;
  if (scope === 'prefix') {
    // Use the path up to (and including) the last segment
    return normalized;
  }
  return normalized;
}

export function matchesUrl(annotation: Annotation, currentUrl: string): boolean {
  const { domain, normalized } = normalizeUrl(currentUrl);
  const key = annotation.urlKey;

  if (annotation.scope === 'domain') {
    return domain === key;
  }
  if (annotation.scope === 'prefix') {
    return normalized === key || normalized.startsWith(key + '/');
  }
  // exact
  return normalized === key;
}

export function getPrefixUrlKey(rawUrl: string): string {
  const { domain, path } = normalizeUrl(rawUrl);
  if (path === '/') return domain + '/';
  const lastSlash = path.lastIndexOf('/');
  const prefix = lastSlash > 0 ? path.slice(0, lastSlash) : '/';
  return domain + prefix;
}
