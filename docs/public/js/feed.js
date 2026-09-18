import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml, dayLabel, timeLabel } from './utils.js';
import { loadProjectDashboard } from './dashboard.js';
export const EVENT_META = {
	yeni_rakip: {
		icon: '<svg viewBox="0 0 20 20" fill="none"><circle cx="7.5" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 17c0-3 2.4-5.2 5-5.2s5 2.2 5 5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15.5 6.5v5M13 9h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
		label: 'Yeni Rakip Tespit Edildi',
	},
	siralama_degisti: {
		icon: '<svg viewBox="0 0 20 20" fill="none"><path d="M2.5 13.5 7.3 8.7l3 3 6.2-6.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 4.7h3.5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
		label: 'Sıralama Değişimi',
	},
	yeni_trend: {
		icon: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 4.5h14a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H8l-4 3v-3H3a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.2 8c0-1 .9-1.6 1.8-1.6 1 0 1.7.6 1.7 1.4 0 .7-.4 1-.9 1.3-.5.3-.8.6-.8 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="12.3" r=".9" fill="currentColor"/></svg>',
		label: 'Yeni Trend / Soru Tespit Edildi',
	},
	degisiklik_yok: {
		icon: '<svg viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M12.5 12.5 17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
		label: 'Rutin Tarama',
	},
};

export async function loadRuns() {
	const feedList = document.getElementById('feedList');
	if (!state.currentProject) {
		state.allRuns = [];
		feedList.innerHTML =
			'<div class="feed-empty">Görüntülemek için bir proje oluştur veya seç.</div>';
		return;
	}
	feedList.innerHTML = '<div class="feed-empty">Yükleniyor…</div>';

	// RLS kullanıcı izolasyonunu sağlar; project_id seçili proje bağlamını
	// belirler ve farklı müşterilerin kayıtlarının karışmasını önler.
	const { data, error } = await sb
		.from('runs')
		.select('*')
		.eq('project_id', state.currentProject.id)
		.order('run_time', { ascending: false })
		.limit(100);

	if (error) {
		feedList.innerHTML = `<div class="feed-empty">Veri çekilemedi: ${error.message}</div>`;
		console.error(error);
		return;
	}
	state.allRuns = data || [];
	renderFeed();
}

// Bir run'ın, verilen sekme filtresine ait değişiklik tipini İÇEREN en az
// bir kelimesi var mı diye bakar. run.event_type sadece run'un "en öne
// çıkan" TEK etiketini tutuyor (bkz. compare_engine.py
// determine_event_type — öncelik: yeni_rakip > siralama_degisti >
// yeni_trend), bu yüzden salt event_type'a göre filtrelemek aynı run
// içindeki diğer kelimelerin değişikliklerini (details jsonb'de zaten
// duran veriyi) sekmelerde görünmez kılıyordu — bu bir görünürlük
// sorunuydu, veri kaybı değil.
function runHasChangeType(run, filterType) {
	const details = run.details || {};
	return Object.values(details).some((d) => {
		if (!d || d.error || d.first_run || !d.has_changes) return false;
		if (filterType === 'yeni_rakip') return !!d.new_domains?.length;
		if (filterType === 'siralama_degisti') return !!d.position_changes?.length;
		if (filterType === 'yeni_trend')
			return !!(d.new_paa?.length || d.new_related?.length);
		return false;
	});
}

export function renderFeed() {
	const feedList = document.getElementById('feedList');
	const filtered =
		state.currentFilter === 'all'
			? state.allRuns
			: state.allRuns.filter((r) => runHasChangeType(r, state.currentFilter));

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
			'feed-card' + (run.id === state.selectedRunId ? ' selected' : '');
		card.innerHTML = `
      <div class="feed-card-icon ev-${run.event_type}">${meta.icon}</div>
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

export function selectRun(runId) {
	state.selectedRunId = runId;
	renderFeed();
	renderDetail(state.allRuns.find((r) => r.id === runId));
}

export function renderDetail(run) {
	const panel = document.getElementById('detailContent') || document.getElementById('detailPanel');
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
			if (d.target_domain) {
				const currentRank = d.target_position
					? `#${d.target_position}`
					: 'İlk 10 dışında';
				const previousRank = d.previous_target_position
					? `#${d.previous_target_position}`
					: 'İlk 10 dışında';
				const directionLabels = {
					improved: 'Yükseldi',
					declined: 'Geriledi',
					entered: 'İlk 10’a girdi',
					left: 'İlk 10’dan çıktı',
					unchanged: 'Değişmedi',
					not_in_top_10: 'İlk 10 dışında',
					baseline: 'İlk ölçüm',
				};
				const direction = directionLabels[d.target_direction] || d.target_direction;
				bodyHtml += `<p class="detail-target-rank"><strong>Hedef sıra:</strong> ${currentRank} · önceki ${previousRank} · ${escapeHtml(direction)}<br><span class="detail-muted">${escapeHtml(d.target_domain)}</span></p>`;
			}
			if (d.error) {
				bodyHtml += `<p class="detail-error">Hata: ${escapeHtml(d.error)}</p>`;
			} else if (d.first_run) {
				bodyHtml += `<p class="detail-muted">İlk tarama — karşılaştırma için baz alındı.</p>`;
			} else if (!d.has_changes) {
				bodyHtml += `<p class="detail-muted">Değişiklik yok.</p>`;
			} else {
				if (d.new_domains?.length) {
					bodyHtml += `<p><strong>Yeni rakip alan adları:</strong> ${d.new_domains.map(escapeHtml).join(', ')}</p>`;
				}
				if (d.removed_domains?.length) {
					bodyHtml += `<p><strong>Listeden çıkan alan adları:</strong> ${d.removed_domains.map(escapeHtml).join(', ')}</p>`;
				}
				if (d.position_changes?.length) {
					bodyHtml += `<p><strong>Sıralama değişimleri:</strong></p><ul>`;
					d.position_changes.forEach((p) => {
						bodyHtml += `<li>${escapeHtml(p.link)}: ${p.old_position} → ${p.new_position}</li>`;
					});
					bodyHtml += `</ul>`;
				}
				if (d.new_paa?.length) {
					bodyHtml += `<p><strong>Yeni "İnsanlar Ayrıca Sordu" soruları:</strong></p><ul>`;
					d.new_paa.forEach((q) => (bodyHtml += `<li>${escapeHtml(q)}</li>`));
					bodyHtml += `</ul>`;
				}
				if (d.new_related?.length) {
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
      <div class="detail-title"><span class="detail-title-icon ev-${run.event_type}">${meta.icon}</span>${meta.label}</div>
			<div class="detail-subtitle">${date.toLocaleString('tr-TR')}</div>
    </div>
    <div class="detail-body">${bodyHtml}</div>
  `;
}

export function init() {
	document.getElementById('refreshBtn').addEventListener('click', loadRuns);
	document.querySelectorAll('.tab').forEach((tab) => {
		tab.addEventListener('click', () => {
			document
				.querySelectorAll('.tab')
				.forEach((t) => t.classList.remove('active'));
			tab.classList.add('active');
			state.currentFilter = tab.dataset.filter;
			renderFeed();
		});
	});
}

// ---------- Realtime ----------

let runsChannel = null;

// Kullanıcı giriş yaptığında (veya oturum sayfa yenilenince geri
// yüklendiğinde) auth.js tarafından çağrılır. runs tablosuna bu kullanıcı
// için yeni bir satır INSERT edildiğinde feed'i otomatik yeniler
// (F5/manuel yenile gerekmeden) — RLS zaten user_id = auth.uid() ile
// sınırlı olduğundan filter burada sadece gereksiz event trafiğini
// azaltmak için var, güvenlik RLS'ten geliyor.
export function subscribeToRuns(userId) {
	unsubscribeFromRuns();
	runsChannel = sb
		.channel(`runs-changes-${userId}`)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'runs',
				filter: `user_id=eq.${userId}`,
			},
			() => {
				// Yeni run geldi — mevcut loadRuns() akışı (hata yönetimi dahil)
				// aynen kullanılarak feed baştan yüklenir.
				loadRuns();
				loadProjectDashboard();
			},
		)
		.subscribe();
}

// Çıkış yapıldığında abonelik kapatılır — bir sonraki giriş yapan kullanıcı
// farklı bir user_id ile abone olacağından eski kanal (ve filtresi)
// temizlenmeli, aksi halde kanal sızıntısı ve yanlış filtreyle dinleme olur.
export function unsubscribeFromRuns() {
	if (runsChannel) {
		sb.removeChannel(runsChannel);
		runsChannel = null;
	}
}
