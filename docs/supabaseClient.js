// config.js, index.html'de bu dosyadan ÖNCE klasik <script> olarak yüklenir;
// SUPABASE_URL / SUPABASE_ANON_KEY orada tanımlanan global (script-scope)
// sabitlerdir. Klasik script'lerdeki top-level const/let, aynı realm'daki
// module script'lerden de görülebildiği için burada doğrudan kullanılabilir.

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
