// Uygulamanın tek giriş noktası. index.html bu dosyayı
// <script type="module" src="js/main.js"></script> olarak yükler.
// Her modül kendi DOM olaylarını kendi init()'i içinde bağlar.

import { initTheme } from './theme.js';
import * as profileMenu from './profileMenu.js';
import * as feed from './feed.js';
import * as keywordsModal from './keywordsModal.js';
import * as settingsModal from './settingsModal.js';
import * as projects from './projects.js';
import * as dashboard from './dashboard.js';
import * as auth from './auth.js';

initTheme();
profileMenu.init(auth.handleLogout);
feed.init();
keywordsModal.init();
settingsModal.init();
projects.init(async () => {
	await feed.loadRuns();
	await dashboard.loadProjectDashboard();
});
auth.init(); // en son — oturum dinleyicisi diğer her şeyin hazır olmasını gerektirir
