// Karanlık / aydınlık tema yönetimi. localStorage'da 'stt-theme' anahtarıyla saklanır.

export function initTheme() {
	const saved = localStorage.getItem('stt-theme') || 'dark';
	applyTheme(saved, false);
}

export function applyTheme(theme, animate = true) {
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem('stt-theme', theme);
	const icon = document.getElementById('themeIcon');
	const label = document.getElementById('themeLabel');
	if (icon) {
		icon.innerHTML =
			theme === 'dark'
				? '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="3.2" stroke="currentColor" stroke-width="1.4"/><path d="M10 2.3v2M10 15.7v2M2.3 10h2M15.7 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6 14 6M6 14l-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
				: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M15.9 12.9A6.4 6.4 0 0 1 7.1 4.1 6.5 6.5 0 1 0 15.9 12.9Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
	}
	if (label) label.textContent = theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod';
}

export function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme') || 'dark';
	applyTheme(current === 'dark' ? 'light' : 'dark');
}
