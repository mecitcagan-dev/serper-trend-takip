// Serper Trend Takip - frontend mantığı
// Bu dosya config.js içindeki SUPABASE_URL / SUPABASE_ANON_KEY değerlerini kullanır.

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EVENT_META = {
	yeni_rakip: { icon: '🆕', label: 'Yeni Rakip Tespit Edildi' },
	siralama_degisti: { icon: '📈', label: 'Sıralama Değişimi' },
	yeni_trend: { icon: '💬', label: 'Yeni Trend / Soru Tespit Edildi' },
	degisiklik_yok: { icon: '🔍', label: '6 Saatlik Tarama' },
};

let allRuns = [];
let currentFilter = 'all';
let selectedRunId = null;
let keywordWorkingList = []; // modal içindeki geçici çalışma listesi

// ---------- Activity Feed ----------

async function loadRuns() {
	const feedEmpty = document.getElementById('feedEmpty');
	feedEmpty.textContent = 'Yükleniyor…';
	const { data, error } = await sb
		.from('runs')
		.select('*')
		.order('run_time', { ascending: false })
		.limit(100);

	if (error) {
		feedEmpty.textContent = 'Veri çekilemedi: ' + error.message;
		console.error(error);
		return;
	}
	allRuns = data || [];
	renderFeed();
}

function dayLabel(dateStr) {
	const date = new Date(dateStr);
	const now = new Date();
	const isSameDay = (a, b) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	if (isSameDay(date, now)) return 'Bugün';
	if (isSameDay(date, yesterday)) return 'Dün';
	return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function timeLabel(dateStr) {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMin = Math.round((now - date) / 60000);
	if (diffMin < 1) return 'az önce';
	if (diffMin < 60) return `${diffMin} dakika önce`;
	const diffHour = Math.round(diffMin / 60);
	if (diffHour < 24) return `${diffHour} saat önce`;
	return date.toLocaleTimeString('tr-TR', {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function renderFeed() {
	const feedList = document.getElementById('feedList');
	const filtered =
		currentFilter === 'all'
			? allRuns
			: allRuns.filter((r) => r.event_type === currentFilter);

	feedList.innerHTML = '';

	if (filtered.length === 0) {
		feedList.innerHTML =
			'<div class="feed-empty">Henüz kayıt yok. Otomasyon ilk çalıştığında burada görünecek.</div>';
		return;
	}

	let lastDay = null;
	filtered.forEach((run) => {
		const day = dayLabel(run.run_time);
		if (day !== lastDay) {
			const sep = document.createElement('div');
			sep.className = 'day-separator';
			sep.textContent = day;
			feedList.appendChild(sep);
			lastDay = day;
		}

		const meta = EVENT_META[run.event_type] || EVENT_META.degisiklik_yok;
		const card = document.createElement('div');
		card.className =
			'feed-card' + (run.id === selectedRunId ? ' selected' : '');
		card.innerHTML = `
      <div class="feed-card-icon">${meta.icon}</div>
      <div class="feed-card-body">
        <div class="feed-card-top">
          <span class="feed-card-title">${meta.label}</span>
          <span class="feed-card-time">${timeLabel(run.run_time)}</span>
        </div>
        <div class="feed-card-preview">${escapeHtml(run.summary)}</div>
      </div>
    `;
		card.addEventListener('click', () => selectRun(run.id));
		feedList.appendChild(card);
	});
}

function selectRun(runId) {
	selectedRunId = runId;
	renderFeed();
	renderDetail(allRuns.find((r) => r.id === runId));
}

function renderDetail(run) {
	const panel = document.getElementById('detailPanel');
	if (!run) {
		panel.innerHTML =
			'<div class="detail-empty">Bir kart seç, detaylı raporu burada gör.</div>';
		return;
	}
	const meta = EVENT_META[run.event_type] || EVENT_META.degisiklik_yok;
	const date = new Date(run.run_time);

	let bodyHtml = '';
	const details = run.details || {};
	const keywords = Object.keys(details);

	if (keywords.length === 0) {
		bodyHtml = '<p>Bu çalıştırmada detay bulunamadı.</p>';
	} else {
		keywords.forEach((kw) => {
			const d = details[kw];
			bodyHtml += `<div class="detail-keyword-block"><h3>${escapeHtml(kw)}</h3>`;

			if (d.error) {
				bodyHtml += `<p class="detail-error">Hata: ${escapeHtml(d.error)}</p>`;
			} else if (d.first_run) {
				bodyHtml += `<p class="detail-muted">İlk tarama — karşılaştırma için baz alındı.</p>`;
			} else if (!d.has_changes) {
				bodyHtml += `<p class="detail-muted">Değişiklik yok.</p>`;
			} else {
				if (d.new_domains && d.new_domains.length) {
					bodyHtml += `<p><strong>Yeni rakip alan adları:</strong> ${d.new_domains.map(escapeHtml).join(', ')}</p>`;
				}
				if (d.removed_domains && d.removed_domains.length) {
					bodyHtml += `<p><strong>Listeden çıkan alan adları:</strong> ${d.removed_domains.map(escapeHtml).join(', ')}</p>`;
				}
				if (d.position_changes && d.position_changes.length) {
					bodyHtml += `<p><strong>Sıralama değişimleri:</strong></p><ul>`;
					d.position_changes.forEach((p) => {
						bodyHtml += `<li>${escapeHtml(p.link)}: ${p.old_position} → ${p.new_position}</li>`;
					});
					bodyHtml += `</ul>`;
				}
				if (d.new_paa && d.new_paa.length) {
					bodyHtml += `<p><strong>Yeni "İnsanlar Ayrıca Sordu" soruları:</strong></p><ul>`;
					d.new_paa.forEach((q) => (bodyHtml += `<li>${escapeHtml(q)}</li>`));
					bodyHtml += `</ul>`;
				}
				if (d.new_related && d.new_related.length) {
					bodyHtml += `<p><strong>Yeni ilgili aramalar:</strong></p><ul>`;
					d.new_related.forEach(
						(r) => (bodyHtml += `<li>${escapeHtml(r)}</li>`),
					);
					bodyHtml += `</ul>`;
				}
			}
			bodyHtml += `</div>`;
		});
	}

	panel.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${meta.icon} ${meta.label}</div>
      <div class="detail-subtitle">${date.toLocaleString('tr-TR')}</div>
    </div>
    <div class="detail-body">${bodyHtml}</div>
  `;
}

function escapeHtml(str) {
	if (str === null || str === undefined) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// ---------- Kelime Düzenleme Modalı ----------

async function openKeywordModal() {
	document.getElementById('modalOverlay').classList.add('open');
	document.getElementById('saveStatus').textContent = '';
	const { data, error } = await sb
		.from('keywords')
		.select('*')
		.order('id', { ascending: true });
	if (error) {
		console.error(error);
		keywordWorkingList = [];
	} else {
		keywordWorkingList = data.map((k) => ({
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
	keywordWorkingList.forEach((item, idx) => {
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
			keywordWorkingList[+e.target.dataset.idx].active = e.target.checked;
		});
	});
	list.querySelectorAll('.remove-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			keywordWorkingList.splice(+e.target.dataset.idx, 1);
			renderKeywordList();
		});
	});
}

function addKeywordFromInput() {
	const input = document.getElementById('newKeywordInput');
	const value = input.value.trim();
	if (!value) return;
	keywordWorkingList.push({ id: null, keyword: value, active: true });
	input.value = '';
	renderKeywordList();
}

async function saveKeywords() {
	const status = document.getElementById('saveStatus');
	status.textContent = 'Kaydediliyor…';

	const { data: originalRows } = await sb.from('keywords').select('id');
	const originalIds = new Set((originalRows || []).map((r) => r.id));
	const keptIds = new Set(
		keywordWorkingList.filter((k) => k.id).map((k) => k.id),
	);

	const toDelete = [...originalIds].filter((id) => !keptIds.has(id));
	const toInsert = keywordWorkingList.filter((k) => !k.id);
	const toUpdate = keywordWorkingList.filter((k) => k.id);

	try {
		if (toDelete.length) {
			await sb.from('keywords').delete().in('id', toDelete);
		}
		for (const k of toUpdate) {
			await sb
				.from('keywords')
				.update({ keyword: k.keyword, active: k.active })
				.eq('id', k.id);
		}
		if (toInsert.length) {
			await sb
				.from('keywords')
				.insert(
					toInsert.map((k) => ({ keyword: k.keyword, active: k.active })),
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

// ---------- Olay bağlamaları ----------

document.getElementById('refreshBtn').addEventListener('click', loadRuns);

document.querySelectorAll('.tab').forEach((tab) => {
	tab.addEventListener('click', () => {
		document
			.querySelectorAll('.tab')
			.forEach((t) => t.classList.remove('active'));
		tab.classList.add('active');
		currentFilter = tab.dataset.filter;
		renderFeed();
	});
});

document
	.getElementById('editKeywordsBtn')
	.addEventListener('click', openKeywordModal);
document.getElementById('closeModalBtn').addEventListener('click', () => {
	document.getElementById('modalOverlay').classList.remove('open');
});
document
	.getElementById('addKeywordBtn')
	.addEventListener('click', addKeywordFromInput);
document.getElementById('newKeywordInput').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') addKeywordFromInput();
});
document
	.getElementById('saveKeywordsBtn')
	.addEventListener('click', saveKeywords);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
	if (e.target.id === 'modalOverlay') e.target.classList.remove('open');
});

// ---------- Tarama Sıklığı Ayarı ----------

const SETTINGS_KEY = 'scan_interval_minutes';

async function openSettingsModal() {
	document.getElementById('settingsModalOverlay').classList.add('open');
	document.getElementById('settingsSaveStatus').textContent = '';
	const { data, error } = await sb
		.from('settings')
		.select('value')
		.eq('key', SETTINGS_KEY)
		.limit(1);
	if (!error && data && data.length) {
		document.getElementById('intervalSelect').value = data[0].value;
	}
}

async function saveSettings() {
	const status = document.getElementById('settingsSaveStatus');
	status.textContent = 'Kaydediliyor…';
	const value = document.getElementById('intervalSelect').value;
	const { error } = await sb
		.from('settings')
		.upsert({ key: SETTINGS_KEY, value });
	if (error) {
		console.error(error);
		status.textContent = 'Hata oluştu, tekrar dene.';
	} else {
		status.textContent = 'Kaydedildi ✓';
		setTimeout(
			() =>
				document
					.getElementById('settingsModalOverlay')
					.classList.remove('open'),
			600,
		);
	}
}

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

// ---------- Başlangıç ----------
loadRuns();
