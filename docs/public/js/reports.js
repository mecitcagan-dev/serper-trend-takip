import { sb } from './supabaseClient.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';

let reportRows = [];

function toDateInputValue(date) {
	return date.toISOString().slice(0, 10);
}

function localBoundary(dateValue, endOfDay = false) {
	const date = new Date(`${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
	return date.toISOString();
}

function setStatus(message, isError = false) {
	const element = document.getElementById('reportStatus');
	if (!element) return;
	element.textContent = message;
	element.classList.toggle('error', isError);
}

function detailRows(runs) {
	const rows = [];
	for (const run of runs) {
		const details = run.details || {};
		const entries = Object.entries(details);
		if (!entries.length) {
			rows.push({
				date: run.run_time,
				keyword: '',
				event: run.event_type,
				targetDomain: '',
				currentPosition: '',
				previousPosition: '',
				direction: '',
				newDomains: '',
				removedDomains: '',
				newQuestions: '',
				summary: run.summary,
			});
			continue;
		}
		for (const [keyword, detail] of entries) {
			if (!detail || detail.error) {
				rows.push({
					date: run.run_time,
					keyword,
					event: run.event_type,
					targetDomain: detail?.target_domain || '',
					currentPosition: '',
					previousPosition: '',
					direction: detail?.error ? `Hata: ${detail.error}` : '',
					newDomains: '',
					removedDomains: '',
					newQuestions: '',
					summary: run.summary,
				});
				continue;
			}
			rows.push({
				date: run.run_time,
				keyword,
				event: run.event_type,
				targetDomain: detail.target_domain || '',
				currentPosition: detail.target_position || 'İlk 10 dışında',
				previousPosition: detail.previous_target_position || 'İlk 10 dışında',
				direction: detail.target_direction || '',
				newDomains: (detail.new_domains || []).join(' | '),
				removedDomains: (detail.removed_domains || []).join(' | '),
				newQuestions: [...(detail.new_paa || []), ...(detail.new_related || [])].join(' | '),
				summary: run.summary,
			});
		}
	}
	return rows;
}

function directionLabel(value) {
	return (
		{
			improved: 'Yükseldi',
			declined: 'Geriledi',
			entered: 'İlk 10’a girdi',
			left: 'İlk 10’dan çıktı',
			unchanged: 'Değişmedi',
			baseline: 'İlk ölçüm',
			not_in_top_10: 'İlk 10 dışında',
		}[value] || value
	);
}

function renderReport(runs) {
	const wrap = document.getElementById('reportTableWrap');
	const summary = document.getElementById('reportSummary');
	reportRows = detailRows(runs);
	const changedRows = reportRows.filter(
		(row) => row.direction && !['unchanged', 'baseline', 'not_in_top_10'].includes(row.direction),
	);
	const newCompetitors = reportRows.filter((row) => row.newDomains).length;
	const newQuestions = reportRows.filter((row) => row.newQuestions).length;

	summary.innerHTML = `
    <div><strong>${runs.length}</strong><span>Tarama</span></div>
    <div><strong>${changedRows.length}</strong><span>Hareketli kelime</span></div>
    <div><strong>${newCompetitors}</strong><span>Rakip fırsatı</span></div>
    <div><strong>${newQuestions}</strong><span>Soru/fırsat</span></div>
  `;

	if (!reportRows.length) {
		wrap.innerHTML = '<p class="detail-muted">Bu tarih aralığında kayıt yok.</p>';
		return;
	}

	wrap.innerHTML = `
    <table class="report-table">
      <thead><tr>
        <th>Tarih</th><th>Kelime</th><th>Hedef sıra</th><th>Yön</th><th>Yeni rakip / soru</th>
      </tr></thead>
      <tbody>${reportRows
			.map(
				(row) => `
        <tr>
          <td>${escapeHtml(new Date(row.date).toLocaleDateString('tr-TR'))}</td>
          <td>${escapeHtml(row.keyword || 'Genel')}</td>
          <td>${escapeHtml(String(row.currentPosition || '—'))}</td>
          <td>${escapeHtml(directionLabel(row.direction) || '—')}</td>
          <td>${escapeHtml(row.newDomains || row.newQuestions || '—')}</td>
        </tr>`,
			)
			.join('')}</tbody>
    </table>`;
}

async function loadReport() {
	if (!state.currentProject) {
		setStatus('Önce bir proje oluştur veya seç.', true);
		return;
	}
	const start = document.getElementById('reportStartDate').value;
	const end = document.getElementById('reportEndDate').value;
	if (!start || !end || start > end) {
		setStatus('Geçerli bir tarih aralığı seç.', true);
		return;
	}

	setStatus('Rapor hazırlanıyor…');
	const { data, error } = await sb
		.from('runs')
		.select('run_time, event_type, summary, details')
		.eq('project_id', state.currentProject.id)
		.gte('run_time', localBoundary(start))
		.lte('run_time', localBoundary(end, true))
		.order('run_time', { ascending: false });
	if (error) {
		console.error(error);
		setStatus('Rapor verisi yüklenemedi.', true);
		return;
	}

	renderReport(data || []);
	setStatus(`${data?.length || 0} tarama rapora alındı.`);
}

function csvCell(value) {
	return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadReport() {
	if (!reportRows.length) {
		setStatus('Önce raporu getir.', true);
		return;
	}
	const headers = [
		'Tarih',
		'Kelime',
		'Etkinlik',
		'Hedef domain',
		'Mevcut sıra',
		'Önceki sıra',
		'Yön',
		'Yeni rakipler',
		'Yeni sorular',
		'Özet',
	];
	const lines = [headers.map(csvCell).join(',')];
	for (const row of reportRows) {
		lines.push(
			[
				new Date(row.date).toLocaleString('tr-TR'),
				row.keyword,
				row.event,
				row.targetDomain,
				row.currentPosition,
				row.previousPosition,
				directionLabel(row.direction),
				row.newDomains,
				row.newQuestions,
				row.summary,
			]
				.map(csvCell)
				.join(','),
		);
	}
	const blob = new Blob([`\ufeff${lines.join('\n')}`], {
		type: 'text/csv;charset=utf-8',
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${state.currentProject.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-rapor.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

function openReport() {
	document.getElementById('reportModalOverlay').classList.add('open');
	const today = new Date();
	const monthAgo = new Date(today);
	monthAgo.setDate(today.getDate() - 30);
	document.getElementById('reportStartDate').value = toDateInputValue(monthAgo);
	document.getElementById('reportEndDate').value = toDateInputValue(today);
	loadReport();
}

function closeReport() {
	document.getElementById('reportModalOverlay').classList.remove('open');
}

export function init() {
	document.getElementById('reportBtn').addEventListener('click', openReport);
	document.getElementById('closeReportModalBtn').addEventListener('click', closeReport);
	document.getElementById('loadReportBtn').addEventListener('click', loadReport);
	document.getElementById('downloadReportBtn').addEventListener('click', downloadReport);
	document.getElementById('printReportBtn').addEventListener('click', () => window.print());
	document.getElementById('reportModalOverlay').addEventListener('click', (event) => {
		if (event.target.id === 'reportModalOverlay') closeReport();
	});
}

