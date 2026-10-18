// Food rows: [name, kcal/100g, protein/100g, fiber/100g, serving grams, serving label, isStaple]
// Source: USDA ARS National Nutrient Database for Standard Reference (SR Legacy), public domain.

export function prepare(rows) {
  rows.forEach((r, i) => { r.lc = r[0].toLowerCase(); r.ix = i; });
  return rows;
}

export function lookup(rows, q, limit = 6) {
  const t = String(q).toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean);
  if (!t.length) return [];
  return rows.filter(r => t.every(w => r.lc.includes(w)))
    .map(r => [r, (r[6] ? -200 : 0) + (r.lc.startsWith(t[0]) ? 0 : 60) + r[0].length])
    .sort((a, b) => a[1] - b[1]).slice(0, limit)
    .map(([r]) => ({ name: r[0], kcal_per_100g: r[1], protein_g_per_100g: r[2], fiber_g_per_100g: r[3], typical_serving: `${r[5]} (${r[4]} g)` }));
}

/* Free matcher: turns "2 eggs, 1 cup greek yogurt" into USDA matches without AI */
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: .5, '½': .5, '¼': .25, '¾': .75 };
const UNIT = { g: 'g', gram: 'g', grams: 'g', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', cup: 'cup', cups: 'cup', c: 'cup', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  slice: 'slice', slices: 'slice', piece: 'piece', pieces: 'piece', scoop: 'scoop', scoops: 'scoop', large: 'each', medium: 'each', small: 'each', container: 'each', fruit: 'each' };
const COOK = new Set(['cooked', 'steamed', 'grilled', 'roasted', 'baked', 'boiled', 'raw', 'fried', 'sauteed', 'sautéed', 'fresh', 'plain', 'scrambled', 'chopped', 'sliced']);
const STOP = new Set(['of', 'some', 'the', 'my', 'fresh', 'homemade', 'plain', 'bowl', 'plate', 'glass', 'serving', 'servings', 'side']);
const ALIAS = { toast: ['bread'], oatmeal: ['oats'], coffee: ['coffee', 'brewed'], yoghurt: ['yogurt'], pb: ['peanut', 'butter'], oj: ['orange', 'juice'], shake: ['whey'], whey: ['whey'] };

function num(w) { if (w === undefined) return null; if (NUMW[w] !== undefined) return NUMW[w]; if (/^\d+(\.\d+)?$/.test(w)) return parseFloat(w); if (/^\d+\/\d+$/.test(w)) { const [a, b] = w.split('/'); return a / b; } return null; }
function serving(r) { const m = String(r[5]).toLowerCase().match(/^([\d.\/½¼¾]+)\s*([a-z]+)?/); let n = 1, u = ''; if (m) { n = num(m[1]) || 1; u = m[2] || ''; } return { n, u: UNIT[u] || u, g: r[4] }; }
function gramsFor(r, q, unit) {
  const s = serving(r), per = s.g / s.n, VOL = { cup: 48, tbsp: 3, tsp: 1 }, WT = { oz: 1, g: 1, lb: 1 };
  if (unit === 'g') return q; if (unit === 'oz') return q * 28.35; if (unit === 'lb') return q * 453.6;
  if (!unit || unit === 'each') return q * (VOL[s.u] || WT[s.u] ? s.g : per);
  if (unit === s.u) return q * per; if (VOL[unit] && VOL[s.u]) return q * per * VOL[unit] / VOL[s.u];
  if (['slice', 'piece', 'scoop'].includes(unit)) return q * per; return null;
}
function findFood(rows, words, strict = false) {
  const has = (s, w) => s.includes(w) || (w.length > 3 && s.includes(w.replace(/ies$/, 'y').replace(/(?<!s)s$/, '')));
  const hit = t => {
    if (!t.length) return null; const c = rows.filter(r => t.every(w => has(r.lc, w))); if (!c.length) return null;
    return c.map(r => { const extra = r.lc.split(/[^a-z0-9]+/).filter(w => w && !t.some(k => has(w, k))).length;
      return [r, (r[6] ? -200 : 0) + (r.lc.startsWith(t[0]) ? 0 : 40) + extra * 8 + r[0].length / 4 + (/raw|cooked|roasted|boiled|baked|brewed/.test(r.lc) ? -6 : 0)]; })
      .sort((a, b) => a[1] - b[1]).slice(0, 25).map(x => x[0]);
  };
  const tries = strict ? [words] : [words, ...words.map((_, i) => words.filter((__, j) => j !== i)), words.slice(-1)];
  for (const t of tries) { const r = hit(t); if (r) return r; } return null;
}
// strict: every word must match (used to double-check AI estimates).
export function parseMeal(rows, text, strict = false) {
  const parts = String(text).toLowerCase().replace(/[()]/g, ' ').split(/,|\n|;|\+|&|\band\b|\bwith\b/).map(x => x.trim()).filter(Boolean);
  const matched = [], missed = [];
  parts.forEach(part => {
    const w = part.replace(/(\d)([a-z])/g, '$1 $2').split(/\s+/).filter(Boolean); let q = num(w[0]); let i = q === null ? 0 : 1; if (q === null) q = 1;
    const q2 = num(w[i]); if (i === 1 && q2 !== null && q2 < 1) { q += q2; i++; }
    const unit = UNIT[w[i]]; if (unit) i++; if (w[i] === 'of') i++;
    const words = w.slice(i).filter(x => !STOP.has(x) && !(strict && COOK.has(x))).flatMap(x => ALIAS[x] || [x]).map(x => x.replace(/[^a-z0-9%-]/g, '')).filter(Boolean);
    if (!words.length) { missed.push(part); return; }
    const cands = findFood(rows, words, strict); if (!cands) { missed.push(part); return; }
    let r = null, g = null; for (const c of cands) { const x = gramsFor(c, q, unit); if (x !== null && x > 0) { r = c; g = x; break; } }
    if (!r && ({ cup: 240, tbsp: 15, tsp: 5 })[unit]) { r = cands[0]; g = q * ({ cup: 240, tbsp: 15, tsp: 5 })[unit]; }
    if (!r || !(g > 0) || g > 3000) { missed.push(part); return; }
    matched.push({ name: r[0], amount: part, protein: r[2] * g / 100, fiber: r[3] * g / 100, source: 'usda', grams: g });
  });
  return { matched, missed };
}
