// Listes à remettre dans l'ordre en glissant (js/sortable.js) : de vrais glisser-déposer à la souris.
//   const ordre = await sortByDrag(page, page.locator('#v-A'), [2, 0, 3, 1]);
//   → l'élément n°2 (dans l'ordre des données) se retrouve en haut, puis le 0, etc. Renvoie l'ordre obtenu.

/** Ordre affiché : indices des éléments, de haut en bas. */
const shownOrder = (scope) => scope.locator('.sort-item').evaluateAll((els) => els.map((e) => Number(e.dataset.i)));

/** Glisse la carte n° from (position affichée) jusqu'à la position to. */
async function dragTo(page, scope, from, to) {
  const items = scope.locator('.sort-item');
  const a = await items.nth(from).boundingBox(), b = await items.nth(to).boundingBox();
  const x = a.x + a.width / 2, y0 = a.y + a.height / 2;
  const y1 = to < from ? b.y + b.height * 0.2 : b.y + b.height * 0.8; // un peu au-delà du milieu de la carte visée
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let s = 1; s <= 10; s++) { await page.mouse.move(x, y0 + ((y1 - y0) * s) / 10); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(280);
}

async function sortByDrag(page, scope, want) {
  for (let k = 0; k < want.length; k++) {
    const cur = await shownOrder(scope);
    const j = cur.indexOf(want[k]);
    if (j !== k) await dragTo(page, scope, j, k);
  }
  return shownOrder(scope);
}

module.exports = { sortByDrag, dragTo, shownOrder };
