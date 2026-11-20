// Mini-assertions : on note les échecs, on affiche un résumé et on sort avec le code 1 s'il y en a.
const fails = [];
let count = 0;
function check(cond, msg, extra) {
  count++;
  if (cond) console.log('  ✓ ' + msg);
  else { fails.push(msg); console.log('  ✗ ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 300) : '')); }
}
function done() {
  console.log(fails.length ? `\n${fails.length}/${count} vérification(s) en échec` : `\n${count} vérifications OK`);
  process.exit(fails.length ? 1 : 0);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Lance une fonction de test async ; toute exception = échec. */
function run(fn) {
  fn().then(done, (e) => { console.error(e); fails.push(String(e && e.message)); done(); });
}
module.exports = { check, done, wait, run };
