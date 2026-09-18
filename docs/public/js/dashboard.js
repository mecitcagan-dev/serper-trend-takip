import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { SHARED_KEY_LIMIT } from './serperKey.js';

const DEFAULT_INTERVAL_MINUTES = 360;

function setText(id, value) {
	const element = document.getElementById(id);
	if (element) element.textContent = value;
}

function formatDate(value, multiline = false) {
	if (!value) return 'Henüz tarama yapılmadı';
	const date = new Date(value);
	const datePart = date.toLocaleDateString('tr-TR', {
		day: '2-digit',
		month: '2-digit',
	});
	const timePart = date.toLocaleTimeString('tr-TR', {
		hour: '2-digit',
		minute: '2-digit',
	});
	return multiline ? `${datePart}\n${timePart}` : `${datePart} ${timePart}`;
}

function formatNextRun(lastRun, intervalMinutes, multiline = false) {
	if (!lastRun) return 'İlk tarama bekleniyor';
	const next = new Date(lastRun);
	next.setMinutes(next.getMinutes() + intervalMinutes);
	return formatDate(next.toISOString(), multiline);
}

function setQuotaCardVisible(isVisible) {
	const dashboard = document.getElementById('projectDashboard');
	const existing = document.getElementById('dashboardQuotaCard');
	if (isVisible) {
		if (existing) return;
		const card = document.createElement('div');
		card.className = 'dashboard-card';
		card.id = 'dashboardQuotaCard';
		card.innerHTML = '<span>Kota durumu</span><strong id="dashboardQuota">—</strong>';
		dashboard?.querySelector('#dashboardStatus')?.before(card);
		return;
	}
	existing?.remove();
}

function resetDashboard(message = '') {
	setQuotaCardVisible(false);
	setText('dashboardLastRun', 'Henüz tarama yapılmadı');
	setText('dashboardNextRun', 'İlk tarama bekleniyor');
	setText('dashboardKeywordCount', 'Henüz kelime yok');
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
		setQuotaCardVisible(false);
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
	const showQuotaCard = !hasOwnKey && remaining > 0;
	setQuotaCardVisible(showQuotaCard);

	setText('dashboardLastRun', formatDate(lastRun, true));
	setText('dashboardNextRun', formatNextRun(lastRun, interval, true));
	setText('dashboardKeywordCount', String(keywordsResult.data?.length || 0));
	if (showQuotaCard) setText('dashboardQuota', `${remaining}/${SHARED_KEY_LIMIT} ücretsiz`);
	const activeKeywordCount = keywordsResult.data?.length || 0;
	const quotaLabel = hasOwnKey
		? 'Kişisel key'
		: remaining > 0
			? `${remaining}/${SHARED_KEY_LIMIT} kota`
			: 'Kota tükendi';
	setText(
		'dashboardToggleMeta',
		`${lastRun ? `Son: ${formatDate(lastRun)}` : 'Henüz tarama yok'} · ${activeKeywordCount} aktif kelime · ${quotaLabel}`,
	);
	setText('dashboardStatus', `${interval} dakikalık proje tarama aralığı`);
}
