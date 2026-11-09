import {
  saveOrders,
  saveStaff,
  saveUsers,
  saveExpenses,
  saveDeliveries,
  saveCustomers,
  saveCompanySettings,
  getOrders,
  getStaff,
  getUsers,
  getExpenses,
  getDeliveries,
  getCustomers,
  getCompanySettings,
  syncAllStaffToUsers
} from './storage';

export type SyncTable = 'orders' | 'staff' | 'users' | 'expenses' | 'deliveries' | 'customers' | 'company';
export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'REPLACE_ALL';

type SyncListener = (payload: { table: SyncTable; action: SyncAction; data?: any; id?: string }) => void;

const listeners: Set<SyncListener> = new Set();

let eventSource: EventSource | null = null;
let isConnected = false;
let reconnectTimer: any = null;

export function addSyncListener(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(payload: { table: SyncTable; action: SyncAction; data?: any; id?: string }) {
  listeners.forEach(fn => {
    try {
      fn(payload);
    } catch (e) {
      console.error('Error in sync listener:', e);
    }
  });
}

/**
 * Fetch latest centralized state from server and persist locally
 */
export async function fetchServerState(): Promise<any> {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data) {
      if (Array.isArray(data.orders)) saveOrders(data.orders);
      if (Array.isArray(data.staff)) {
        saveStaff(data.staff);
        syncAllStaffToUsers();
      }
      if (Array.isArray(data.users)) saveUsers(data.users);
      if (Array.isArray(data.expenses)) saveExpenses(data.expenses);
      if (Array.isArray(data.deliveries)) saveDeliveries(data.deliveries);
      if (Array.isArray(data.customers)) saveCustomers(data.customers);
      if (data.company) saveCompanySettings(data.company);
    }
    return data;
  } catch (err) {
    console.warn('[SYNC] Could not fetch server state, relying on local cache:', err);
    return null;
  }
}

/**
 * Send an atomic mutation to the server (INSERT, UPDATE, DELETE)
 */
export async function pushSyncToServer(
  table: SyncTable,
  action: SyncAction,
  data?: any,
  id?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, action, data, id }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[SYNC] Failed to push mutation to server:', err);
    return false;
  }
}

/**
 * Send entire local state to server (used on first setup or full overwrite)
 */
export async function pushFullStateToServer(): Promise<boolean> {
  try {
    const fullState = {
      orders: getOrders(),
      staff: getStaff(),
      users: getUsers(),
      expenses: getExpenses(),
      deliveries: getDeliveries(),
      customers: getCustomers(),
      company: getCompanySettings(),
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullState }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[SYNC] Failed to push full state to server:', err);
    return false;
  }
}

/**
 * Connect to Real-time Server-Sent Events (SSE) stream
 */
export function initRealtimeSync(): void {
  if (typeof window === 'undefined') return;

  if (eventSource) {
    eventSource.close();
  }

  try {
    eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => {
      isConnected = true;
      console.log('[SYNC] Real-time stream connected!');
      // Re-fetch latest state to ensure no updates were missed while offline
      fetchServerState().then((state) => {
        if (state) {
          notifyListeners({ table: 'orders', action: 'REPLACE_ALL' });
        }
      });
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('[SYNC] Real-time event received:', payload);

        if (payload.event === 'full_sync') {
          fetchServerState().then(() => {
            notifyListeners({ table: 'orders', action: 'REPLACE_ALL' });
          });
          return;
        }

        if (payload.event === 'mutation' && payload.table) {
          const { table, action, data, id } = payload;

          // Apply to local storage
          if (table === 'orders') {
            const list = getOrders();
            if (action === 'INSERT') {
              const idx = list.findIndex(o => o.id === data.id);
              if (idx >= 0) list[idx] = data;
              else list.unshift(data);
              saveOrders(list);
            } else if (action === 'UPDATE') {
              const idx = list.findIndex(o => o.id === (data?.id || id));
              if (idx >= 0) list[idx] = { ...list[idx], ...data };
              else if (data) list.unshift(data);
              saveOrders(list);
            } else if (action === 'DELETE') {
              const filtered = list.filter(o => o.id !== (id || data?.id));
              saveOrders(filtered);
            }
          } else if (table === 'staff') {
            const list = getStaff();
            if (action === 'INSERT') {
              const idx = list.findIndex(s => s.id === data.id);
              if (idx >= 0) list[idx] = data;
              else list.push(data);
              saveStaff(list);
              syncAllStaffToUsers();
            } else if (action === 'UPDATE') {
              const idx = list.findIndex(s => s.id === (data?.id || id));
              if (idx >= 0) list[idx] = { ...list[idx], ...data };
              saveStaff(list);
              syncAllStaffToUsers();
            } else if (action === 'DELETE') {
              const filtered = list.filter(s => s.id !== (id || data?.id));
              saveStaff(filtered);
            }
          } else if (table === 'expenses') {
            const list = getExpenses();
            if (action === 'INSERT') {
              const idx = list.findIndex(e => e.id === data.id);
              if (idx >= 0) list[idx] = data;
              else list.unshift(data);
              saveExpenses(list);
            } else if (action === 'UPDATE') {
              const idx = list.findIndex(e => e.id === (data?.id || id));
              if (idx >= 0) list[idx] = { ...list[idx], ...data };
              saveExpenses(list);
            } else if (action === 'DELETE') {
              const filtered = list.filter(e => e.id !== (id || data?.id));
              saveExpenses(filtered);
            }
          } else if (table === 'deliveries') {
            const list = getDeliveries();
            if (action === 'INSERT') {
              const idx = list.findIndex(d => d.id === data.id);
              if (idx >= 0) list[idx] = data;
              else list.unshift(data);
              saveDeliveries(list);
            } else if (action === 'UPDATE') {
              const idx = list.findIndex(d => d.id === (data?.id || id));
              if (idx >= 0) list[idx] = { ...list[idx], ...data };
              saveDeliveries(list);
            } else if (action === 'DELETE') {
              const filtered = list.filter(d => d.id !== (id || data?.id));
              saveDeliveries(filtered);
            }
          } else if (table === 'company' && data) {
            saveCompanySettings(data);
          }

          // Notify all mounted React components to update state immediately
          notifyListeners({ table, action, data, id });
        }
      } catch (err) {
        console.error('[SYNC] Error parsing SSE payload:', err);
      }
    };

    eventSource.onerror = () => {
      isConnected = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        initRealtimeSync();
      }, 3000);
    };
  } catch (err) {
    console.warn('[SYNC] Error creating EventSource:', err);
  }
}

// Background poller & visibility change listener
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchServerState().then((state) => {
        if (state) notifyListeners({ table: 'orders', action: 'REPLACE_ALL' });
      });
      if (!isConnected) {
        initRealtimeSync();
      }
    }
  });

  // Secondary poll every 6 seconds as backup
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchServerState().then((state) => {
        if (state) notifyListeners({ table: 'orders', action: 'REPLACE_ALL' });
      });
    }
  }, 6000);
}
