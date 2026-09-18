import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml, dayLabel, timeLabel } from './utils.js';
export const EVENT_META = {
	yeni_rakip: { icon: '🆕', label: 'Yeni Rakip Tespit Edildi' },
	siralama_degisti: { icon: '📈', label: 'Sıralama Değişimi' },
	yeni_trend: { icon: '💬', label: 'Yeni Trend / Soru Tespit Edildi' },
	degisiklik_yok: { icon: '🔍', label: 'Rutin Tarama' },
};

export async function loadRuns() {
	const feedList = document.getElementById('feedList');
	feedList.innerHTML = '<div class="feed-empty">Yükleniyor…</div>';

	// RLS sayesinde sadece currentUser'ın verileri gelir; ek filtre gerekmez.
	const { data, error } = await sb
		.from('runs')
		.select('*')
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

export function renderFeed() {
	const feedList = document.getElementById('feedList');
	const filtered =
		state.currentFilter === 'all'
			? state.allRuns
			: state.allRuns.filter((r) => r.event_type === state.currentFilter);

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
      <div class="detail-title">${meta.icon} ${meta.label}</div>
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
