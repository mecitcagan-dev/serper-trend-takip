function closeToolsMenu() {
	const menu = document.getElementById('toolsMenu');
	const toggle = document.getElementById('toolsMenuBtn');
	menu?.classList.add('hidden');
	toggle?.setAttribute('aria-expanded', 'false');
}

export function init() {
	const wrap = document.getElementById('toolsMenuWrap');
	const toggle = document.getElementById('toolsMenuBtn');
	const menu = document.getElementById('toolsMenu');
	if (!wrap || !toggle || !menu) return;

	toggle.addEventListener('click', (event) => {
		event.stopPropagation();
		const isOpen = menu.classList.toggle('hidden') === false;
		toggle.setAttribute('aria-expanded', String(isOpen));
	});

	menu.addEventListener('click', () => {
		closeToolsMenu();
	});

	document.addEventListener('click', (event) => {
		if (!wrap.contains(event.target)) closeToolsMenu();
	});
}
