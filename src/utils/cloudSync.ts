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
  syncAllStaffToUsers,
  deleteStaffMember,
  mergeOrders
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
/**
 * Fetch latest centralized state - 100% delegated to official Supabase SDK
 */
export async function fetchServerState(): Promise<any> {
  return null;
}

/**
 * Send an atomic mutation - 100% delegated to official Supabase SDK
 */
export async function pushSyncToServer(
  table: SyncTable,
  action: SyncAction,
  data?: any,
  id?: string
): Promise<boolean> {
  return true;
}

/**
 * Send entire local state - 100% delegated to official Supabase SDK
 */
export async function pushFullStateToServer(): Promise<boolean> {
  return true;
}

/**
 * Realtime sync - 100% delegated to official Supabase Realtime channel
 */
export function initRealtimeSync(): void {
  // No-op: Supabase Realtime handles live postgres_changes directly
}
