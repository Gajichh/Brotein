// Supabase connection for Brotein.
// Fill these in from Supabase dashboard -> Project Settings -> API.
// The anon (public) key is meant to be used in the browser; never put the service_role key here.
const SUPABASE_URL = 'https://hpemrvjavsvvfxrnifgn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_afMjg5owhWJv8FWe5HAp0A_TyQURvfr';

window.broteinSupabase = null;
try {
    if (window.supabase) {
        window.broteinSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (error) {
    console.error('Supabase is not configured:', error.message);
}
