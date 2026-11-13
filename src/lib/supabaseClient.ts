import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://pupcjjvrnsarqjzwrvvc.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cGNqanZybnNhcnFqendydnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNDk0NDAsImV4cCI6MjEwOTgyNTQ0MH0.rqIuHGqMef0JxByGDCsypl22ieHfa_8Tp4gLXv4hxno';

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

function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] || null;
}

function sanitizeSupabaseAnonKey(rawKey: string | undefined, url: string): string {
  const cleaned = (rawKey || '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_SUPABASE_ANON_KEY;

  // Preserve modern sb_publishable_ keys as-is
  if (cleaned.startsWith('sb_')) return cleaned;

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 3) return cleaned;

  const targetRef = extractProjectRef(url);

  // Recover valid 3-part JWT if multiple tokens were concatenated in the secret
  if (parts.length > 3) {
    let firstValidJwt: string | null = null;
    for (let i = 0; i <= parts.length - 3; i++) {
      const header = decodeBase64UrlJson(parts[i]);
      const payload = decodeBase64UrlJson(parts[i + 1]);
      if (header?.alg && payload?.iss === 'supabase') {
        const candidate = `${parts[i]}.${parts[i + 1]}.${parts[i + 2]}`;
        if (!firstValidJwt) firstValidJwt = candidate;
        if (!targetRef || payload.ref === targetRef) {
          return candidate;
        }
      }
    }
    if (firstValidJwt) return firstValidJwt;
  }

  return cleaned;
}

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as any);
const rawUrl = (env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL).trim().replace(/^["']|["']$/g, '');
const supabaseUrl = rawUrl || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = sanitizeSupabaseAnonKey(env.VITE_SUPABASE_ANON_KEY, supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
