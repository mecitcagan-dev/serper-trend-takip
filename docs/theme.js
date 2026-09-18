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
	if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
	if (label) label.textContent = theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod';
}

export function toggleTheme() {
	const current = document.documentElement.getAttribute('data-theme') || 'dark';
	applyTheme(current === 'dark' ? 'light' : 'dark');
}
