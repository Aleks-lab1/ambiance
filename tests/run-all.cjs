// Lance tous les tests (fichiers *.test.cjs / *.test.mjs), dossier par dossier.
//   node run-all.cjs            → tout
//   node run-all.cjs online     → seulement tests/online/
// Les fichiers *.manual.cjs (vrais serveurs, Internet) ne sont pas lancés ici.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['unit', 'online', 'local', 'relay'];
const results = [];
for (const d of dirs) {
  for (const f of fs.readdirSync(path.join(__dirname, d)).filter((x) => /\.test\.(c|m)?js$/.test(x)).sort()) {
    const rel = path.join(d, f);
    console.log(`\n━━ ${rel}`);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [path.join(__dirname, rel)], { stdio: 'inherit', cwd: __dirname, timeout: 300000 });
    results.push({ rel, ok: r.status === 0, s: ((Date.now() - t0) / 1000).toFixed(0) });
  }
}
console.log('\n━━ Résumé');
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.rel} (${r.s} s)`);
const ko = results.filter((r) => !r.ok).length;
console.log(ko ? `\n${ko} fichier(s) en échec` : `\nTout est vert (${results.length} fichiers)`);
process.exit(ko ? 1 : 0);
