// Serper Trend Takip — frontend mantığı (v2: kullanıcı izolasyonu)
// config.js içindeki SUPABASE_URL / SUPABASE_ANON_KEY değerlerini kullanır.

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EVENT_META = {
	yeni_rakip: { icon: '🆕', label: 'Yeni Rakip Tespit Edildi' },
	siralama_degisti: { icon: '📈', label: 'Sıralama Değişimi' },
	yeni_trend: { icon: '💬', label: 'Yeni Trend / Soru Tespit Edildi' },
	degisiklik_yok: { icon: '🔍', label: 'Rutin Tarama' },
};

let allRuns = [];
let currentFilter = 'all';
let selectedRunId = null;
let keywordWorkingList = [];
let currentUser = null; // oturum açmış kullanıcı

// ---------- Tema ----------

function initTheme() {
	const saved = localStorage.getItem('stt-theme') || 'dark';
	applyTheme(saved, false);
}

function applyTheme(theme, animate = true) {
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem('stt-theme', theme);
	const icon = document.getElementById('themeIcon');
	const label = document.getElementById('themeLabel');
	if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
	if (label) label.textContent = theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod';
}

function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme') || 'dark';
	applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ---------- Profil Avatar ----------

function renderProfileAvatar(user) {
	if (!user) return;
	const initialsEl = document.getElementById('profileInitials');
	const imgEl = document.getElementById('profileImg');
	const emailEl = document.getElementById('profileInfoEmail');

	const avatarUrl = user.user_metadata?.avatar_url;
	const email = user.email || '';
	const displayName =
		user.user_metadata?.full_name || user.user_metadata?.name || email;

	if (emailEl) emailEl.textContent = email;

	if (avatarUrl && imgEl) {
		imgEl.src = avatarUrl;
		imgEl.classList.remove('hidden');
		if (initialsEl) initialsEl.classList.add('hidden');
	} else if (initialsEl) {
		initialsEl.textContent = (displayName.charAt(0) || '?').toUpperCase();
		initialsEl.classList.remove('hidden');
		if (imgEl) imgEl.classList.add('hidden');
	}
}

function toggleProfileDropdown(e) {
	if (e) e.stopPropagation();
	const dropdown = document.getElementById('profileDropdown');
	if (dropdown) dropdown.classList.toggle('hidden');
}

// Dropdown dışına tıklanınca kapat
document.addEventListener('click', (e) => {
	const wrap = document.getElementById('profileWrap');
	if (wrap && !wrap.contains(e.target)) {
		document.getElementById('profileDropdown')?.classList.add('hidden');
	}
});

// ---------- Serper Key Kontrolü ----------

async function checkSerperKey() {
	if (!currentUser) return;
	try {
		const { data } = await sb
			.from('profiles')
			.select('serper_api_key')
			.eq('id', currentUser.id)
			.single();
		const banner = document.getElementById('serperKeyBanner');
		if (!banner) return;
		if (!data?.serper_api_key) {
			banner.classList.remove('hidden');
		} else {
			banner.classList.add('hidden');
		}
	} catch {
		// profil henüz oluşturulmamış olabilir, sorun değil
	}
}

// ---------- Giriş / Kayıt ----------

let authMode = 'login';
let appInitialized = false;
let pendingVerifyEmail = '';

const cameFromEmailConfirmation =
	/type=(signup|magiclink|recovery|invite)/.test(window.location.hash);

const AUTH_REDIRECT_URL = window.location.origin + window.location.pathname;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_ERROR_MESSAGES = [
	{ match: /invalid login credentials/i, tr: 'Email veya şifre hatalı.' },
	{
		match: /user already registered|already registered/i,
		tr: 'Bu email zaten kayıtlı. "Giriş Yap" sekmesini kullan.',
	},
	{
		match: /email not confirmed/i,
		tr: 'Email adresini onaylaman gerekiyor. Gelen kutunu kontrol et.',
	},
	{
		match: /password should be at least/i,
		tr: 'Şifre en az 8 karakter olmalı.',
	},
	{
		match: /unable to validate email address|invalid email/i,
		tr: 'Geçerli bir email adresi gir.',
	},
	{
		match: /rate limit/i,
		tr: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
	},
];

function translateAuthError(message) {
	const found = AUTH_ERROR_MESSAGES.find((e) => e.match.test(message || ''));
	return found ? found.tr : message || 'Bilinmeyen bir hata oluştu.';
}

function showAuthView(view) {
	document
		.getElementById('authBoxForm')
		.classList.toggle('hidden', view !== 'form');
	document
		.getElementById('authBoxVerify')
		.classList.toggle('hidden', view !== 'verify');
	document
		.getElementById('authBoxVerified')
		.classList.toggle('hidden', view !== 'verified');
}

function showAuthGate() {
	document.getElementById('authGate').classList.remove('hidden');
	document.getElementById('appRoot').classList.add('hidden');
	showAuthView('form');
}

function showApp() {
	document.getElementById('authGate').classList.add('hidden');
	document.getElementById('appRoot').classList.remove('hidden');
	renderProfileAvatar(currentUser);
	if (!appInitialized) {
		appInitialized = true;
		loadRuns();
		checkSerperKey();
	}
}

function showVerifiedThenEnterApp() {
	document.getElementById('authGate').classList.remove('hidden');
	document.getElementById('appRoot').classList.add('hidden');
	showAuthView('verified');
	setTimeout(showApp, 1600);
}

function showVerifyPendingScreen(email) {
	pendingVerifyEmail = email;
	document.getElementById('verifyEmailText').textContent = email;
	document.getElementById('resendStatus').textContent = '';
	showAuthView('verify');
}

async function resendVerificationEmail() {
	const status = document.getElementById('resendStatus');
	if (!pendingVerifyEmail) return;
	status.textContent = 'Gönderiliyor…';
	const { error } = await sb.auth.resend({
		type: 'signup',
		email: pendingVerifyEmail,
		options: { emailRedirectTo: AUTH_REDIRECT_URL },
	});
	status.textContent = error
		? translateAuthError(error.message)
		: 'Doğrulama maili tekrar gönderildi ✓';
}

async function handleGoogleAuth() {
	const errorEl = document.getElementById('authError');
	errorEl.textContent = '';
	const { error } = await sb.auth.signInWithOAuth({
		provider: 'google',
		options: { redirectTo: AUTH_REDIRECT_URL },
	});
	if (error) errorEl.textContent = translateAuthError(error.message);
}

// ---------- Şifre gücü ----------

const COMMON_WEAK_PASSWORDS = [
	'12345678',
	'123456789',
	'1234567890',
	'password',
	'password1',
	'qwerty123',
	'11111111',
	'00000000',
	'asdasdasd',
	'123123123',
	'sifre123',
	'şifre123',
];

function scorePassword(pw) {
	if (!pw) return { score: 0, label: '', percent: 0, color: '' };
	let score = 0;
	if (pw.length >= 8) score++;
	if (pw.length >= 12) score++;
	if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	const lower = pw.toLowerCase();
	const isRepeatedGroup = /^(.{1,4})\1{1,}$/.test(pw);
	const isAllSameChar = /^(.)\1+$/.test(pw);
	const isSequential =
		/(0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|qwer|asdf|zxcv)/.test(
			lower,
		);
	const isCommon = COMMON_WEAK_PASSWORDS.includes(lower);
	if (isRepeatedGroup || isAllSameChar || isSequential || isCommon) {
		score = Math.max(0, score - 3);
	}
	score = Math.max(0, Math.min(4, score));
	const labels = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
	const colors = ['#ef6a63', '#ef6a63', '#f5a623', '#5b8cff', '#3ddc84'];
	return {
		score,
		label: labels[score],
		color: colors[score],
		percent: (score / 4) * 100,
	};
}

function updatePasswordStrengthUI() {
	const wrap = document.getElementById('pwStrength');
	const bar = document.getElementById('pwStrengthBar');
	const label = document.getElementById('pwStrengthLabel');
	const pw = document.getElementById('authPassword').value;
	if (authMode !== 'signup' || !pw) {
		wrap.classList.add('hidden');
		return;
	}
	wrap.classList.remove('hidden');
	const result = scorePassword(pw);
	bar.style.width = result.percent + '%';
	bar.style.background = result.color;
	label.textContent = result.label;
	label.style.color = result.color;
}

function setAuthMode(mode) {
	authMode = mode;
	document.querySelectorAll('.auth-tab').forEach((tab) => {
		tab.classList.toggle('active', tab.dataset.mode === mode);
	});
	document.getElementById('authSubmitBtn').textContent =
		mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
	document.getElementById('authPassword').autocomplete =
		mode === 'login' ? 'current-password' : 'new-password';
	document.getElementById('authError').textContent = '';
	document.getElementById('authInfo').textContent = '';
	document.getElementById('authSubtitle').textContent =
		mode === 'login'
			? 'Kelimelerini takip etmeye devam etmek için giriş yap.'
			: 'Ücretsiz bir hesap oluştur, taramalarını birkaç dakika içinde kur.';
	updatePasswordStrengthUI();
}

async function handleAuthSubmit(e) {
	e.preventDefault();
	const errorEl = document.getElementById('authError');
	const infoEl = document.getElementById('authInfo');
	const submitBtn = document.getElementById('authSubmitBtn');
	errorEl.textContent = '';
	infoEl.textContent = '';

	const email = document.getElementById('authEmail').value.trim();
	const password = document.getElementById('authPassword').value;

	if (!email) {
		errorEl.textContent = 'Email adresi gerekli.';
		return;
	}
	if (!EMAIL_RE.test(email)) {
		errorEl.textContent = 'Geçerli bir email adresi gir.';
		return;
	}
	if (!password) {
		errorEl.textContent = 'Şifre gerekli.';
		return;
	}
	if (authMode === 'signup' && password.length < 8) {
		errorEl.textContent = 'Şifre en az 8 karakter olmalı.';
		return;
	}

	submitBtn.disabled = true;
	submitBtn.textContent =
		authMode === 'login' ? 'Giriş yapılıyor…' : 'Kayıt olunuyor…';

	try {
		if (authMode === 'login') {
			const { error } = await sb.auth.signInWithPassword({ email, password });
			if (error) {
				errorEl.textContent = translateAuthError(error.message);
				return;
			}
		} else {
			const { data, error } = await sb.auth.signUp({
				email,
				password,
				options: { emailRedirectTo: AUTH_REDIRECT_URL },
			});
			if (error) {
				errorEl.textContent = translateAuthError(error.message);
				return;
			}
			if (data.user && !data.session) {
				showVerifyPendingScreen(email);
			}
		}
	} catch (err) {
		console.error(err);
		errorEl.textContent = 'Beklenmeyen bir hata oluştu, tekrar dene.';
	} finally {
		submitBtn.disabled = false;
		submitBtn.textContent = authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
	}
}

async function handleLogout() {
	await sb.auth.signOut();
}

// ---------- Activity Feed ----------

async function loadRuns() {
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

function escapeHtml(str) {
	if (str === null || str === undefined) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// ---------- Kelime Modalı ----------

async function openKeywordModal() {
	document.getElementById('modalOverlay').classList.add('open');
	document.getElementById('saveStatus').textContent = '';
	document.getElementById('bulkAddStatus').textContent = '';
	document.getElementById('bulkKeywordInput').value = '';

	// RLS sayesinde sadece kullanıcının kendi kelimeleri gelir
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
		keywordWorkingList.map((k) => k.keyword.toLowerCase()),
	);
	let added = 0,
		skipped = 0;

	candidates.forEach((kw) => {
		const lower = kw.toLowerCase();
		if (existingLower.has(lower)) {
			skipped++;
			return;
		}
		keywordWorkingList.push({ id: null, keyword: kw, active: true });
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
	if (!currentUser) return;
	const status = document.getElementById('saveStatus');
	status.textContent = 'Kaydediliyor…';

	// RLS: sadece kendi ID'li keywords gelir
	const { data: originalRows } = await sb.from('keywords').select('id');
	const originalIds = new Set((originalRows || []).map((r) => r.id));
	const keptIds = new Set(
		keywordWorkingList.filter((k) => k.id).map((k) => k.id),
	);
	const toDelete = [...originalIds].filter((id) => !keptIds.has(id));
	const toInsert = keywordWorkingList.filter((k) => !k.id);
	const toUpdate = keywordWorkingList.filter((k) => k.id);

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
					user_id: currentUser.id, // ← kullanıcı izolasyonu için şart
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

// ---------- Ayarlar Modalı ----------

const SETTINGS_KEY = 'scan_interval_minutes';

async function openSettingsModal() {
	document.getElementById('settingsModalOverlay').classList.add('open');
	document.getElementById('settingsSaveStatus').textContent = '';
	if (!currentUser) return;

	// Serper key yükle
	try {
		const { data: profile } = await sb
			.from('profiles')
			.select('serper_api_key')
			.eq('id', currentUser.id)
			.single();
		if (profile?.serper_api_key) {
			document.getElementById('serperKeyInput').value = profile.serper_api_key;
		}
	} catch {
		/* profil henüz yok */
	}

	// Tarama sıklığı yükle (RLS filtreli)
	const { data } = await sb
		.from('settings')
		.select('value')
		.eq('key', SETTINGS_KEY)
		.limit(1);
	if (data?.length) {
		document.getElementById('intervalSelect').value = data[0].value;
	}
}

async function saveSettings() {
	if (!currentUser) return;
	const status = document.getElementById('settingsSaveStatus');
	status.textContent = 'Kaydediliyor…';
	const value = document.getElementById('intervalSelect').value;
	const serperKey = document.getElementById('serperKeyInput').value.trim();

	try {
		// Tarama sıklığı — (user_id, key) çifti unique
		const { error: settingsErr } = await sb
			.from('settings')
			.upsert(
				{ user_id: currentUser.id, key: SETTINGS_KEY, value },
				{ onConflict: 'user_id,key' },
			);
		if (settingsErr) throw settingsErr;

		// Serper API key — profiles tablosu
		const { error: profileErr } = await sb
			.from('profiles')
			.upsert(
				{ id: currentUser.id, serper_api_key: serperKey },
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

// ---------- Olay bağlamaları ----------

// Feed
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

// Kelime modalı
document
	.getElementById('editKeywordsBtn')
	.addEventListener('click', openKeywordModal);
document.getElementById('closeModalBtn').addEventListener('click', () => {
	document.getElementById('modalOverlay').classList.remove('open');
});
document
	.getElementById('addKeywordBtn')
	.addEventListener('click', addKeywordsFromTextarea);
document.getElementById('bulkKeywordInput').addEventListener('keydown', (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addKeywordsFromTextarea();
});
document
	.getElementById('saveKeywordsBtn')
	.addEventListener('click', saveKeywords);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
	if (e.target.id === 'modalOverlay') e.target.classList.remove('open');
});

// Ayarlar modalı
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

// Serper banner
document
	.getElementById('serperBannerBtn')
	.addEventListener('click', openSettingsModal);

// Profil dropdown
document
	.getElementById('profileAvatarBtn')
	.addEventListener('click', toggleProfileDropdown);
document
	.getElementById('themeToggleBtn')
	.addEventListener('click', toggleTheme);
document.getElementById('logoutBtn').addEventListener('click', handleLogout);

// Auth form
document.querySelectorAll('.auth-tab').forEach((tab) => {
	tab.addEventListener('click', () => setAuthMode(tab.dataset.mode));
});
document
	.getElementById('authForm')
	.addEventListener('submit', handleAuthSubmit);
document
	.getElementById('googleAuthBtn')
	.addEventListener('click', handleGoogleAuth);
document
	.getElementById('authPassword')
	.addEventListener('input', updatePasswordStrengthUI);
document.getElementById('passwordToggleBtn').addEventListener('click', () => {
	const input = document.getElementById('authPassword');
	input.type = input.type === 'password' ? 'text' : 'password';
});
document
	.getElementById('resendVerificationBtn')
	.addEventListener('click', resendVerificationEmail);
document.getElementById('backToLoginBtn').addEventListener('click', () => {
	document.getElementById('authForm').reset();
	setAuthMode('login');
	showAuthView('form');
});
document.getElementById('continueToAppBtn').addEventListener('click', showApp);

// ---------- Tema başlat ----------
initTheme();

// ---------- Oturum kontrolü ----------

let handledInitialSession = false;

sb.auth.onAuthStateChange((event, session) => {
	if (session) {
		currentUser = session.user;
		if (!handledInitialSession && cameFromEmailConfirmation) {
			handledInitialSession = true;
			history.replaceState(null, '', window.location.pathname);
			showVerifiedThenEnterApp();
			return;
		}
		handledInitialSession = true;
		showApp();
	} else {
		currentUser = null;
		handledInitialSession = true;
		appInitialized = false;
		allRuns = [];
		selectedRunId = null;
		showAuthGate();
	}
});
