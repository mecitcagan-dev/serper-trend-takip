import { toggleTheme } from './theme.js';
import { state } from './state.js';

const ROLE_LABELS = {
	admin: 'Yönetici',
	team_member: 'Ekip üyesi',
	client_viewer: 'Müşteri — salt okunur',
};

export function renderProfileAvatar(user) {
	if (!user) return;
	const initialsEl = document.getElementById('profileInitials');
	const imgEl = document.getElementById('profileImg');
	const emailEl = document.getElementById('profileInfoEmail');
	const roleEl = document.getElementById('profileInfoRole');

	const avatarUrl = user.user_metadata?.avatar_url;
	const email = user.email || '';
	const displayName =
		user.user_metadata?.full_name || user.user_metadata?.name || email;

	if (emailEl) emailEl.textContent = email;
	if (roleEl) roleEl.textContent = ROLE_LABELS[state.userRole] || 'Yönetici';
	applyRolePermissions(state.userRole);

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

export function applyRolePermissions(role = 'admin') {
	const readOnly = role === 'client_viewer';
	[
		'settingsBtn',
		'editKeywordsBtn',
		'addProjectBtn',
		'editProjectBtn',
		'geoBtn',
		'serperKeyBtn',
		'intervalToggleBtn',
		'projectCreateCard',
	].forEach((id) =>
		document.getElementById(id)?.classList.toggle('hidden', readOnly),
	);
	const roleEl = document.getElementById('profileInfoRole');
	if (roleEl) roleEl.textContent = ROLE_LABELS[role] || 'Yönetici';
}

function toggleProfileDropdown(e) {
	if (e) e.stopPropagation();
	const dropdown = document.getElementById('profileDropdown');
	if (dropdown) dropdown.classList.toggle('hidden');
}

export function init(onLogout) {
	document
		.getElementById('profileAvatarBtn')
		.addEventListener('click', toggleProfileDropdown);

	// Dropdown dışına tıklanınca kapat
	document.addEventListener('click', (e) => {
		const wrap = document.getElementById('profileWrap');
		if (wrap && !wrap.contains(e.target)) {
			document.getElementById('profileDropdown')?.classList.add('hidden');
		}
	});

	document
		.getElementById('themeToggleBtn')
		.addEventListener('click', toggleTheme);
	document.getElementById('logoutBtn').addEventListener('click', onLogout);
}
