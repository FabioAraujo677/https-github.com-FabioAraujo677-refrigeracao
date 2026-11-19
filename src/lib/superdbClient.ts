import { createClient, RealtimeClient, type WebSocketLikeConstructor } from '@supabase/supabase-js';

const DEFAULT_PROJECT_ID = '154a5ec3ff';
const FALLBACK_URL = `https://superdb.com.br/p/${DEFAULT_PROJECT_ID}`;
const FALLBACK_REALTIME_URL = `wss://superdb.com.br/p/${DEFAULT_PROJECT_ID}/realtime/v1`;
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
  return null;
}

function cleanEnvValue(val?: string): string {
  return (val || '').trim().replace(/^["']|["']$/g, '');
}

function stripDuplicateProtocol(raw: string, defaultScheme: 'https' | 'wss'): string {
  let cleaned = raw.trim().replace(/\s+/g, '');

  // Remove qualquer prefixo malformado repetido como wss://://, https://https://, ://
  cleaned = cleaned.replace(/^((?:https?|wss?):\/\/)+(?::\/\/)*/i, (match) => {
    const lower = match.toLowerCase();
    if (defaultScheme === 'wss') {
      return lower.startsWith('ws://') || lower.startsWith('http://') ? 'ws://' : 'wss://';
    }
    return lower.startsWith('http://') || lower.startsWith('ws://') ? 'http://' : 'https://';
  });

  cleaned = cleaned.replace(/^[:/]+/, '');

  if (!/^(?:https?|wss?):\/\//i.test(cleaned)) {
    cleaned = `${defaultScheme}://${cleaned}`;
  }

  return cleaned;
}

function normalizeSuperdbHttpUrl(raw?: string): string {
  let cleaned = cleanEnvValue(raw).replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_URL;

  cleaned = stripDuplicateProtocol(cleaned, 'https');
  if (/^wss?:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
  }

  try {
    const parsed = new URL(cleaned);
    if (!parsed.hostname) return FALLBACK_URL;

    // Preserva estritamente o caminho /p/<project_id> no final da URL base
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    cleanPath = cleanPath.replace(/\/(rest|auth|storage|functions|realtime)\/v1$/i, '');

    if (parsed.hostname === 'auth.superdb.com.br' && !/\/p\/[a-z0-9_-]+/i.test(cleanPath)) {
      return FALLBACK_URL;
    }

    if (
      (parsed.hostname === 'superdb.com.br' || parsed.hostname.endsWith('.superdb.com.br')) &&
      !/\/p\/[a-z0-9_-]+/i.test(cleanPath)
    ) {
      cleanPath = `${cleanPath}/p/${DEFAULT_PROJECT_ID}`;
    }

    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  } catch {
    return FALLBACK_URL;
  }
}

function resolveSuperdbRealtimeUrl(baseHttpUrl: string, explicitRealtimeEnv?: string): string {
  const base = (() => {
    try {
      return new URL(baseHttpUrl);
    } catch {
      return new URL(FALLBACK_URL);
    }
  })();

  const baseProjectPath = extractProjectIdentifier(base.pathname);
  const wsProtocol = base.protocol === 'http:' ? 'ws:' : 'wss:';
  const baseCleanPath = base.pathname.replace(/\/+$/, '');
  const derivedRealtimeUrl = `${wsProtocol}//${base.host}${
    baseCleanPath.endsWith('/realtime/v1') ? baseCleanPath : `${baseCleanPath}/realtime/v1`
  }`;

  const cleanedExplicit = cleanEnvValue(explicitRealtimeEnv).replace(/\s+/g, '');
  if (cleanedExplicit) {
    const normalized = stripDuplicateProtocol(cleanedExplicit, 'wss');
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname) {
        let cleanPath = parsed.pathname.replace(/\/+$/, '');

        if (parsed.hostname === 'auth.superdb.com.br' && !/\/p\/[a-z0-9_-]+/i.test(cleanPath)) {
          return derivedRealtimeUrl;
        }

        if (baseProjectPath && !/\/p\/[a-z0-9_-]+/i.test(cleanPath)) {
          const suffix = cleanPath
            ? cleanPath.endsWith('/realtime/v1')
              ? cleanPath
              : `${cleanPath}/realtime/v1`
            : '/realtime/v1';
          cleanPath = `/p/${baseProjectPath}${suffix}`;
        } else if (!cleanPath.endsWith('/realtime/v1')) {
          cleanPath = cleanPath ? `${cleanPath}/realtime/v1` : '/realtime/v1';
        }

        return `${parsed.protocol}//${parsed.host}${cleanPath}`;
      }
    } catch {
      // Usa URL derivada da baseHttpUrl em caso de erro de parse
    }
  }

  return derivedRealtimeUrl || FALLBACK_REALTIME_URL;
}

function sanitizeWebSocketUrl(rawAddress: string | URL, fallbackRealtimeBase: string): string {
  const rawStr = typeof rawAddress === 'string' ? rawAddress : rawAddress?.toString?.() || '';
  if (!rawStr) return fallbackRealtimeBase;

  const fixed = stripDuplicateProtocol(rawStr, 'wss');

  try {
    const parsed = new URL(fixed);
    const targetBase = new URL(fallbackRealtimeBase);

    if (
      !parsed.hostname ||
      parsed.hostname.endsWith('.supabase.co') ||
      parsed.hostname.endsWith('.supabase.in') ||
      (parsed.hostname === 'auth.superdb.com.br' && !/\/p\/[a-z0-9_-]+/i.test(parsed.pathname))
    ) {
      parsed.protocol = targetBase.protocol;
      parsed.host = targetBase.host;
    }

    const expectedProjectId = extractProjectIdentifier(targetBase.pathname);
    if (expectedProjectId && !/\/p\/[a-z0-9_-]+/i.test(parsed.pathname)) {
      const normalizedPath = parsed.pathname.startsWith('/')
        ? parsed.pathname
        : `/${parsed.pathname}`;
      parsed.pathname = `/p/${expectedProjectId}${normalizedPath}`;
    }

    return parsed.toString();
  } catch {
    return fallbackRealtimeBase;
  }
}

function createSuperdbWebSocketTransport(fallbackRealtimeBase: string): WebSocketLikeConstructor | undefined {
  const NativeWebSocket =
    typeof WebSocket !== 'undefined'
      ? WebSocket
      : typeof globalThis !== 'undefined'
      ? (globalThis as any).WebSocket
      : undefined;

  if (typeof NativeWebSocket !== 'function') return undefined;

  return class SuperdbWebSocket extends NativeWebSocket {
    constructor(address: string | URL, subprotocols?: string | string[]) {
      const sanitizedAddress = sanitizeWebSocketUrl(address, fallbackRealtimeBase);
      super(sanitizedAddress, subprotocols);
    }
  } as unknown as WebSocketLikeConstructor;
}

function sanitizeSuperdbAnonKey(rawKey: string | undefined, url: string): string {
  const cleaned = cleanEnvValue(rawKey).replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_ANON_KEY;

  if (cleaned.startsWith('sb_')) return cleaned;

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 3) return cleaned;

  const targetId = extractProjectIdentifier(url) || DEFAULT_PROJECT_ID;

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

function extractProjectSchema(rawKey: string): string {
  const parts = rawKey.split('.').filter(Boolean);
  if (parts.length === 3) {
    const payload = decodeBase64UrlJson(parts[1]);
    if (typeof payload?.project_schema === 'string' && payload.project_schema.trim()) {
      return payload.project_schema.trim();
    }
  }
  return 'public';
}

const configuredSuperdbUrl = cleanEnvValue(import.meta.env?.VITE_SUPERDB_URL);
const configuredSuperdbKey = cleanEnvValue(
  import.meta.env?.VITE_SUPERDB_ANON_KEY || import.meta.env?.VITE_SUPERDB_ANON
);
const configuredSuperdbRealtimeUrl = cleanEnvValue(import.meta.env?.VITE_SUPERDB_REALTIME_URL);

const rawUrl = configuredSuperdbUrl || cleanEnvValue(import.meta.env?.VITE_SUPABASE_URL);
const rawKey = configuredSuperdbUrl
  ? configuredSuperdbKey
  : configuredSuperdbKey || cleanEnvValue(import.meta.env?.VITE_SUPABASE_ANON_KEY);

export const superdbUrl = normalizeSuperdbHttpUrl(rawUrl);
export const superdbAnonKey = sanitizeSuperdbAnonKey(rawKey, superdbUrl);
export const superdbSchema = extractProjectSchema(superdbAnonKey);
export const superdbRealtimeUrl = resolveSuperdbRealtimeUrl(superdbUrl, configuredSuperdbRealtimeUrl);

if (!configuredSuperdbUrl || !configuredSuperdbKey) {
  console.warn(
    '[SuperDB] Verifique as variáveis de ambiente: VITE_SUPERDB_URL e VITE_SUPERDB_ANON_KEY (ou VITE_SUPERDB_ANON).'
  );
}

const superdbTransport = createSuperdbWebSocketTransport(superdbRealtimeUrl);

const realtimeOptions = {
  params: {
    apikey: superdbAnonKey,
    eventsPerSecond: 10,
  },
  heartbeatIntervalMs: 25000,
  timeout: 20000,
  worker: false,
  reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
  ...(superdbTransport ? { transport: superdbTransport } : {}),
};

export const superdb = createClient(superdbUrl, superdbAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: realtimeOptions,
});

// Mantém explicitamente o endpoint WebSocket com o caminho do projeto (/p/154a5ec3ff/realtime/v1)
try {
  const internalClient = superdb as any;
  const explicitRealtimeEndpoint = new URL(superdbRealtimeUrl);
  internalClient.realtimeUrl = explicitRealtimeEndpoint;

  if (typeof internalClient._initRealtimeClient === 'function') {
    internalClient.realtime = internalClient._initRealtimeClient({
      headers: internalClient.headers,
      accessToken: internalClient._getAccessToken?.bind(internalClient),
      fetch: internalClient.fetch,
      ...realtimeOptions,
    });
  } else {
    internalClient.realtime = new RealtimeClient(explicitRealtimeEndpoint.href, {
      headers: internalClient.headers,
      accessToken: internalClient._getAccessToken?.bind(internalClient),
      fetch: internalClient.fetch,
      ...realtimeOptions,
    });
  }
} catch (err) {
  console.warn('[SuperDB Realtime] Não foi possível aplicar endpoint WebSocket explícito:', err);
}
