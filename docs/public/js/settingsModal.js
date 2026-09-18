import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { SHARED_KEY_LIMIT, checkSerperKey } from './serperKey.js';

const SETTINGS_KEY = 'scan_interval_minutes';
// scan.py'deki get_user_setting() içindeki fallback değeriyle (360) senkron
// tutulmalı — kullanıcı hiç kaydetmediyse backend'de fiilen bu değer
// kullanılıyor, dropdown'ın da onu göstermesi gerekiyor (serperKey.js'teki
// SHARED_KEY_LIMIT ile aynı "iki dosyada bağımsız senkron sabit" deseni).
const DEFAULT_INTERVAL_MINUTES = '360';
export async function openSettingsModal() {
	document.getElementById('settingsModalOverlay').classList.add('open');
	document.getElementById('settingsSaveStatus').textContent = '';
	if (!state.currentUser) return;

	const quotaBadge = document.getElementById('sharedQuotaBadge');

	// Serper key + paylaşımlı kota bilgisi yükle
	try {
		const { data: profile } = await sb
			.from('profiles')
			.select('serper_api_key, shared_key_scans_used')
			.eq('id', state.currentUser.id)
			.single();
		if (profile?.serper_api_key) {
			document.getElementById('serperKeyInput').value = profile.serper_api_key;
		}

		const hasOwnKey = !!profile?.serper_api_key;
		const remaining = Math.max(
			0,
			SHARED_KEY_LIMIT - (profile?.shared_key_scans_used || 0),
		);
		if (quotaBadge) {
			if (!hasOwnKey && remaining > 0) {
				quotaBadge.classList.remove('hidden');
				quotaBadge.classList.toggle('low', remaining <= 3);
				quotaBadge.textContent = `🎁 Kendi key'ini girmezsen ortak deneme key'i kullanılır — ${remaining}/${SHARED_KEY_LIMIT} tarama hakkın kaldı.`;
			} else {
				quotaBadge.classList.add('hidden');
			}
		}
	} catch {
		/* profil henüz yok */
		quotaBadge?.classList.add('hidden');
	}

	// Tarama sıklığı yükle (RLS filtreli)
	// Tarama sıklığı yükle (RLS filtreli)
	const { data } = await sb
		.from('settings')
		.select('value')
		.eq('key', SETTINGS_KEY)
		.limit(1);
	document.getElementById('intervalSelect').value = data?.length
		? data[0].value
		: DEFAULT_INTERVAL_MINUTES;
}

async function saveSettings() {
	if (!state.currentUser) return;
	const status = document.getElementById('settingsSaveStatus');
	status.textContent = 'Kaydediliyor…';
	const value = document.getElementById('intervalSelect').value;
	const serperKey = document.getElementById('serperKeyInput').value.trim();

	try {
		// Tarama sıklığı — (user_id, key) çifti unique
		const { error: settingsErr } = await sb
			.from('settings')
			.upsert(
				{ user_id: state.currentUser.id, key: SETTINGS_KEY, value },
				{ onConflict: 'user_id,key' },
			);
		if (settingsErr) throw settingsErr;

		// Serper API key — profiles tablosu
		const { error: profileErr } = await sb
			.from('profiles')
			.upsert(
				{ id: state.currentUser.id, serper_api_key: serperKey },
				{ onConflict: 'id' },
			);
		if (profileErr) throw profileErr;

		status.textContent = 'Kaydedildi ✓';
		checkSerperKey();
		setTimeout(
			() =>
				document
					.getElementById('settingsModalOverlay')
					.classList.remove('open'),
			600,
		);
	} catch (err) {
		console.error(err);
		status.textContent = 'Hata oluştu, tekrar dene.';
	}
}

export function init() {
	document
		.getElementById('settingsBtn')
		.addEventListener('click', openSettingsModal);
	document
		.getElementById('closeSettingsModalBtn')
		.addEventListener('click', () => {
			document.getElementById('settingsModalOverlay').classList.remove('open');
		});
	document
		.getElementById('saveSettingsBtn')
		.addEventListener('click', saveSettings);
	document
		.getElementById('settingsModalOverlay')
		.addEventListener('click', (e) => {
			if (e.target.id === 'settingsModalOverlay')
				e.target.classList.remove('open');
		});
	document
		.getElementById('serperBannerBtn')
		.addEventListener('click', openSettingsModal);
}
