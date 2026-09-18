// Modüller arasında paylaşılan uygulama durumu.
// Tek bir obje üzerinden mutasyon yapılır ki tüm modüller aynı referansı görsün.

export const state = {
	currentUser: null,
	userRole: 'admin',
	projects: [],
	currentProject: null,
	allRuns: [],
	currentFilter: 'all',
	selectedRunId: null,
	keywordWorkingList: [],
	appInitialized: false,
};
