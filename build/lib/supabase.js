import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
if (!supabaseUrl || !isValidUrl(supabaseUrl)) {
    console.error('VITE_SUPABASE_URL is invalid or missing. Ensure it is defined and valid in your environment variables.');
    throw new Error('Invalid or missing VITE_SUPABASE_URL environment variable');
}
if (!supabaseKey) {
    console.error('VITE_SUPABASE_KEY is missing. Ensure it is defined in your environment variables.');
    throw new Error('Missing VITE_SUPABASE_KEY environment variable');
}
// Helper function to validate URLs
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: localStorage,
        storageKey: 'supabase.auth.token',
        debug: import.meta.env.DEV // Only enable debug in development
    }
});
