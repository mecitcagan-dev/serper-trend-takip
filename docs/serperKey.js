import { sb } from './supabaseClient.js';
import { state } from './state.js';

// Kendi key'ini girmeyen kullanıcılar için ortak/paylaşımlı deneme key'inin
// kişi başı hakkı. scan.py içindeki SHARED_KEY_LIMIT ile aynı olmalı —
// gerçek sayaç ve limit uygulaması orada (sunucu tarafında) yapılıyor,
// burası sadece görüntüleme içindir.
export const SHARED_KEY_LIMIT = 10;

export async function checkSerperKey() {
	if (!state.currentUser) return;
	const banner = document.getElementById('serperKeyBanner');
	const bannerText = document.getElementById('serperBannerText');
	const bannerBtn = document.getElementById('serperBannerBtn');
	if (!banner) return;
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
			banner.classList.add('hidden');
		} else if (remaining > 0) {
			banner.classList.remove('hidden');
			banner.classList.add('info');
			bannerText.textContent = `🎁 Ücretsiz deneme modundasın — ${remaining}/${SHARED_KEY_LIMIT} tarama hakkın kaldı.`;
			bannerBtn.textContent = "Kendi Key'imi Ekle";
		} else {
			banner.classList.remove('hidden');
			banner.classList.remove('info');
			bannerText.textContent =
				"⚠️ Ücretsiz tarama hakkın bitti — devam etmek için kendi Serper API key'ini eklemen gerekiyor.";
			bannerBtn.textContent = 'Key Ekle';
		}
	} catch {
		// profil henüz oluşturulmamış olabilir, sorun değil
		banner.classList.remove('hidden');
		banner.classList.remove('info');
	}
}
