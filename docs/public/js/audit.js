import { sb } from './supabaseClient.js';
import { state } from './state.js';

// Audit yazımı kullanıcı akışını bloklamaz; tablo migrationı yoksa uygulama
// yine kullanılabilir, sadece konsola uyarı bırakılır.
export function logAudit(action, metadata = {}, projectId = state.currentProject?.id) {
	if (!state.currentUser) return;
	sb.from('audit_logs')
		.insert({
			user_id: state.currentUser.id,
			project_id: projectId || null,
			action,
			metadata,
		})
		.then(({ error }) => {
			if (error) console.warn('Audit kaydı yazılamadı:', error.message);
		});
}

