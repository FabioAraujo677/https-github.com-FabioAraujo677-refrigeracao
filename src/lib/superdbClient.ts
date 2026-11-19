import { createClient, RealtimeClient, type WebSocketLikeConstructor } from '@supabase/supabase-js';

const DEFAULT_PROJECT_ID = '154a5ec3ff';
const SUPERDB_DEFAULT_AUTH_URL = 'https://auth.superdb.com.br';
const SUPERDB_DEFAULT_API_URL = 'https://api.superdb.com.br';
const SUPERDB_DEFAULT_STORAGE_URL = 'https://storage.superdb.com.br';
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

function extractJwtPayload(token?: string | null): Record<string, any> | null {
  if (!token) return null;
  const parts = token.split('.').filter(Boolean);
  if (parts.length !== 3) return null;
  return decodeBase64UrlJson(parts[1]);
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

function isSuperdbManagedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'superdb.com.br' || host.endsWith('.superdb.com.br');
}

function resolveSuperdbEndpoints(rawUrl?: string, hasSuperdbKey = false): {
  apiUrl: string;
  authUrl: string;
  isManagedSuperdb: boolean;
  projectHint: string;
} {
  let cleaned = cleanEnvValue(rawUrl).replace(/\s+/g, '');
  if (!cleaned) {
    return {
      apiUrl: SUPERDB_DEFAULT_API_URL,
      authUrl: SUPERDB_DEFAULT_AUTH_URL,
      isManagedSuperdb: true,
      projectHint: DEFAULT_PROJECT_ID,
    };
  }

  cleaned = stripDuplicateProtocol(cleaned, 'https');
  if (/^wss?:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
  }

  try {
    const parsed = new URL(cleaned);
    const hostname = parsed.hostname.toLowerCase();
    const projectHint = extractProjectIdentifier(parsed.pathname) || DEFAULT_PROJECT_ID;

    if (!hostname) {
      return {
        apiUrl: SUPERDB_DEFAULT_API_URL,
        authUrl: SUPERDB_DEFAULT_AUTH_URL,
        isManagedSuperdb: true,
        projectHint,
      };
    }

    // Se a URL for superdb.com.br/p/<id>, auth.superdb.com.br, api.superdb.com.br ou legado supabase.co com chave SuperDB
    if (
      isSuperdbManagedHost(hostname) ||
      (hasSuperdbKey && (hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.in')))
    ) {
      return {
        apiUrl: SUPERDB_DEFAULT_API_URL,
        authUrl: SUPERDB_DEFAULT_AUTH_URL,
        isManagedSuperdb: true,
        projectHint,
      };
    }

    // Instância customizada / self-hosted
    const cleanPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\/(rest|auth|storage|functions|realtime)\/v1$/i, '');
    const customBase = `${parsed.protocol}//${parsed.host}${cleanPath}`;
    return {
      apiUrl: customBase,
      authUrl: customBase,
      isManagedSuperdb: false,
      projectHint,
    };
  } catch {
    return {
      apiUrl: SUPERDB_DEFAULT_API_URL,
      authUrl: SUPERDB_DEFAULT_AUTH_URL,
      isManagedSuperdb: true,
      projectHint: DEFAULT_PROJECT_ID,
    };
  }
}

function sanitizeSuperdbAnonKey(rawKey: string | undefined, projectHint: string): string {
  const cleaned = cleanEnvValue(rawKey).replace(/\s+/g, '');
  if (!cleaned) return FALLBACK_ANON_KEY;

  if (cleaned.startsWith('sb_')) return cleaned;

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 3) return cleaned;

  if (parts.length > 3) {
    let firstValidJwt: string | null = null;
    for (let i = 0; i <= parts.length - 3; i++) {
      const header = decodeBase64UrlJson(parts[i]);
      const payload = decodeBase64UrlJson(parts[i + 1]);
      if (header?.alg && payload) {
        const candidate = `${parts[i]}.${parts[i + 1]}.${parts[i + 2]}`;
        if (!firstValidJwt) firstValidJwt = candidate;
        const matchesProject =
          !projectHint ||
          payload.ref === projectHint ||
          (typeof payload.project_schema === 'string' && payload.project_schema.includes(projectHint));
        if (matchesProject) {
          return candidate;
        }
      }
    }
    if (firstValidJwt) return firstValidJwt;
  }

  return cleaned;
}

function resolveSchemaInfo(rawKey: string, projectSlug?: string): {
  schema: string;
  hasExplicitSchema: boolean;
} {
  const payload = extractJwtPayload(rawKey);
  if (typeof payload?.project_schema === 'string' && payload.project_schema.trim()) {
    return { schema: payload.project_schema.trim(), hasExplicitSchema: true };
  }
  if (typeof payload?.schema === 'string' && payload.schema.trim()) {
    return { schema: payload.schema.trim(), hasExplicitSchema: true };
  }
  if (projectSlug) {
    return { schema: projectSlug.startsWith('proj_') ? projectSlug : `proj_${projectSlug}`, hasExplicitSchema: true };
  }
  return { schema: 'public', hasExplicitSchema: false };
}

function sanitizeWebSocketUrl(rawAddress: string | URL, fallbackRealtimeBase?: string): string {
  const rawStr = typeof rawAddress === 'string' ? rawAddress : rawAddress?.toString?.() || '';
  if (!rawStr) return fallbackRealtimeBase || '';

  const fixed = stripDuplicateProtocol(rawStr, 'wss');
  try {
    const parsed = new URL(fixed);
    return parsed.toString();
  } catch {
    return fallbackRealtimeBase || fixed;
  }
}

function createSuperdbWebSocketTransport(fallbackRealtimeBase?: string): WebSocketLikeConstructor | undefined {
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

// Leitura estática de import.meta.env (sem optional chaining para garantir substituição no vite build)
const envSuperdbUrl = cleanEnvValue(import.meta.env.VITE_SUPERDB_URL);
const envSuperdbAnonKey = cleanEnvValue(import.meta.env.VITE_SUPERDB_ANON_KEY);
const envSuperdbAnon = cleanEnvValue(import.meta.env.VITE_SUPERDB_ANON);
const envSuperdbRealtimeUrl = cleanEnvValue(import.meta.env.VITE_SUPERDB_REALTIME_URL);
const envSuperdbProject = cleanEnvValue(import.meta.env.VITE_SUPERDB_PROJECT);
const envSupabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const envSupabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

const configuredSuperdbKey = envSuperdbAnonKey || envSuperdbAnon;
const hasSuperdbConfig = Boolean(envSuperdbUrl || configuredSuperdbKey);

const rawUrl = envSuperdbUrl || (hasSuperdbConfig ? '' : envSupabaseUrl);
const rawKey = configuredSuperdbKey || (hasSuperdbConfig ? '' : envSupabaseAnonKey);

const endpoints = resolveSuperdbEndpoints(rawUrl, Boolean(configuredSuperdbKey));

export const superdbUrl = endpoints.apiUrl;
export const superdbAuthUrl = endpoints.authUrl;
export const superdbAnonKey = sanitizeSuperdbAnonKey(rawKey, endpoints.projectHint);

const schemaInfo = resolveSchemaInfo(superdbAnonKey, envSuperdbProject || undefined);
export const superdbSchema = schemaInfo.schema;

function resolveExplicitRealtimeOverride(rawRtUrl?: string): string {
  const cleaned = cleanEnvValue(rawRtUrl).replace(/\s+/g, '');
  if (!cleaned) return '';
  const fixed = stripDuplicateProtocol(cleaned, 'wss');
  try {
    const parsed = new URL(fixed);
    // Ignora overrides legados que apontam para rotas inexistentes (/p/.../realtime/v1 ou auth.superdb.com.br/realtime/v1)
    if (
      parsed.hostname === 'superdb.com.br' ||
      parsed.hostname === 'auth.superdb.com.br' ||
      parsed.hostname.endsWith('.supabase.co')
    ) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

const explicitRealtimeOverride = resolveExplicitRealtimeOverride(envSuperdbRealtimeUrl);
export const superdbRealtimeUrl = explicitRealtimeOverride || `${superdbAuthUrl}/rt/v1/token`;

if (!configuredSuperdbKey) {
  console.warn(
    '[SuperDB] Verifique a chave de API: configure VITE_SUPERDB_ANON_KEY (ou VITE_SUPERDB_ANON) no ambiente.'
  );
}

// Cache de token de Storage do SuperDB (/st/v1/token)
let mintedStorageCache: { token: string; storageUrl: string; expiresAt: number } | null = null;

async function getSuperdbStorageCredentials(baseFetch: typeof fetch): Promise<{ token: string; storageUrl: string } | null> {
  if (mintedStorageCache && mintedStorageCache.expiresAt > Date.now() + 60_000) {
    return { token: mintedStorageCache.token, storageUrl: mintedStorageCache.storageUrl };
  }

  if (superdbAnonKey === FALLBACK_ANON_KEY) return null;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${superdbAnonKey}`,
      apikey: superdbAnonKey,
    };
    if (envSuperdbProject) {
      headers['X-SuperDB-Project'] = envSuperdbProject;
    }

    const resp = await baseFetch(`${superdbAuthUrl}/st/v1/token`, {
      method: 'POST',
      headers,
    });
    if (!resp.ok) return null;

    const payload = await resp.json();
    if (!payload?.token) return null;

    const expiresInSec = Number(payload.expires_in) || 3600;
    const storageUrl = String(payload.url || SUPERDB_DEFAULT_STORAGE_URL).replace(/\/+$/, '');
    mintedStorageCache = {
      token: String(payload.token),
      storageUrl,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    return { token: mintedStorageCache.token, storageUrl: mintedStorageCache.storageUrl };
  } catch {
    return null;
  }
}

// Fetch customizado que adapta o cliente PostgREST/Storage do @supabase/supabase-js para os endpoints reais do SuperDB:
// - Dados REST: https://api.superdb.com.br/{tabela} (sem /rest/v1/ e sem /p/<id>/)
// - Auth: https://auth.superdb.com.br/auth/v1/*
// - Storage: https://storage.superdb.com.br/object/* via /st/v1/token
const nativeFetch: typeof fetch = (...args) => globalThis.fetch(...args);

const superdbFetch: typeof fetch = async (input, init) => {
  const rawRequestUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );

  if (superdbAnonKey !== FALLBACK_ANON_KEY) {
    if (!headers.has('apikey')) headers.set('apikey', superdbAnonKey);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${superdbAnonKey}`);
  }

  let targetUrl = rawRequestUrl;

  if (endpoints.isManagedSuperdb) {
    try {
      const parsed = new URL(rawRequestUrl);
      const path = parsed.pathname;

      if (/^\/(?:p\/[a-z0-9_-]+\/)?rest\/v1(?:\/|$)/i.test(path)) {
        // SuperDB Data API usa caminho raiz: https://api.superdb.com.br/{tabela}
        const strippedPath = path.replace(/^\/(?:p\/[a-z0-9_-]+\/)?rest\/v1/i, '') || '/';
        const apiBase = new URL(superdbUrl);
        parsed.protocol = apiBase.protocol;
        parsed.host = apiBase.host;
        parsed.pathname = strippedPath;
        targetUrl = parsed.toString();

        // Se o schema efetivo for 'public' (sem project_schema explícito), remove Accept-Profile/Content-Profile
        // para que o SuperDB deduza o tenant diretamente da credencial (apikey / Bearer JWT)
        if (schemaInfo.hasExplicitSchema) {
          const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
          if (method === 'GET' || method === 'HEAD') {
            headers.set('Accept-Profile', superdbSchema);
          } else {
            headers.set('Content-Profile', superdbSchema);
          }
        } else {
          headers.delete('Accept-Profile');
          headers.delete('Content-Profile');
        }
      } else if (/^\/(?:p\/[a-z0-9_-]+\/)?auth\/v1(?:\/|$)/i.test(path)) {
        const strippedPath = path.replace(/^\/p\/[a-z0-9_-]+/i, '');
        const authBase = new URL(superdbAuthUrl);
        parsed.protocol = authBase.protocol;
        parsed.host = authBase.host;
        parsed.pathname = strippedPath;
        if (envSuperdbProject && !headers.has('X-SuperDB-Project')) {
          headers.set('X-SuperDB-Project', envSuperdbProject);
        }
        targetUrl = parsed.toString();
      } else if (/^\/(?:p\/[a-z0-9_-]+\/)?storage\/v1(?:\/|$)/i.test(path)) {
        const storageCreds = await getSuperdbStorageCredentials(nativeFetch);
        const strippedPath = path.replace(/^\/(?:p\/[a-z0-9_-]+\/)?storage\/v1/i, '') || '/';
        const storageBase = new URL(storageCreds?.storageUrl || SUPERDB_DEFAULT_STORAGE_URL);
        parsed.protocol = storageBase.protocol;
        parsed.host = storageBase.host;
        parsed.pathname = strippedPath;
        if (storageCreds?.token) {
          headers.set('Authorization', `Bearer ${storageCreds.token}`);
        }
        targetUrl = parsed.toString();
      }
    } catch {
      // Mantém rawRequestUrl caso não seja URL absoluta válida
    }
  }

  if (input instanceof Request) {
    const method = init?.method || input.method || 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = init?.body !== undefined ? init.body : hasBody ? await input.clone().arrayBuffer() : undefined;
    return nativeFetch(targetUrl, {
      ...init,
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
  }
  return nativeFetch(targetUrl, {
    ...init,
    headers,
  });
};

export const superdb = createClient(superdbUrl, superdbAnonKey, {
  ...(schemaInfo.hasExplicitSchema ? { db: { schema: superdbSchema } } : {}),
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: superdbFetch,
  },
});

// ==================== REALTIME BRIDGE (SuperDB /rt/v1/token + RealtimeClient) ====================
interface RealtimeListenerSpec {
  type: string;
  filter: any;
  callback: (payload: any) => void;
}

interface RealtimeSessionState {
  client: RealtimeClient;
  schema: string;
  expiresAt: number;
  refreshTimer: ReturnType<typeof setTimeout> | null;
}

let activeRealtimeSession: RealtimeSessionState | null = null;
let pendingRealtimeInit: Promise<RealtimeSessionState | null> | null = null;
let realtimeFailureWarned = false;

async function mintRealtimeToken(): Promise<{ token: string; url: string; expiresIn: number; schema: string } | null> {
  if (superdbAnonKey === FALLBACK_ANON_KEY) return null;

  if (explicitRealtimeOverride) {
    return {
      token: superdbAnonKey,
      url: explicitRealtimeOverride,
      expiresIn: 3600,
      schema: superdbSchema,
    };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${superdbAnonKey}`,
      apikey: superdbAnonKey,
    };
    if (envSuperdbProject) {
      headers['X-SuperDB-Project'] = envSuperdbProject;
    }

    const resp = await nativeFetch(`${superdbAuthUrl}/rt/v1/token`, {
      method: 'POST',
      headers,
    });

    if (!resp.ok) {
      if (!realtimeFailureWarned) {
        realtimeFailureWarned = true;
        console.warn(`[SuperDB Realtime] Endpoint /rt/v1/token retornou HTTP ${resp.status}. A sincronização por polling permanece ativa.`);
      }
      return null;
    }

    const data = await resp.json();
    const token = String(data?.token || '');
    const rawWsUrl = String(data?.url || '');
    if (!token || !rawWsUrl) return null;

    const tokenPayload = extractJwtPayload(token);
    const detectedSchema =
      (typeof tokenPayload?.project_schema === 'string' && tokenPayload.project_schema.trim()) ||
      (typeof tokenPayload?.schema === 'string' && tokenPayload.schema.trim()) ||
      superdbSchema;

    return {
      token,
      url: sanitizeWebSocketUrl(rawWsUrl),
      expiresIn: Number(data?.expires_in) || 3600,
      schema: detectedSchema,
    };
  } catch (err) {
    if (!realtimeFailureWarned) {
      realtimeFailureWarned = true;
      console.warn('[SuperDB Realtime] Falha ao obter token em /rt/v1/token (polling ativo):', err);
    }
    return null;
  }
}

async function getSharedRealtimeSession(): Promise<RealtimeSessionState | null> {
  if (activeRealtimeSession && activeRealtimeSession.expiresAt > Date.now() + 60_000) {
    return activeRealtimeSession;
  }
  if (pendingRealtimeInit) return pendingRealtimeInit;

  pendingRealtimeInit = (async () => {
    const minted = await mintRealtimeToken();
    if (!minted) return null;

    const transport = createSuperdbWebSocketTransport(minted.url);

    if (activeRealtimeSession) {
      activeRealtimeSession.client.setAuth(minted.token);
      activeRealtimeSession.schema = minted.schema;
      activeRealtimeSession.expiresAt = Date.now() + minted.expiresIn * 1000;
      return activeRealtimeSession;
    }

    const rt = new RealtimeClient(minted.url, {
      params: {
        apikey: minted.token,
        eventsPerSecond: 10,
      },
      heartbeatIntervalMs: 25000,
      timeout: 20000,
      worker: false,
      reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
      ...(transport ? { transport } : {}),
    });

    const state: RealtimeSessionState = {
      client: rt,
      schema: minted.schema,
      expiresAt: Date.now() + minted.expiresIn * 1000,
      refreshTimer: null,
    };

    const scheduleRefresh = (expiresInSec: number) => {
      if (state.refreshTimer) clearTimeout(state.refreshTimer);
      const delayMs = Math.max((expiresInSec - 300) * 1000, 60_000);
      state.refreshTimer = setTimeout(async () => {
        const refreshed = await mintRealtimeToken();
        if (refreshed) {
          state.client.setAuth(refreshed.token);
          state.schema = refreshed.schema;
          state.expiresAt = Date.now() + refreshed.expiresIn * 1000;
          scheduleRefresh(refreshed.expiresIn);
        }
      }, delayMs);
    };

    scheduleRefresh(minted.expiresIn);
    activeRealtimeSession = state;
    return state;
  })().finally(() => {
    pendingRealtimeInit = null;
  });

  return pendingRealtimeInit;
}

class SuperdbChannelProxy {
  private readonly name: string;
  private readonly opts: any;
  private readonly listeners: RealtimeListenerSpec[] = [];
  private realChannel: any = null;
  private unsubscribed = false;

  constructor(name: string, opts?: any) {
    this.name = name;
    this.opts = opts;
  }

  on(type: string, filter: any, callback: (payload: any) => void) {
    this.listeners.push({ type, filter, callback });
    if (this.realChannel) {
      this.realChannel.on(type, this.adaptFilter(type, filter), callback);
    }
    return this;
  }

  private adaptFilter(type: string, filter: any, resolvedSchema?: string) {
    if (type !== 'postgres_changes' || !filter || typeof filter !== 'object') return filter;
    const targetSchema = resolvedSchema || superdbSchema;
    const requestedSchema = filter.schema;
    if (!requestedSchema || requestedSchema === 'public') {
      return { ...filter, schema: targetSchema };
    }
    return filter;
  }

  subscribe(callback?: (status: string, err?: any) => void) {
    this.unsubscribed = false;
    void (async () => {
      const session = await getSharedRealtimeSession();
      if (!session || this.unsubscribed) return;

      const resolvedSchema = session.schema || superdbSchema;
      const usePrivate = resolvedSchema !== 'public' && !this.name.startsWith(`${resolvedSchema}:`);
      const channelName = usePrivate ? `${resolvedSchema}:${this.name}` : this.name;
      const channelOpts =
        resolvedSchema !== 'public'
          ? {
              ...this.opts,
              config: {
                private: true,
                ...(this.opts?.config || {}),
              },
            }
          : this.opts;

      const ch = session.client.channel(channelName, channelOpts);
      for (const listener of this.listeners) {
        ch.on(
          listener.type as any,
          this.adaptFilter(listener.type, listener.filter, resolvedSchema),
          listener.callback
        );
      }
      this.realChannel = ch;
      ch.subscribe(callback as any);
    })();

    return this;
  }

  async unsubscribe() {
    this.unsubscribed = true;
    const ch = this.realChannel;
    this.realChannel = null;
    if (ch && typeof ch.unsubscribe === 'function') {
      try {
        return await ch.unsubscribe();
      } catch {
        return 'ok';
      }
    }
    return 'ok';
  }
}

const activeProxyChannels = new Set<SuperdbChannelProxy>();
const superdbMutable = superdb as any;

superdbMutable.channel = (name: string, opts?: any) => {
  const proxy = new SuperdbChannelProxy(name, opts);
  activeProxyChannels.add(proxy);
  return proxy;
};

superdbMutable.removeChannel = async (channel: any) => {
  if (channel instanceof SuperdbChannelProxy) {
    activeProxyChannels.delete(channel);
    return channel.unsubscribe();
  }
  if (activeRealtimeSession?.client && channel) {
    return activeRealtimeSession.client.removeChannel(channel);
  }
  return 'ok';
};

superdbMutable.removeAllChannels = async () => {
  const channels = Array.from(activeProxyChannels);
  activeProxyChannels.clear();
  return Promise.all(channels.map((ch) => ch.unsubscribe()));
};
