import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { loadProjectDashboard } from './dashboard.js';

const SETTINGS_KEY = 'scan_interval_minutes';
const DEFAULT_INTERVAL = '360';

const INTERVAL_OPTIONS = [
	{ value: '1', short: '1M', label: '1 dakika', hint: 'test' },
	{ value: '5', short: '5M', label: '5 dakika', hint: 'test' },
	{ value: '10', short: '10M', label: '10 dakika', hint: 'test' },
	{ value: '30', short: '30M', label: '30 dakika' },
	{ value: '60', short: '1H', label: '1 saat' },
	{ value: '120', short: '2H', label: '2 saat' },
	{ value: '360', short: '6H', label: '6 saat', hint: 'önerilen' },
	{ value: '720', short: '12H', label: '12 saat' },
	{ value: '1440', short: '24H', label: '24 saat' },
];

let selectedValue = DEFAULT_INTERVAL;

function getOption(value) {
	return INTERVAL_OPTIONS.find((option) => option.value === String(value)) || INTERVAL_OPTIONS.find((option) => option.value === DEFAULT_INTERVAL);
}

function setMenuOpen(isOpen) {
	const wrap = document.getElementById('intervalWrap');
	const menu = document.getElementById('intervalMenu');
	const toggle = document.getElementById('intervalToggleBtn');
	if (!wrap || !menu || !toggle) return;
	wrap.classList.toggle('open', isOpen);
	menu.classList.toggle('hidden', !isOpen);
	toggle.setAttribute('aria-expanded', String(isOpen));
}

function renderIntervalControl(value = selectedValue) {
	selectedValue = String(value);
	const option = getOption(selectedValue);
	const label = document.getElementById('intervalLabel');
	const menu = document.getElementById('intervalMenu');
	if (label) label.textContent = option.short;
	if (!menu) return;

	menu.innerHTML = INTERVAL_OPTIONS.map(
		(item) => `
			<button class="interval-option${item.value === option.value ? ' active' : ''}" type="button" role="menuitemradio" aria-checked="${item.value === option.value}" data-interval-value="${item.value}">
				<strong>${item.short}</strong>
				<span>${item.label}${item.hint ? ` · ${item.hint}` : ''}</span>
			</button>
		`,
	).join('');
}

async function saveInterval(value) {
	if (!state.currentUser) return;
	const { error } = await sb
		.from('settings')
		.upsert(
			{ user_id: state.currentUser.id, key: SETTINGS_KEY, value: String(value) },
			{ onConflict: 'user_id,key' },
		);
	if (error) {
		console.error(error);
		return;
	}
	await loadProjectDashboard();
}

export async function loadInterval() {
	if (!state.currentUser) return;
	const { data, error } = await sb
		.from('settings')
		.select('value')
		.eq('key', SETTINGS_KEY)
		.limit(1);
	if (error) {
		console.error(error);
		renderIntervalControl(DEFAULT_INTERVAL);
		return;
	}
	renderIntervalControl(data?.[0]?.value || DEFAULT_INTERVAL);
}

export function init() {
	renderIntervalControl(DEFAULT_INTERVAL);
	const toggle = document.getElementById('intervalToggleBtn');
	const menu = document.getElementById('intervalMenu');
	if (!toggle || !menu) return;

	toggle.addEventListener('click', (event) => {
		event.stopPropagation();
		setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
	});
	menu.addEventListener('click', async (event) => {
		const option = event.target.closest('[data-interval-value]');
		if (!option) return;
		const value = option.dataset.intervalValue;
		setMenuOpen(false);
		renderIntervalControl(value);
		await saveInterval(value);
	});
	document.addEventListener('click', (event) => {
		const wrap = document.getElementById('intervalWrap');
		if (wrap && !wrap.contains(event.target)) setMenuOpen(false);
	});
}
