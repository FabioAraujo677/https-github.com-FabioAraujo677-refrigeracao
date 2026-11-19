import { createClient, RealtimeClient, type WebSocketLikeConstructor } from '@supabase/supabase-js';

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

function normalizeSuperdbHttpUrl(raw?: string): string {
  let cleaned = cleanEnvValue(raw).replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_URL;

  // Corrige protocolos malformados/duplicados (ex.: https://https://, wss://://, ://)
  cleaned = cleaned
    .replace(/^(wss?:\/\/)+(:\/\/)*/i, 'https://')
    .replace(/^(https?:\/\/)+(:\/\/)*/i, (match) =>
      match.toLowerCase().startsWith('http://') ? 'http://' : 'https://'
    )
    .replace(/^[:/]+/, '');

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    if (!parsed.hostname) return FALLBACK_URL;
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${cleanPath}`;
  } catch {
    return FALLBACK_URL;
  }
}

function resolveSuperdbRealtimeUrl(baseHttpUrl: string, explicitRealtimeEnv?: string): string {
  const cleanedExplicit = cleanEnvValue(explicitRealtimeEnv).replace(/\s+/g, '');

  if (cleanedExplicit) {
    let normalized = cleanedExplicit
      .replace(/^(wss?:\/\/)+(:\/\/)*/i, (match) =>
        match.toLowerCase().startsWith('ws://') ? 'ws://' : 'wss://'
      )
      .replace(/^(https?:\/\/)+(:\/\/)*/i, (match) =>
        match.toLowerCase().startsWith('http://') ? 'ws://' : 'wss://'
      )
      .replace(/^[:/]+/, '');

    if (!/^wss?:\/\//i.test(normalized)) {
      normalized = `wss://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);
      if (parsed.hostname) {
        const cleanPath = parsed.pathname.replace(/\/+$/, '');
        const finalPath = cleanPath ? cleanPath : '/realtime/v1';
        return `${parsed.protocol}//${parsed.host}${finalPath}`;
      }
    } catch {}
  }

  try {
    const base = new URL(baseHttpUrl);
    const wsProtocol = base.protocol === 'http:' ? 'ws:' : 'wss:';
    const cleanPath = base.pathname.replace(/\/+$/, '');
    const realtimePath = cleanPath.endsWith('/realtime/v1')
      ? cleanPath
      : `${cleanPath}/realtime/v1`;
    return `${wsProtocol}//${base.host}${realtimePath}`;
  } catch {
    return 'wss://auth.superdb.com.br/realtime/v1';
  }
}

function sanitizeWebSocketUrl(rawAddress: string | URL, fallbackRealtimeBase: string): string {
  const rawStr = typeof rawAddress === 'string' ? rawAddress : rawAddress?.toString?.() || '';
  if (!rawStr) return fallbackRealtimeBase;

  let fixed = rawStr
    .trim()
    .replace(/^(wss?):\/\/(:\/\/)+/i, '$1://')
    .replace(/^(wss?:\/\/)+/i, (match) =>
      match.toLowerCase().startsWith('ws://') ? 'ws://' : 'wss://'
    )
    .replace(/^wss?:\/\/\s*\/+/i, (match) =>
      match.toLowerCase().startsWith('ws://') ? 'ws://' : 'wss://'
    );

  try {
    const parsed = new URL(fixed);
    if (
      !parsed.hostname ||
      parsed.hostname.endsWith('.supabase.co') ||
      parsed.hostname.endsWith('.supabase.in')
    ) {
      const targetBase = new URL(fallbackRealtimeBase);
      parsed.protocol = targetBase.protocol;
      parsed.host = targetBase.host;
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

// Mapeia explicitamente a URL de Realtime do SuperDB para evitar URL quebrada (ex: wss://://) ou fallback do Supabase tradicional
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
