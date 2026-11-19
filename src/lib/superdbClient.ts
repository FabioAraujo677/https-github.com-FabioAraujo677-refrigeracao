import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://auth.superdb.com.br';
const FALLBACK_ANON_KEY = 'missing-superdb-anon-key';

function decodeBase64UrlJson(segment: string): Record<string, any> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const jsonStr =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractProjectIdentifier(url: string): string | null {
  const pathMatch = url.match(/\/p\/([a-z0-9_-]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  const hostMatch = url.match(/https?:\/\/([a-z0-9-]+)\./i);
  return hostMatch?.[1] || null;
}

function cleanEnvValue(val?: string): string {
  return (val || '').trim().replace(/^["']|["']$/g, '');
}

function sanitizeSuperdbAnonKey(rawKey: string | undefined, url: string): string {
  const cleaned = cleanEnvValue(rawKey).replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_ANON_KEY;

  if (cleaned.startsWith('sb_')) return cleaned;

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 3) return cleaned;

  const targetId = extractProjectIdentifier(url);

  if (parts.length > 3) {
    let firstValidJwt: string | null = null;
    for (let i = 0; i <= parts.length - 3; i++) {
      const header = decodeBase64UrlJson(parts[i]);
      const payload = decodeBase64UrlJson(parts[i + 1]);
      if (header?.alg && payload) {
        const candidate = `${parts[i]}.${parts[i + 1]}.${parts[i + 2]}`;
        if (!firstValidJwt) firstValidJwt = candidate;
        const matchesProject =
          !targetId ||
          payload.ref === targetId ||
          (typeof payload.project_schema === 'string' && payload.project_schema.includes(targetId));
        if (matchesProject) {
          return candidate;
        }
      }
    }
    if (firstValidJwt) return firstValidJwt;
  }

  return cleaned;
}

const configuredSuperdbUrl = cleanEnvValue(import.meta.env?.VITE_SUPERDB_URL);
const configuredSuperdbKey = cleanEnvValue(
  import.meta.env?.VITE_SUPERDB_ANON_KEY || import.meta.env?.VITE_SUPERDB_ANON
);

const rawUrl = configuredSuperdbUrl || cleanEnvValue(import.meta.env?.VITE_SUPABASE_URL);
const rawKey = configuredSuperdbUrl
  ? configuredSuperdbKey
  : configuredSuperdbKey || cleanEnvValue(import.meta.env?.VITE_SUPABASE_ANON_KEY);

export const superdbUrl = (rawUrl || FALLBACK_URL).replace(/\/+$/, '');
export const superdbAnonKey = sanitizeSuperdbAnonKey(rawKey, superdbUrl);

if (!configuredSuperdbUrl || !configuredSuperdbKey) {
  console.warn(
    '[SuperDB] Verifique as variáveis de ambiente: VITE_SUPERDB_URL e VITE_SUPERDB_ANON_KEY (ou VITE_SUPERDB_ANON).'
  );
}

export const superdb = createClient(superdbUrl, superdbAnonKey);
