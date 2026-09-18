function closeSettingsModal() {
	document.getElementById('settingsModalOverlay')?.classList.remove('open');
}

export function openSettingsModal() {
	document.getElementById('settingsModalOverlay')?.classList.add('open');
}

export function init() {
	document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
	document
		.getElementById('closeSettingsModalBtn')
		?.addEventListener('click', closeSettingsModal);
	document.getElementById('settingsModalOverlay')?.addEventListener('click', (event) => {
		if (event.target.id === 'settingsModalOverlay') closeSettingsModal();
	});
}
