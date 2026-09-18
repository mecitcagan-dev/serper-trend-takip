import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { SHARED_KEY_LIMIT } from './serperKey.js';

const DEFAULT_INTERVAL_MINUTES = 360;

function setText(id, value) {
	const element = document.getElementById(id);
	if (element) element.textContent = value;
}

function formatDate(value) {
	if (!value) return 'Henüz yok';
	return new Date(value).toLocaleString('tr-TR', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatNextRun(lastRun, intervalMinutes) {
	if (!lastRun) return 'İlk tarama bekleniyor';
	const next = new Date(lastRun);
	next.setMinutes(next.getMinutes() + intervalMinutes);
	return formatDate(next.toISOString());
}

function resetDashboard(message = '') {
	setText('dashboardLastRun', '—');
	setText('dashboardNextRun', '—');
	setText('dashboardKeywordCount', '—');
	setText('dashboardQuota', '—');
	setText('dashboardToggleMeta', 'Son tarama, aktif kelimeler ve kota');
	setText('dashboardStatus', message);
}

export function init() {
	const toggle = document.getElementById('dashboardToggleBtn');
	const panel = document.getElementById('projectDashboard');
	if (!toggle || !panel) return;

	toggle.addEventListener('click', () => {
		const isOpen = panel.classList.toggle('open');
		toggle.setAttribute('aria-expanded', String(isOpen));
	});
}

export async function loadProjectDashboard() {
	if (!state.currentUser || !state.currentProject) {
		resetDashboard('Bir proje seçildiğinde özet burada görünür.');
		return;
	}

	setText('dashboardStatus', 'Güncelleniyor…');
	const projectId = state.currentProject.id;
	const userId = state.currentUser.id;

	const [keywordsResult, runsResult, settingsResult, profileResult] =
		await Promise.all([
			sb
				.from('keywords')
				.select('id')
				.eq('project_id', projectId)
				.eq('active', true),
			sb
				.from('runs')
				.select('run_time')
				.eq('project_id', projectId)
				.order('run_time', { ascending: false })
				.limit(1),
			sb
				.from('settings')
				.select('value')
				.eq('user_id', userId)
				.eq('key', 'scan_interval_minutes')
				.limit(1),
			sb
				.from('profiles')
				.select('serper_api_key, shared_key_scans_used')
				.eq('id', userId)
				.limit(1),
		]);

	const firstError = [
		keywordsResult.error,
		runsResult.error,
		settingsResult.error,
		profileResult.error,
	].find(Boolean);
	if (firstError) {
		console.error(firstError);
		setText('dashboardToggleMeta', 'Proje özeti yüklenemedi');
		setText('dashboardStatus', 'Proje özeti yüklenemedi.');
		return;
	}

	const lastRun = runsResult.data?.[0]?.run_time || null;
	const interval = Number(settingsResult.data?.[0]?.value) || DEFAULT_INTERVAL_MINUTES;
	const profile = profileResult.data?.[0];
	const hasOwnKey = !!profile?.serper_api_key;
	const remaining = Math.max(
		0,
		SHARED_KEY_LIMIT - (profile?.shared_key_scans_used || 0),
	);

	setText('dashboardLastRun', formatDate(lastRun));
	setText('dashboardNextRun', formatNextRun(lastRun, interval));
	setText('dashboardKeywordCount', String(keywordsResult.data?.length || 0));
	setText(
		'dashboardQuota',
		hasOwnKey ? 'Kişisel key' : `${remaining}/${SHARED_KEY_LIMIT} ücretsiz`,
	);
	const activeKeywordCount = keywordsResult.data?.length || 0;
	const quotaLabel = hasOwnKey
		? 'Kişisel key'
		: `${remaining}/${SHARED_KEY_LIMIT} kota`;
	setText(
		'dashboardToggleMeta',
		`${lastRun ? `Son: ${formatDate(lastRun)}` : 'Henüz tarama yok'} · ${activeKeywordCount} aktif kelime · ${quotaLabel}`,
	);
	setText('dashboardStatus', `${interval} dakikalık proje tarama aralığı`);
}
