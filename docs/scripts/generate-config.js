// Bu script, build sırasında SUPABASE_URL / SUPABASE_ANON_KEY ortam
// değişkenlerini okuyup config.js dosyasını (bu script'in bir üst
// klasörüne, yani docs/'un köküne) otomatik üretir.
// - Vercel'de: Project Settings > Environment Variables içine eklediğin
//   değerler build sırasında process.env üzerinden otomatik gelir.
// - Yerelde: docs/.env veya repo kökünde bir .env dosyası oluşturursan
//   (git'e girmez), bu script onu okuyup aynı şekilde config.js üretir.
//
// config.js artık elle doldurulmuyor / repoya commit edilmiyor —
// her build'de burada yeniden üretiliyor.

const fs = require('fs');
const path = require('path');

function loadDotEnvIfPresent() {
	// Hem docs/.env hem de repo kökü/.env konumunu dene.
	const candidates = [
		path.join(__dirname, '..', '.env'), // docs/.env
		path.join(__dirname, '..', '..', '.env'), // repo kökü/.env
	];
	const envPath = candidates.find((p) => fs.existsSync(p));
	if (!envPath) return;

	const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const idx = line.indexOf('=');
		if (idx === -1) continue;

		const key = line.slice(0, idx).trim();
		let value = line.slice(idx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		// Vercel'de zaten set edilmiş bir env varsa .env dosyası onu ezmesin.
		if (!(key in process.env)) process.env[key] = value;
	}
}

loadDotEnvIfPresent();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error(
		'HATA: SUPABASE_URL ve/veya SUPABASE_ANON_KEY tanımlı değil.\n' +
			"  - Yerelde: docs/.env veya repo kökünde bir .env dosyası oluştur (.env.example'a bak).\n" +
			"  - Vercel'de: Project Settings > Environment Variables kısmına ekle.",
	);
	process.exit(1);
}

const output = `// BU DOSYA OTOMATİK ÜRETİLİR — elle düzenleme, değerler .env / Vercel Environment
// Variables üzerinden gelir (bkz. scripts/generate-config.js).
const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
`;

const outPath = path.join(__dirname, '..', 'public', 'config.js');
fs.writeFileSync(outPath, output);
console.log(`✓ config.js üretildi: ${outPath}`);
