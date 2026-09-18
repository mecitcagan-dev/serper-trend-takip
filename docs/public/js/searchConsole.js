import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { logAudit } from './audit.js';

const CLIENT_ID_STORAGE_KEY = 'serper-trend-google-client-id';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
let accessToken = null;
let tokenClient = null;
let properties = [];

function setStatus(message, isError = false) {
	const element = document.getElementById('gscStatus');
	if (!element) return;
	element.textContent = message;
	element.classList.toggle('error', isError);
}

function toDateInputValue(date) {
	return date.toISOString().slice(0, 10);
}

function setDefaultDates() {
	const today = new Date();
	const monthAgo = new Date(today);
	monthAgo.setDate(today.getDate() - 28);
	document.getElementById('gscStartDate').value = toDateInputValue(monthAgo);
	document.getElementById('gscEndDate').value = toDateInputValue(today);
}

function waitForGoogleIdentityServices() {
	return new Promise((resolve, reject) => {
		const startedAt = Date.now();
		const check = () => {
			if (window.google?.accounts?.oauth2) {
				resolve(window.google);
				return;
			}
			if (Date.now() - startedAt > 7000) {
				reject(new Error('Google Identity Services yüklenemedi.'));
				return;
			}
			setTimeout(check, 100);
		};
		check();
	});
}

async function requestAccessToken(clientId) {
	const google = await waitForGoogleIdentityServices();
	return new Promise((resolve, reject) => {
		tokenClient = google.accounts.oauth2.initTokenClient({
			client_id: clientId,
			scope: GSC_SCOPE,
			callback: (response) => {
				if (response.error || !response.access_token) {
					reject(new Error(response.error_description || 'Google yetkilendirmesi başarısız.'));
					return;
				}
				accessToken = response.access_token;
				resolve(response.access_token);
			},
			error_callback: (error) => reject(new Error(error.type || 'Google popup açılamadı.')),
		});
		tokenClient.requestAccessToken({ prompt: 'consent' });
	});
}

function renderProperties() {
	const select = document.getElementById('gscPropertySelect');
	select.innerHTML = '';
	if (!properties.length) {
		select.innerHTML = '<option value="">Yetkili mülk bulunamadı</option>';
		select.disabled = true;
		return;
	}
	properties.forEach((property) => {
		const option = document.createElement('option');
		option.value = property.siteUrl;
		option.textContent = `${property.siteUrl} (${property.permissionLevel || 'yetki'})`;
		select.appendChild(option);
	});
	const saved = state.currentProject?.gsc_site_url;
	if (saved && properties.some((property) => property.siteUrl === saved)) {
		select.value = saved;
	}
	select.disabled = false;
}

async function listProperties() {
	const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) throw new Error('Search Console mülkleri okunamadı.');
	const data = await response.json();
	properties = data.siteEntry || [];
	renderProperties();
}

async function connectSearchConsole() {
	const input = document.getElementById('googleClientIdInput');
	const clientId = input.value.trim();
	if (!clientId) {
		setStatus('Önce Google OAuth Client ID gir.', true);
		return;
	}
	localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
	setStatus('Google yetkilendirmesi bekleniyor…');
	try {
		await requestAccessToken(clientId);
		await listProperties();
		setStatus(`${properties.length} Search Console mülkü bulundu.`);
	} catch (error) {
		console.error(error);
		setStatus(error.message, true);
	}
}

async function saveProperty() {
	if (!state.currentProject) return;
	const siteUrl = document.getElementById('gscPropertySelect').value;
	if (!siteUrl) {
		setStatus('Önce yetkili bir mülk seç.', true);
		return;
	}
	const { data, error } = await sb
		.from('projects')
		.update({ gsc_site_url: siteUrl })
		.eq('id', state.currentProject.id)
		.select()
		.single();
	if (error) {
		console.error(error);
		setStatus('Mülk projeye kaydedilemedi. schema.sql v9 migrationını çalıştır.', true);
		return;
	}
	state.currentProject = data;
	logAudit('gsc_property_saved', { site_url: siteUrl });
	setStatus('Search Console mülkü projeye kaydedildi.');
}

function renderGscRows(rows, trackedKeywords, serpDetails) {
	const wrap = document.getElementById('gscTableWrap');
	if (!rows.length) {
		wrap.innerHTML = '<p class="detail-muted">Bu tarih aralığında Search Console verisi yok.</p>';
		return;
	}
	wrap.innerHTML = `
    <table class="report-table">
      <thead><tr><th>Sorgu</th><th>Tıklama</th><th>Gösterim</th><th>CTR</th><th>GSC ort.</th><th>SERP son</th></tr></thead>
      <tbody>${rows
			.map((row) => {
				const query = row.keys?.[0] || '';
				const serp = serpDetails[query]?.target_position;
				return `<tr>
          <td>${escapeHtml(query)}${trackedKeywords.has(query.toLowerCase()) ? ' <small>(takipte)</small>' : ''}</td>
          <td>${Number(row.clicks || 0).toLocaleString('tr-TR')}</td>
          <td>${Number(row.impressions || 0).toLocaleString('tr-TR')}</td>
          <td>${(Number(row.ctr || 0) * 100).toFixed(1)}%</td>
          <td>${Number(row.position || 0).toFixed(1)}</td>
          <td>${serp ? `#${serp}` : '—'}</td>
        </tr>`;
			})
			.join('')}</tbody>
    </table>`;
}

async function loadGscData() {
	if (!accessToken) {
		setStatus('Önce Google’a bağlan.', true);
		return;
	}
	const siteUrl = document.getElementById('gscPropertySelect').value;
	const startDate = document.getElementById('gscStartDate').value;
	const endDate = document.getElementById('gscEndDate').value;
	if (!siteUrl || !startDate || !endDate || startDate > endDate) {
		setStatus('Mülk ve geçerli tarih aralığı seç.', true);
		return;
	}
	setStatus('Search Console verisi getiriliyor…');
	const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			startDate,
			endDate,
			dimensions: ['query'],
			rowLimit: 1000,
		}),
	});
	if (response.status === 401) {
		accessToken = null;
		setStatus('Google erişimi sona erdi; tekrar bağlan.', true);
		return;
	}
	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}));
		setStatus(errorBody.error?.message || 'Search Console verisi okunamadı.', true);
		return;
	}

	const data = await response.json();
	const [keywordsResult, runsResult] = await Promise.all([
		sb.from('keywords')
			.select('keyword')
			.eq('project_id', state.currentProject.id)
			.eq('active', true),
		sb.from('runs')
			.select('details')
			.eq('project_id', state.currentProject.id)
			.order('run_time', { ascending: false })
			.limit(1),
	]);
	const trackedKeywords = new Set(
		(keywordsResult.data || []).map((row) => row.keyword.toLowerCase()),
	);
	const serpDetails = runsResult.data?.[0]?.details || {};
	renderGscRows(data.rows || [], trackedKeywords, serpDetails);
	setStatus(`${data.rows?.length || 0} sorgu getirildi.`);
}

function openModal() {
	document.getElementById('searchConsoleModalOverlay').classList.add('open');
	document.getElementById('googleClientIdInput').value =
		localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '';
	setDefaultDates();
	if (state.currentProject?.gsc_site_url && properties.length) renderProperties();
}

function closeModal() {
	document.getElementById('searchConsoleModalOverlay').classList.remove('open');
}

export function init() {
	document.getElementById('searchConsoleBtn').addEventListener('click', openModal);
	document.getElementById('closeSearchConsoleBtn').addEventListener('click', closeModal);
	document
		.getElementById('connectSearchConsoleBtn')
		.addEventListener('click', connectSearchConsole);
	document.getElementById('saveGscPropertyBtn').addEventListener('click', saveProperty);
	document.getElementById('loadGscDataBtn').addEventListener('click', loadGscData);
	document
		.getElementById('searchConsoleModalOverlay')
		.addEventListener('click', (event) => {
			if (event.target.id === 'searchConsoleModalOverlay') closeModal();
		});
}
