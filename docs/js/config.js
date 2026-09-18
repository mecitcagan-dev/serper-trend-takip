// Supabase Dashboard > Settings > API üzerinden alınan bilgileri buraya yapıştır.
// SADECE "anon / public" key kullan — service_role key'i BURAYA YAPIŞTIRMA,
// o key sadece GitHub Actions secrets içinde kalmalı.

const SUPABASE_URL = 'https://dcgmqohyngudhocjjanf.supabase.co';
const SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ21xb2h5bmd1ZGhvY2pqYW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzQwNDgsImV4cCI6MjEwNTIxMDA0OH0.Wvca4U25Gq13NWoFbycdmsQx5033ML2p2hbd3-9-0_0';
