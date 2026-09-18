import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { logAudit } from './audit.js';

const SOURCE_LABELS = {
	manual_chatgpt: 'ChatGPT manuel',
	manual_gemini: 'Gemini manuel',
	google_paa: 'Google PAA/related',
	other_manual: 'Diğer manuel',
};

function setStatus(message, isError = false) {
	const element = document.getElementById('geoStatus');
	if (!element) return;
	element.textContent = message;
	element.classList.toggle('error', isError);
}

async function loadChecks() {
	const wrap = document.getElementById('geoTableWrap');
	if (!state.currentProject) {
		wrap.innerHTML = '<p class="detail-muted">Önce bir proje seç.</p>';
		return;
	}
	const { data, error } = await sb
		.from('geo_checks')
		.select('checked_at, prompt, source, brand_mentioned, competitor_mentions, cited_domains, notes')
		.eq('project_id', state.currentProject.id)
		.order('checked_at', { ascending: false })
		.limit(50);
	if (error) {
		console.error(error);
		wrap.innerHTML = '<p class="detail-error">GEO kayıtları okunamadı. schema.sql v10 migrationını çalıştır.</p>';
		return;
	}
	if (!data?.length) {
		wrap.innerHTML = '<p class="detail-muted">Henüz GEO kontrolü kaydedilmedi.</p>';
		return;
	}
	wrap.innerHTML = `
    <table class="report-table">
      <thead><tr><th>Tarih</th><th>Soru</th><th>Kaynak</th><th>Marka</th><th>Rakipler</th><th>Cited domainler</th></tr></thead>
      <tbody>${data
			.map(
				(row) => `<tr>
          <td>${escapeHtml(new Date(row.checked_at).toLocaleDateString('tr-TR'))}</td>
          <td title="${escapeHtml(row.notes || '')}">${escapeHtml(row.prompt)}</td>
          <td>${escapeHtml(SOURCE_LABELS[row.source] || row.source)}</td>
          <td>${row.brand_mentioned ? '✓' : '—'}</td>
          <td>${escapeHtml(row.competitor_mentions || '—')}</td>
          <td>${escapeHtml(row.cited_domains || '—')}</td>
        </tr>`,
			)
			.join('')}</tbody>
    </table>`;
}

async function saveCheck(event) {
	event.preventDefault();
	if (!state.currentUser || !state.currentProject) return;
	const status = document.getElementById('geoSaveStatus');
	const prompt = document.getElementById('geoPromptInput').value.trim();
	if (!prompt) {
		status.textContent = 'Takip sorusu gerekli.';
		return;
	}
	status.textContent = 'Kaydediliyor…';
	const { error } = await sb.from('geo_checks').insert({
		user_id: state.currentUser.id,
		project_id: state.currentProject.id,
		prompt,
		source: document.getElementById('geoSourceInput').value,
		answer_excerpt: document.getElementById('geoAnswerInput').value.trim(),
		brand_mentioned: document.getElementById('geoBrandInput').checked,
		competitor_mentions: document.getElementById('geoCompetitorsInput').value.trim(),
		cited_domains: document.getElementById('geoDomainsInput').value.trim(),
		notes: document.getElementById('geoNotesInput').value.trim(),
	});
	if (error) {
		console.error(error);
		status.textContent = 'Kaydedilemedi. schema.sql v10 migrationını çalıştır.';
		return;
	}
	logAudit('geo_check_created', {
		source: document.getElementById('geoSourceInput').value,
		brand_mentioned: document.getElementById('geoBrandInput').checked,
	});
	status.textContent = 'Kaydedildi ✓';
	document.getElementById('geoForm').reset();
	await loadChecks();
}

function openModal() {
	document.getElementById('geoModalOverlay').classList.add('open');
	setStatus('');
	loadChecks();
}

function closeModal() {
	document.getElementById('geoModalOverlay').classList.remove('open');
}

export function init() {
	document.getElementById('geoBtn').addEventListener('click', openModal);
	document.getElementById('closeGeoBtn').addEventListener('click', closeModal);
	document.getElementById('geoForm').addEventListener('submit', saveCheck);
	document.getElementById('geoModalOverlay').addEventListener('click', (event) => {
		if (event.target.id === 'geoModalOverlay') closeModal();
	});
}
