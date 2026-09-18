// Küçük, bağımsız yardımcı fonksiyonlar. Başka hiçbir modüle bağımlı değildir.

export function escapeHtml(str) {
	if (str === null || str === undefined) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function dayLabel(dateStr) {
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

export function timeLabel(dateStr) {
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
