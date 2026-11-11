import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as any);
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://pupcjjvrnsarqjzwrvvc.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cGNqanZybnNhcnFqendydnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNDk0NDAsImV4cCI6MjEwOTgyNTQ0MH0.rqIuHGqMef0JxByGDCsypl22ieHfa_8Tp4gLXv4hxno';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);



