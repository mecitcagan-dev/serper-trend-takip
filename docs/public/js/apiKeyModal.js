import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { SHARED_KEY_LIMIT, checkSerperKey } from './serperKey.js';
import { loadProjectDashboard } from './dashboard.js';

function closeApiKeyModal() {
	document.getElementById('apiKeyModalOverlay')?.classList.remove('open');
}

export async function openApiKeyModal() {
	const overlay = document.getElementById('apiKeyModalOverlay');
	const input = document.getElementById('serperKeyInput');
	const status = document.getElementById('apiKeySaveStatus');
	const quotaBadge = document.getElementById('sharedQuotaBadge');
	if (!overlay || !input) return;

	overlay.classList.add('open');
	input.value = '';
	if (status) status.textContent = '';
	quotaBadge?.classList.add('hidden');
	if (!state.currentUser) return;

	try {
		const { data: profile } = await sb
			.from('profiles')
			.select('serper_api_key, shared_key_scans_used')
			.eq('id', state.currentUser.id)
			.single();
		input.value = profile?.serper_api_key || '';

		const remaining = Math.max(
			0,
			SHARED_KEY_LIMIT - (profile?.shared_key_scans_used || 0),
		);
		if (quotaBadge && !profile?.serper_api_key && remaining > 0) {
			quotaBadge.classList.remove('hidden');
			quotaBadge.classList.toggle('low', remaining <= 3);
			quotaBadge.textContent = `Kendi key'in yoksa ortak deneme kotası kullanılacak — ${remaining}/${SHARED_KEY_LIMIT} tarama hakkı kaldı.`;
		}
	} catch {
		/* Profil henüz oluşturulmamış olabilir. */
	}
}

async function saveApiKey() {
	if (!state.currentUser) return;
	const input = document.getElementById('serperKeyInput');
	const status = document.getElementById('apiKeySaveStatus');
	if (!input || !status) return;

	status.textContent = 'Kaydediliyor…';
	const { error } = await sb
		.from('profiles')
		.upsert(
			{ id: state.currentUser.id, serper_api_key: input.value.trim() },
			{ onConflict: 'id' },
		);

	if (error) {
		console.error(error);
		status.textContent = 'Hata oluştu, tekrar dene.';
		return;
	}

	status.textContent = 'Kaydedildi ✓';
	await checkSerperKey();
	await loadProjectDashboard();
	setTimeout(closeApiKeyModal, 600);
}

export function init() {
	document.getElementById('serperKeyBtn')?.addEventListener('click', openApiKeyModal);
	document
		.getElementById('closeApiKeyModalBtn')
		?.addEventListener('click', closeApiKeyModal);
	document.getElementById('saveApiKeyBtn')?.addEventListener('click', saveApiKey);
	document.getElementById('apiKeyModalOverlay')?.addEventListener('click', (event) => {
		if (event.target.id === 'apiKeyModalOverlay') closeApiKeyModal();
	});
}
