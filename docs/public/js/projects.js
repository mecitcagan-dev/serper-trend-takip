import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { logAudit } from './audit.js';

let onProjectChange = () => {};
let editingProjectId = null;

function setProjectStatus(message, isError = false) {
	const status = document.getElementById('projectStatus');
	if (!status) return;
	status.textContent = message;
	status.classList.toggle('error', isError);
}

function setProjectPickerOpen(isOpen) {
	const wrap = document.getElementById('projectSelectWrap');
	const menu = document.getElementById('projectSelectMenu');
	const trigger = document.getElementById('projectSelectTrigger');
	if (!wrap || !menu || !trigger) return;
	wrap.classList.toggle('open', isOpen);
	menu.classList.toggle('hidden', !isOpen);
	trigger.setAttribute('aria-expanded', String(isOpen));
}

function renderProjectPicker() {
	const trigger = document.getElementById('projectSelectTrigger');
	const label = document.getElementById('projectSelectLabel');
	const menu = document.getElementById('projectSelectMenu');
	const meta = document.getElementById('projectMeta');
	if (!trigger || !label || !menu) return;

	menu.innerHTML = state.projects
		.map(
			(project) =>
				`<button class="project-select-option" type="button" role="option" data-project-id="${project.id}" aria-selected="${String(project.id) === String(state.currentProject?.id)}"><span class="project-option-name">${escapeHtml(project.name)}</span>${
					project.client_name ? ` — ${escapeHtml(project.client_name)}` : ''
				}</button>`,
		)
		.join('');

	if (state.currentProject) {
		label.textContent = state.currentProject.client_name
			? `${state.currentProject.name} — ${state.currentProject.client_name}`
			: state.currentProject.name;
		if (meta) {
			const target = state.currentProject.target_domain
				? `Hedef: ${state.currentProject.target_domain}`
				: 'Hedef domain yok';
			const country = (state.currentProject.country_code || 'tr').toUpperCase();
			const language = (state.currentProject.language_code || 'tr').toUpperCase();
			const device = state.currentProject.device === 'mobile' ? 'Mobil' : 'Masaüstü';
			const market = `${country} / ${language} · ${device}`;
			meta.textContent = `${target} · ${market}`;
		}
	} else {
		menu.innerHTML = '<div class="project-select-empty">Proje bulunamadı</div>';
		label.textContent = 'Proje bulunamadı';
		if (meta) meta.textContent = 'Önce bir proje oluştur.';
	}

	trigger.disabled = !state.projects.length;
	setProjectPickerOpen(false);
	const editButton = document.getElementById('editProjectBtn');
	if (editButton) editButton.disabled = !state.currentProject;
}

export async function loadProjects({ notify = true } = {}) {
	if (!state.currentUser) return false;

	const { data, error } = await sb
		.from('projects')
		.select('*')
		.eq('is_active', true)
		.order('created_at', { ascending: true });

	if (error) {
		console.error(error);
		state.projects = [];
		state.currentProject = null;
		renderProjectPicker();
		setProjectStatus(
			'Projeler yüklenemedi. Supabase schema.sql v6 migrationını çalıştır.',
			true,
		);
		return false;
	}

	state.projects = data || [];
	const currentId = state.currentProject?.id;
	state.currentProject =
		state.projects.find((project) => project.id === currentId) ||
		state.projects[0] ||
		null;
	renderProjectPicker();
	setProjectStatus('');

	if (notify && state.currentProject) await onProjectChange(state.currentProject);
	return !!state.currentProject;
}

function openProjectModal(project = null) {
	editingProjectId = project?.id || null;
	document.getElementById('projectModalOverlay')?.classList.add('open');
	const form = document.getElementById('projectForm');
	form?.reset();
	document.getElementById('projectModalTitle').textContent = project
		? 'Projeyi Düzenle'
		: 'Yeni Proje';
	if (project) {
		document.getElementById('projectNameInput').value = project.name || '';
		document.getElementById('projectClientInput').value =
			project.client_name || '';
		document.getElementById('projectDomainInput').value =
			project.target_domain || '';
		document.getElementById('projectCountryInput').value =
			project.country_code || 'tr';
		document.getElementById('projectLanguageInput').value =
			project.language_code || 'tr';
		document.getElementById('projectLocationInput').value =
			project.location || '';
		document.getElementById('projectDeviceInput').value =
			project.device || 'desktop';
	}
	document.getElementById('projectSaveStatus').textContent = '';
}

function closeProjectModal() {
	document.getElementById('projectModalOverlay')?.classList.remove('open');
	editingProjectId = null;
}

async function saveProject(event) {
	event.preventDefault();
	if (!state.currentUser) return;

	const status = document.getElementById('projectSaveStatus');
	const name = document.getElementById('projectNameInput').value.trim();
	const clientName = document
		.getElementById('projectClientInput')
		.value.trim();
	const targetDomain = document
		.getElementById('projectDomainInput')
		.value.trim();
	const countryCode = document
		.getElementById('projectCountryInput')
		.value.trim()
		.toLowerCase();
	const languageCode = document
		.getElementById('projectLanguageInput')
		.value.trim()
		.toLowerCase();
	const location = document.getElementById('projectLocationInput').value.trim();
	const device = document.getElementById('projectDeviceInput').value;

	if (!name) {
		status.textContent = 'Proje adı gerekli.';
		return;
	}

	status.textContent = 'Kaydediliyor…';
	const values = {
		name,
		client_name: clientName,
		target_domain: targetDomain || null,
		country_code: countryCode || 'tr',
		language_code: languageCode || 'tr',
		location: location || null,
		device: device === 'mobile' ? 'mobile' : 'desktop',
	};
	const query = editingProjectId
		? sb
				.from('projects')
				.update(values)
				.eq('id', editingProjectId)
				.eq('user_id', state.currentUser.id)
		: sb.from('projects').insert({
				user_id: state.currentUser.id,
				...values,
		  });
	const { data, error } = await query.select().single();

	if (error) {
		console.error(error);
		status.textContent =
			editingProjectId
				? 'Proje güncellenemedi. Proje adı benzersiz olmalı.'
				: 'Proje kaydedilemedi. Proje adı benzersiz olmalı.';
		return;
	}

	state.currentProject = data;
	logAudit(editingProjectId ? 'project_updated' : 'project_created', {
		project_id: data.id,
	});
	closeProjectModal();
	await loadProjects({ notify: true });
}

async function handleProjectChange(projectId) {
	state.currentProject =
		state.projects.find((project) => String(project.id) === String(projectId)) || null;
	renderProjectPicker();
	if (state.currentProject) await onProjectChange(state.currentProject);
}

export function init(projectChangeHandler) {
	onProjectChange = projectChangeHandler || (() => {});
	const projectTrigger = document.getElementById('projectSelectTrigger');
	const projectMenu = document.getElementById('projectSelectMenu');
	projectTrigger?.addEventListener('click', (event) => {
		event.stopPropagation();
		const isOpen = projectTrigger.getAttribute('aria-expanded') === 'true';
		setProjectPickerOpen(!isOpen);
	});
	projectMenu?.addEventListener('click', (event) => {
		const option = event.target.closest('[data-project-id]');
		if (!option) return;
		setProjectPickerOpen(false);
		handleProjectChange(option.dataset.projectId);
	});
	document.addEventListener('click', (event) => {
		const wrap = document.getElementById('projectSelectWrap');
		if (wrap && !wrap.contains(event.target)) setProjectPickerOpen(false);
	});
	document
		.getElementById('addProjectBtn')
		.addEventListener('click', openProjectModal);
	document.getElementById('editProjectBtn').addEventListener('click', () => {
		if (state.currentProject) openProjectModal(state.currentProject);
	});
	document
		.getElementById('closeProjectModalBtn')
		.addEventListener('click', closeProjectModal);
	document.getElementById('projectForm').addEventListener('submit', saveProject);
	document
		.getElementById('projectModalOverlay')
		.addEventListener('click', (event) => {
			if (event.target.id === 'projectModalOverlay') closeProjectModal();
		});
}
