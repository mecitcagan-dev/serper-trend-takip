import { sb } from './supabaseClient.js';
import { state } from './state.js';

// Kendi key'ini girmeyen kullanıcılar için ortak/paylaşımlı deneme key'inin
// kişi başı hakkı. scan.py içindeki SHARED_KEY_LIMIT ile aynı olmalı —
// gerçek sayaç ve limit uygulaması orada (sunucu tarafında) yapılıyor,
// burası sadece görüntüleme içindir.
export const SHARED_KEY_LIMIT = 10;

export async function checkSerperKey() {
	if (!state.currentUser) return;
	const button = document.getElementById('serperKeyBtn');
	const label = document.getElementById('serperKeyBtnLabel');
	if (!button || !label) return;
	try {
		const { data } = await sb
			.from('profiles')
			.select('serper_api_key, shared_key_scans_used')
			.eq('id', state.currentUser.id)
			.single();

		const hasOwnKey = !!data?.serper_api_key;
		const remaining = Math.max(
			0,
			SHARED_KEY_LIMIT - (data?.shared_key_scans_used || 0),
		);

		if (hasOwnKey) {
			button.classList.add('has-key');
			label.textContent = 'Key hazır';
			button.title = 'Serper API key düzenle';
		} else if (remaining > 0) {
			button.classList.remove('has-key');
			label.textContent = 'API Key';
			button.title = `Ücretsiz deneme kotası: ${remaining}/${SHARED_KEY_LIMIT}. Kendi key'ini ekle`;
		} else {
			button.classList.remove('has-key');
			label.textContent = 'Key Ekle';
			button.title = 'Ücretsiz deneme kotası bitti; kendi Serper API key\'ini ekle';
		}
	} catch {
		// Profil henüz oluşturulmamış olabilir; buton yine de kullanılabilir.
		button.classList.remove('has-key');
		label.textContent = 'API Key';
	}
}
