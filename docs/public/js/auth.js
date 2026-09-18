import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { checkSerperKey } from './serperKey.js';
import { renderProfileAvatar } from './profileMenu.js';
import { loadRuns, subscribeToRuns, unsubscribeFromRuns } from './feed.js';

let authMode = 'login';
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
	renderProfileAvatar(state.currentUser);
	subscribeToRuns(state.currentUser.id); // ← eklendi: F5'siz otomatik güncelleme
	if (!state.appInitialized) {
		state.appInitialized = true;
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

export async function handleLogout() {
	await sb.auth.signOut();
}

export function init() {
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
	document
		.getElementById('continueToAppBtn')
		.addEventListener('click', showApp);

	// ---------- Oturum kontrolü ----------
	let handledInitialSession = false;

	sb.auth.onAuthStateChange((event, session) => {
		if (session) {
			state.currentUser = session.user;
			if (!handledInitialSession && cameFromEmailConfirmation) {
				handledInitialSession = true;
				history.replaceState(null, '', window.location.pathname);
				showVerifiedThenEnterApp();
				return;
			}
			handledInitialSession = true;
			showApp();
		} else {
			state.currentUser = null;
			handledInitialSession = true;
			state.appInitialized = false;
			state.allRuns = [];
			state.selectedRunId = null;
			unsubscribeFromRuns(); // ← eklendi: eski kanal/filtre temizlenir
			showAuthGate();
		}
	});
}
