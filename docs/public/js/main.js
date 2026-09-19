// Uygulamanın tek giriş noktası. index.html bu dosyayı
// <script type="module" src="js/main.js"></script> olarak yükler.
// Her modül kendi DOM olaylarını kendi init()'i içinde bağlar.

import { initTheme } from './theme.js';
import * as profileMenu from './profileMenu.js';
import * as feed from './feed.js';
import * as keywordsModal from './keywordsModal.js';
import * as projects from './projects.js';
import * as dashboard from './dashboard.js';
import * as toolsMenu from './toolsMenu.js';
import * as apiKeyModal from './apiKeyModal.js';
import * as intervalControl from './intervalControl.js';
import * as reports from './reports.js';
import * as auth from './auth.js';

initTheme();
profileMenu.init(auth.handleLogout);
feed.init();
keywordsModal.init();
dashboard.init();
toolsMenu.init();
apiKeyModal.init();
intervalControl.init();
reports.init();
projects.init(async () => {
	await feed.loadRuns();
	await dashboard.loadProjectDashboard();
});
auth.init(); // en son — oturum dinleyicisi diğer her şeyin hazır olmasını gerektirir
