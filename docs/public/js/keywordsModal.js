import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export async function openKeywordModal() {
	document.getElementById('modalOverlay').classList.add('open');
	document.getElementById('saveStatus').textContent = '';
	document.getElementById('bulkAddStatus').textContent = '';
	document.getElementById('bulkKeywordInput').value = '';
	if (!state.currentProject) {
		state.keywordWorkingList = [];
		document.getElementById('saveStatus').textContent =
			'Önce bir proje oluştur veya seç.';
		renderKeywordList();
		return;
	}

	// RLS kullanıcı izolasyonunu sağlar; project_id seçili müşteriyi belirler.
	const { data, error } = await sb
		.from('keywords')
		.select('*')
		.eq('project_id', state.currentProject.id)
		.order('id', { ascending: true });

	if (error) {
		console.error(error);
		state.keywordWorkingList = [];
	} else {
		state.keywordWorkingList = data.map((k) => ({
			id: k.id,
			keyword: k.keyword,
			active: k.active,
		}));
	}
	renderKeywordList();
}

function renderKeywordList() {
	const list = document.getElementById('keywordList');
	list.innerHTML = '';
	state.keywordWorkingList.forEach((item, idx) => {
		const li = document.createElement('li');
		li.className = 'keyword-item';
		li.innerHTML = `
      <label class="keyword-active">
        <input type="checkbox" ${item.active ? 'checked' : ''} data-idx="${idx}" class="active-toggle">
      </label>
      <span class="keyword-text">${escapeHtml(item.keyword)}</span>
      <button class="remove-btn" data-idx="${idx}">Sil</button>
    `;
		list.appendChild(li);
	});

	list.querySelectorAll('.active-toggle').forEach((cb) => {
		cb.addEventListener('change', (e) => {
			state.keywordWorkingList[+e.target.dataset.idx].active = e.target.checked;
		});
	});
	list.querySelectorAll('.remove-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			state.keywordWorkingList.splice(+e.target.dataset.idx, 1);
			renderKeywordList();
		});
	});
}

function addKeywordsFromTextarea() {
	const textarea = document.getElementById('bulkKeywordInput');
	const status = document.getElementById('bulkAddStatus');
	const raw = textarea.value;
	if (!raw.trim()) {
		status.textContent = 'Önce en az bir kelime yaz.';
		return;
	}

	const candidates = raw
		.split(/[\n,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	const existingLower = new Set(
		state.keywordWorkingList.map((k) => k.keyword.toLowerCase()),
	);
	let added = 0,
		skipped = 0;

	candidates.forEach((kw) => {
		const lower = kw.toLowerCase();
		if (existingLower.has(lower)) {
			skipped++;
			return;
		}
		state.keywordWorkingList.push({ id: null, keyword: kw, active: true });
		existingLower.add(lower);
		added++;
	});

	textarea.value = '';
	renderKeywordList();

	if (added && skipped)
		status.textContent = `${added} kelime eklendi, ${skipped} tanesi zaten listedeydi.`;
	else if (added) status.textContent = `${added} kelime eklendi.`;
	else status.textContent = 'Hepsi zaten listede.';
}

async function saveKeywords() {
	if (!state.currentUser) return;
	if (!state.currentProject) return;
	const status = document.getElementById('saveStatus');
	status.textContent = 'Kaydediliyor…';

	// Yalnızca seçili projenin satırları değiştirilir.
	const { data: originalRows } = await sb
		.from('keywords')
		.select('id')
		.eq('project_id', state.currentProject.id);
	const originalIds = new Set((originalRows || []).map((r) => r.id));
	const keptIds = new Set(
		state.keywordWorkingList.filter((k) => k.id).map((k) => k.id),
	);
	const toDelete = [...originalIds].filter((id) => !keptIds.has(id));
	const toInsert = state.keywordWorkingList.filter((k) => !k.id);
	const toUpdate = state.keywordWorkingList.filter((k) => k.id);

	try {
		if (toDelete.length) await sb.from('keywords').delete().in('id', toDelete);
		for (const k of toUpdate) {
			await sb
				.from('keywords')
				.update({ keyword: k.keyword, active: k.active })
				.eq('id', k.id);
		}
		if (toInsert.length) {
			await sb.from('keywords').insert(
				toInsert.map((k) => ({
					keyword: k.keyword,
					active: k.active,
					user_id: state.currentUser.id,
					project_id: state.currentProject.id,
				})),
			);
		}
		status.textContent = 'Kaydedildi ✓';
		setTimeout(
			() => document.getElementById('modalOverlay').classList.remove('open'),
			600,
		);
	} catch (err) {
		console.error(err);
		status.textContent = 'Hata oluştu, tekrar dene.';
	}
}

export function init() {
	document
		.getElementById('editKeywordsBtn')
		.addEventListener('click', openKeywordModal);
	document.getElementById('closeModalBtn').addEventListener('click', () => {
		document.getElementById('modalOverlay').classList.remove('open');
	});
	document
		.getElementById('addKeywordBtn')
		.addEventListener('click', addKeywordsFromTextarea);
	document
		.getElementById('bulkKeywordInput')
		.addEventListener('keydown', (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
				addKeywordsFromTextarea();
		});
	document
		.getElementById('saveKeywordsBtn')
		.addEventListener('click', saveKeywords);
	document.getElementById('modalOverlay').addEventListener('click', (e) => {
		if (e.target.id === 'modalOverlay') e.target.classList.remove('open');
	});
}
