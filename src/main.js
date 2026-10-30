import '@fontsource-variable/bricolage-grotesque/wdth.css';
import qrcode from 'qrcode-generator';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';
import FOOD_ROWS from './data/foods.json';
import EX_RAW from './data/exercises.json';
import { prepare, parseMeal } from './shared/foodsearch.js';
import { CAPS, preFilter, PROVIDER_TEXT } from '../supabase/functions/api/guardrails.js';
import * as cloud from './cloud.js';
import { SEED_ARTICLES } from './articles-seed.js';
import { CONCIERGE, NAMES, PACKAGES, VALDURA, MEMBERSHIP, FEATURED, monthly, money } from './config.js';
// App feel on iOS: Safari ignores user-scalable=no, so block pinch and double-tap zoom here too.
if (typeof document !== 'undefined') {
  ['gesturestart', 'gesturechange'].forEach(e => document.addEventListener(e, ev => ev.preventDefault(), { passive: false }));
  let lastTouch = 0;
  document.addEventListener('touchend', ev => { const now = Date.now(); if (now - lastTouch < 300 && !ev.target.closest('input,textarea,select')) ev.preventDefault(); lastTouch = now; }, { passive: false });
}

const { DEMO } = cloud;

/* ---------------- Static content ---------------- */
const ICONS = {
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  protein: '<path d="M7 3h10l-1 4H8z"/><path d="M8 7l-1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2L16 7"/><path d="M9.5 12h5"/>',
  water: '<path d="M12 2.7S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7z"/>',
  move: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  fiber: '<path d="M12 21V9"/><path d="M12 9c0-3 2-5 5-6 0 3-2 5-5 6zM12 13c0-3-2-5-5-6 0 3 2 5 5 6zM12 17c0-3 2-5 5-6 0 3-2 5-5 6z"/>',
  sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  ask: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5"/><path d="M12 16.2h.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  camera: '<path d="M3 8h3.5l2-3h7l2 3H21v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const HABITS = [
  { id: 'protein', name: 'Protein with each meal', goal: 3, unit: 'meals' },
  { id: 'water', name: 'Hydration', goal: 8, unit: 'glasses' },
  { id: 'move', name: 'Strength or movement', goal: 1, unit: 'session' },
  { id: 'fiber', name: 'Fiber', goal: 2, unit: 'servings' },
  { id: 'sleep', name: 'Wind down on time', goal: 1, unit: 'night' },
];
const LESSONS = [
  { cat: 'Protein', title: 'Why protein matters more when you are losing weight', min: 4, icon: 'protein', scene: 'dawn' },
  { cat: 'Strength', title: 'Three beginner moves to ask your trainer about', min: 6, icon: 'move', scene: 'meadow' },
  { cat: 'Nutrition', title: 'Fiber and fluids: the two habits people skip', min: 3, icon: 'fiber', scene: 'meadow' },
  { cat: 'Mindset', title: 'Building a routine that survives a busy week', min: 5, icon: 'sleep', scene: 'dusk' },
  { cat: 'Nutrition', title: 'High-protein breakfasts in under five minutes', min: 4, icon: 'protein', scene: 'dawn' },
  { cat: 'Provider', title: '10 questions to bring to your provider visit', min: 3, icon: 'ask', scene: 'dusk' },
];
const TILE_COLORS = ['lilac', 'butter', 'mint', 'peach'];
const TIERS = {
  free: { name: 'Free', items: ['Daily habit tracker and food log', `Post to ${NAMES.feed} and join ${NAMES.challenges.toLowerCase()}`, 'Habit coach (lighter daily limit)'] },
  ...Object.fromEntries(Object.entries(PACKAGES).map(([k, p]) => [k, { name: p.name, items: [p.tagline, ...p.perks] }])),
};
const WINS = ['', 'Hit my protein', 'First workout', 'New streak', 'Tried a new recipe', 'Drank all my water'];
const DEMO_POSTS = [
  { id: 'd1', author_name: 'Marcus', created_at: new Date(Date.now() - 2 * 36e5).toISOString(), body: 'Hit protein at all three meals four days running. Overnight oats with a scoop of protein changed my mornings.', win: 'New streak', cheer_count: 12 },
  { id: 'd2', author_name: 'Dana', created_at: new Date(Date.now() - 5 * 36e5).toISOString(), body: 'First strength session in two years. Twenty minutes, felt amazing. Who wants to be my accountability buddy for Thursday?', win: 'First workout', cheer_count: 19 },
  { id: 'd3', author_name: 'Rob', created_at: new Date(Date.now() - 26 * 36e5).toISOString(), body: 'Meal prep Sunday done. Sheet pan chicken, roasted veggies, and a big batch of lentils for the week.', win: '', cheer_count: 8 },
];
const HF = [
  { t: 'Eat Healthy', u: 'https://odphp.health.gov/myhealthfinder/health-conditions/diabetes/eat-healthy' },
  { t: 'Get Active', u: 'https://odphp.health.gov/myhealthfinder/health-conditions/diabetes/get-active' },
  { t: 'Get Enough Sleep', u: 'https://odphp.health.gov/myhealthfinder/healthy-living/mental-health-and-relationships/get-enough-sleep' },
  { t: 'Manage Stress', u: 'https://odphp.health.gov/myhealthfinder/health-conditions/heart-health/manage-stress' },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || '';
const PRICE_LABEL = import.meta.env.VITE_CIRCLE_PRICE_LABEL || '';

const FOODS = prepare(FOOD_ROWS);
const EX = EX_RAW.map(e => ({ ...e, i: e.i.map(p => '/' + p.replace(/^\//, '')) }));

/* ---------------- Session + state ---------------- */
let user = null, profile = null, groupInfo = null, myConcierge = null, selfConcierge = null;
// Referral: /j/<slug> or ?ref=<slug>. Remembered on this device until sign-up.
const REF = (() => {
  const m = location.pathname.match(/^\/j\/([a-z0-9-]{2,30})\/?$/i), q = new URLSearchParams(location.search).get('ref');
  const r = (m?.[1] || q || '').toLowerCase();
  try { if (r) localStorage.setItem('lc-ref', r); return r || localStorage.getItem('lc-ref') || ''; } catch { return r; }
})();
let state = blankState();
const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');

function blankState() { return { tab: 'today', days: {}, favs: [], targets: {}, cat: 'All', hn: 'protein', hday: null, feed: 'wins' }; }
const cacheKey = () => 'lc-state-' + (user ? user.id : 'demo');
function save() {
  try { localStorage.setItem(cacheKey(), JSON.stringify(state)); } catch {}
  if (user) { const { tab, hday, ...synced } = state; cloud.queueSave(user.id, synced); }
}
function loadCache() { try { return JSON.parse(localStorage.getItem(cacheKey())) || null; } catch { return null; } }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const fmt = v => v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10);
const firstName = () => (profile && profile.first_name) || 'friend';
const hasCircle = () => !!profile && (profile.is_admin || profile.circle_active || ['essentials', 'performance', 'longevity'].includes(profile.tier));
const tierKey = () => (profile && profile.tier) || 'free';
const concierge = () => ({ name: myConcierge?.name?.split(' ')[0] || CONCIERGE.name || 'your concierge', contact: myConcierge?.contact_url || CONCIERGE.contact, label: myConcierge?.contact_label || CONCIERGE.contactLabel });
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function withBody(url, body) {
  if (!body) return url;
  if (/^sms:/.test(url)) return url + (isIOS() ? '&' : '?') + 'body=' + encodeURIComponent(body);
  if (/^mailto:/.test(url)) return url + (url.includes('?') ? '&' : '?') + 'body=' + encodeURIComponent(body);
  return url;
}
const whoAmI = () => { const n = profile?.first_name || ''; const e = user?.email || ''; return n && e ? `${n} (${e})` : n || e; };
const msg = s => `Hi! This is ${whoAmI() || 'a Longevity Concierge member'}. ${s}`;
const contactBtn = (cls = 'btn', text, body, req) => { const c = concierge(); return c.contact ? `<a class="${cls}" href="${esc(withBody(c.contact, body))}" ${req ? `data-req="${esc(req)}"` : ''} ${/^https:/.test(c.contact) ? 'target="_blank" rel="noopener"' : ''}>${esc(text || c.label)}</a>` : ''; };

const waiting = m => !!(m.requested_tier && PACKAGES[m.requested_tier] && !PACKAGES[m.tier]);

/* ---------------- Dates, days, streaks ---------------- */
function dayKeyOf(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function todayKey() { return dayKeyOf(new Date()); }
function lastDays(n) { const out = []; for (let k = n - 1; k >= 0; k--) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - k); out.push({ key: dayKeyOf(d), d }); } return out; }
function day(key) {
  if (!state.days) state.days = {};
  if (!state.days[key]) state.days[key] = { counts: {}, meals: [] };
  const d = state.days[key]; if (!d.counts) d.counts = {}; if (!d.meals) d.meals = [];
  return d;
}
function prune() { const keep = new Set(lastDays(120).map(x => x.key)); Object.keys(state.days || {}).forEach(k => { if (!keep.has(k)) delete state.days[k]; }); }
const counts = (key = todayKey()) => day(key).counts;
function pctOf(key) { const c = (state.days[key] || {}).counts || {}; let t = 0; HABITS.forEach(h => t += Math.min(c[h.id] || 0, h.goal) / h.goal); return Math.round(t / HABITS.length * 100); }
const pct = () => pctOf(todayKey());
function active(key) { const d = state.days[key]; return !!d && ((d.meals || []).length > 0 || Object.values(d.counts || {}).some(v => v > 0)); }
function streak() {
  let n = 0; const ds = lastDays(120).reverse();
  let i = active(ds[0].key) ? 0 : 1;
  for (; i < ds.length; i++) { if (active(ds[i].key)) n++; else break; }
  return n;
}
function mealsOn(key) { return (state.days[key] || { meals: [] }).meals || []; }
const meals = () => day(todayKey()).meals;
function totals(list) { return { p: list.reduce((a, x) => a + x.protein, 0), f: list.reduce((a, x) => a + x.fiber, 0) }; }
function addMeal(label, protein, fiber, items) {
  meals().push({ label: String(label).slice(0, 90), protein: Math.max(0, Number(protein) || 0), fiber: Math.max(0, Number(fiber) || 0), items: (items || []).slice(0, 15), at: Date.now() });
  save(); render();
}

function seedDemo() {
  const S = [
    [['Greek yogurt with raspberries', 17.7, 8], ['Chicken breast, quinoa, broccoli', 38.2, 10.4], ['Lentil soup', 9, 7.8]],
    [['Oatmeal with peanut butter', 13.5, 5.2], ['Tuna salad on whole-wheat bread', 29, 4.1]],
    [['2 eggs and toast', 16.5, 2], ['Turkey wrap', 24, 3.5], ['Salmon, sweet potato, peas', 27.4, 7.8]],
    [['Protein shake with banana', 27, 3.1], ['Black bean bowl', 18, 12.4]],
    [['Cottage cheese and pear', 13.6, 5.5], ['Shrimp stir-fry', 22, 4.6], ['Edamame snack', 9.2, 4]],
    [['Greek yogurt with chia seeds', 21, 8.2], ['Lean beef, rice, green peas', 26.5, 4.8]],
  ];
  lastDays(7).slice(0, 6).forEach((x, i) => { const d = day(x.key); d.meals = S[i].map(([label, protein, fiber]) => ({ label, protein, fiber, sample: true })); d.counts = { protein: 3, water: 6 + (i % 3), move: i % 2, fiber: 2, sleep: 1 }; });
  Object.assign(counts(), { protein: 2, water: 5, move: 1, fiber: 0, sleep: 0 });
}

/* ---------------- Brand bits ---------------- */
let uid = 0;
function sun(cls = 'osun') { const k = 's' + (uid++); return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="g${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd86b"/><stop offset=".55" stop-color="#ff8a4c"/><stop offset="1" stop-color="#ff5a36"/></linearGradient><mask id="m${k}"><rect width="100" height="100" fill="#fff"/><rect y="56" width="100" height="5" fill="#000"/><rect y="68" width="100" height="7" fill="#000"/><rect y="82" width="100" height="9" fill="#000"/></mask></defs><circle cx="50" cy="50" r="46" fill="url(#g${k})" mask="url(#m${k})"/></svg>`; }
function badge(text) { const k = 'b' + (uid++); return `<div class="badge" aria-hidden="true"><svg class="spin" viewBox="0 0 100 100"><defs><path id="${k}" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"/></defs><text><textPath href="#${k}" textLength="248" lengthAdjust="spacing">${text}</textPath></text></svg>${sun('core')}</div>`; }
const scrib = '<svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 C 22 3, 45 13, 66 6 S 92 5, 98 8"/></svg>';
const wordmark = () => `<span class="wm"><span class="word">l${sun()}ngevity</span><span class="hand cz">concierge</span></span>`;
function top() { return `<header class="top">${wordmark()}<button class="pill" id="open-account" aria-label="Your account">${DEMO ? 'Demo' : esc(firstName())}</button></header>`; }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'; }

/* ---------------- Today ---------------- */
function habitTile(h, wide) {
  const n = Math.min(counts()[h.id] || 0, h.goal), done = n >= h.goal;
  return `<button class="tile habit ${wide ? 's4 wide' : 's2'} ${done ? 'complete' : ''} ${done && animFrom?.justDone && animFrom.id === h.id ? 'just-done' : ''}" data-habit="${h.id}" id="habit-${h.id}" aria-label="Log ${h.name}, ${n} of ${h.goal} ${h.unit}">
    <span class="hico">${icon(done ? 'check' : h.id)}</span><span class="hname">${h.name}</span>
    <span class="hcount"><b class="hv">${n}</b><span>/ ${h.goal} ${h.unit}</span></span>
    <span class="bar"><i style="width:${(animFrom && animFrom.id === h.id ? animFrom.n : n) / h.goal * 100}%" data-w="${n / h.goal * 100}%"></i></span></button>`;
}
function today() {
  const p = pct(), c = counts(), done = HABITS.filter(h => (c[h.id] || 0) >= h.goal).length;
  const C = 2 * Math.PI * 50, off = C * (1 - p / 100), st = streak();
  const monday = new Date(); monday.setHours(12, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); const k = dayKeyOf(d), v = state.days[k] ? pctOf(k) : 0;
    return `<span class="${v >= 60 ? 'done' : v > 0 ? 'part' : ''} ${k === todayKey() ? 'today' : ''}"><i></i>${l}</span>`; }).join('');
  const mood = p >= 100 ? 'Perfect day!' : p >= 60 ? 'Strong day!' : p > 0 ? 'Keep going' : 'Let’s start';
  const nudge = p >= 100 ? `Every habit checked today. That is what consistency looks like. Enjoy the rest of your day, ${esc(firstName())}.` :
    (c.water || 0) < 4 ? 'You are a few glasses behind on water. Fill a bottle now and keep it where you can see it.' :
    (c.fiber || 0) < 1 ? 'Nice work so far! Want a few easy ways to fit fiber into dinner tonight?' :
    'You are close to a full day. One more habit and the streak keeps going.';
  return top() + `<div class="bento">
    <div class="tile hero halftone"><canvas data-scene="dawn"></canvas>
      <div class="txt"><span class="eyebrow">${DAYS[new Date().getDay()]}</span>
      <h1 class="mix"><span class="lt">${greeting()}</span><span class="hv">${esc(firstName())}.</span></h1></div>
      ${badge('LIVE STRONGER • LIVE LONGER • ')}</div>
    <div class="tile dark ringt s2 r2 ${animFrom?.perfect ? 'celebrate' : ''}"><span class="eyebrow">Today</span>${animFrom?.perfect ? '<span class="rays" aria-hidden="true"></span>' : ''}
      <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="12"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--sun)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${animFrom ? C * (1 - animFrom.pct / 100) : off}" data-off="${off}" class="ring-fill"/></svg>
        <div class="rv"><b class="hv">${p}</b><span>%</span></div></div>
      <div><p class="hand mood">${mood}</p><small>${done} of ${HABITS.length} habits done</small></div></div>
    <div class="tile butter streak s2">${sun()}<span class="eyebrow">Streak</span><b class="hv">${st}</b><span class="hand">${st === 1 ? 'day' : 'days'} in a row</span></div>
    <div class="tile paper week s2"><span class="eyebrow">This week</span><div class="dots">${week}</div></div>
    ${PACKAGES[tierKey()] ? '' : freeCta()}
    <div class="s4 sec"><h2><span class="hv">Today’s</span><span class="lt">habits</span></h2><span class="hand">tap to log</span></div>
    ${HABITS.map((h, i) => habitTile(h, i === 0)).join('')}
    ${packageTile()}
    ${foodSummaryTile()}
    ${movesTile()}
    ${conciergeTile()}
    <div class="tile coach s4"><span class="tape"></span><span class="eyebrow">A note from your coach</span><p class="hand">${nudge}</p><button class="btn-ink" id="open-coach">Ask your coach →</button></div>
    <p class="disclaim s4">General wellness education only, not medical advice. Your licensed provider makes all medical decisions.</p>
  </div>`;
}

function freeCta() {
  const f = PACKAGES[FEATURED.key], m = monthly(f);
  return `<button class="tile dark plan feat-pkg pkg-cta s4" data-tabgo="plan" id="free-cta"><span class="sticker">${esc(FEATURED.badge)}</span><span class="eyebrow">Make it easier</span><b class="hv">${esc(f.name)}</b><span class="ptot hv">${money(m.total)}<small>/mo</small></span><span class="why">${m.off ? money(m.off) + ' off every month, free shipping, a free product and ' + NAMES.paidThe + ' included.' : NAMES.paidThe + ' included.'}</span><span class="btn sun">See the packages →</span></button>`;
}
function packageTile() {
  const k = tierKey(), pk = PACKAGES[k];
  if (!pk) return '';
  const c = counts();
  const items = pk.daily.map((d, i) => { const on = !!c['pkg' + i]; return `<button class="pchk${on ? ' on' : ''}" data-pkg="${i}" aria-pressed="${on}"><span class="box">${on ? icon('check') : ''}</span>${esc(d)}</button>`; }).join('');
  const done = pk.daily.filter((_, i) => c['pkg' + i]).length;
  return `<div class="tile butter s4 pkg"><div class="mrow"><span class="eyebrow">Your ${esc(pk.name)} package · today</span><span class="hand">${done}/${pk.daily.length}</span></div><div class="pchks">${items}</div>${reorderLine()}</div>`;
}
function reorderLine() {
  const pk = PACKAGES[tierKey()]; if (!pk || !state.pkgOrdered) return '';
  const left = Math.round((new Date(state.pkgOrdered + 'T12:00:00') - new Date()) / 864e5) + pk.reorderDays;
  if (left > 5) return '';
  return `<p class="reorder">${left > 0 ? `About ${left} day${left === 1 ? '' : 's'} left in this order.` : 'Time to reorder.'} ${contactBtn('linkbtn', 'Reorder with ' + concierge().name + ' →', msg(`I’m ready to reorder my ${pk.name} package.`))}</p>`;
}
function conciergeTile() {
  const c = concierge();
  const generic = c.name === 'your concierge';
  return `<div class="tile lilac s4 conc"><span class="face" style="background:var(--butter)">${generic ? sun() : esc(c.name[0])}</span><div><span class="eyebrow">Your concierge</span><b>${generic ? 'Here to help' : esc(c.name)}</b><small>Questions about your package, a reorder, or just stuck? Reach out.</small></div>${contactBtn('btn', c.contact ? 'Text' : '')}</div>`;
}

/* ---------------- Learn ---------------- */
function learn() {
  const cats = ['All', 'Protein', 'Strength', 'Nutrition', 'Mindset', 'Provider'];
  if (!articles) loadArticles();
  const all = (articles || SEED_ARTICLES).filter(l => l.published || isAdmin());
  const list = all.filter(l => state.cat === 'All' || l.cat === state.cat);
  const [f, ...rest] = list;
  const tiles = rest.map((l, i) => { const wide = rest.length % 2 === 1 && i === rest.length - 1;
    return `<button class="tile lesson ${TILE_COLORS[i % 4]} ${wide ? 's4 wide' : 's2'}" data-article="${esc(l.id)}"><span class="glyph">${icon(ICONS[l.icon] ? l.icon : 'protein')}</span><span class="tag">${esc(l.cat)}${l.published ? '' : ' · Draft'}</span><b>${esc(l.title)}</b><span class="min">${l.minutes} min read</span></button>`; }).join('');
  return top() + `<div class="bento">
    <div class="s4 title"><h1 class="mix"><span class="lt">Learn the</span><span class="hv"><span class="scrib accent">why${scrib}</span>.</span></h1><p>Short, research-informed reads you can finish in minutes.</p></div>
    <button class="tile dark s4 howto" type="button" data-video="explainer"><span class="hico">${icon('play')}</span><span><span class="eyebrow">How the app works</span><b>Watch the 1-minute tour</b></span></button>
    ${isAdmin() ? `<button class="tile paper s4 adm-add" data-article-new="1">${icon('pen')}<span><b>New article</b><small>Admins only · write, preview, publish</small></span></button>` : ''}
    <div class="s4 chips" role="tablist">${cats.map(c => `<button class="chip ${state.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
    ${f ? `<button class="tile lesson feat s4 halftone" data-article="${esc(f.id)}"><canvas data-scene="${['dawn', 'meadow', 'dusk'][(f.sort || 0) % 3]}"></canvas><span class="sticker">${f.published ? 'New' : 'Draft'}</span>
      <span class="label"><span class="tag">${esc(f.cat)} · ${f.minutes} min read</span><b>${esc(f.title)}</b></span></button>` : ''}
    ${tiles}
    <button class="tile peach finder-tile s4" data-finder="fiber" id="open-finder-learn"><span class="eyebrow">Tool · USDA data</span><span class="ft-q hv">Protein &amp; fiber finder</span><span class="ft-search">${icon('search')}<span>Compare ${FOODS.length.toLocaleString('en-US')} foods</span></span></button>
    <button class="tile dark finder-tile s4" data-moves="lib" id="open-moves-learn"><span class="eyebrow">Move library</span><span class="ft-q hv">${EX.length} beginner moves</span><span class="mvstrip">${EX.filter((e, i) => i % 7 === 0).slice(0, 4).map(mvimg).join('')}</span></button>
    <div class="s4 sec"><h2><span class="hv">Trusted</span><span class="lt">reads</span></h2><span class="hand">from HHS</span></div>
    ${HF.map(h => `<a class="tile paper hf s2" href="${h.u}" target="_blank" rel="noopener"><span class="eyebrow">MyHealthfinder</span><b>${h.t}</b><span class="ext">odphp.health.gov ↗</span></a>`).join('')}
    <a class="tile butter hf s4" href="https://www.usdalocalfoodportal.com/#directories" target="_blank" rel="noopener"><span class="eyebrow">USDA Local Food Portal</span><b class="big">Find farmers markets near you</b><span>Fresh produce is an easy fiber win. Look up farmers markets, CSAs and farm stands in your area.</span><span class="ext">usdalocalfoodportal.com ↗</span></a>
    <p class="disclaim s4">Content is general education based on published research. Talk with your provider before changing your nutrition or exercise routine.</p>
  </div>`;
}

/* ---------------- Community: Check-In, Challenges, the Circle ---------------- */
const FACE = ['var(--butter)', 'var(--mint)', 'var(--peach)', 'var(--lilac)', 'var(--sun)'];
const faceColor = s => FACE[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % FACE.length];
function ago(iso) { const s = (Date.now() - new Date(iso)) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; }
function circle() {
  const access = hasCircle(), feed = access ? state.feed : 'wins';
  const g = groupInfo;
  const keptTile = access ? `<div class="tile dark live s4">${badge('THE CIRCLE • MEMBERS ONLY • ')}
      <span class="eyebrow livedot">${esc(NAMES.paid + ' Live · ' + (g?.next_call || 'Weekly'))}</span>
      <b class="hv">The Circle<span class="accent">.</span></b>
      <div>${g?.call_link ? `<a class="btn sun" href="${esc(g.call_link)}" target="_blank" rel="noopener">Join ${NAMES.paid} Live</a>` : `<small>You’re a ${NAMES.paid} member. Live session links show up here.</small>`}</div></div>`
    : `<div class="tile lilac join s4"><span class="eyebrow">Members only</span><b class="hv">The Circle<span class="accent">.</span></b>
      <p>${esc(NAMES.paidLine)}</p>
      <ul><li>${NAMES.paid} Live: weekly members-only Q&amp;A calls</li><li>Members-only challenges</li><li>A private group, separate from the main feed</li><li>A ${NAMES.paid} badge on your check-ins</li></ul>
      <button class="btn" data-tabgo="plan" id="join-circle">Pick a package to join</button>
      <small>Included with every package: ${Object.values(PACKAGES).map(p => esc(p.name)).join(', ')}.</small></div>`;
  return top() + `<div class="bento">
    <div class="s4 title"><h1 class="mix"><span class="hv">Check-in<span class="accent">.</span></span></h1></div>
    ${keptTile}
    <div class="s4 sec"><h2><span class="hv">${NAMES.challenges}</span></h2>${isAdmin() && !DEMO ? `<button class="linkbtn" data-pact-new="1">+ New challenge</button>` : `<span class="hand">join one, check in daily</span>`}</div>
    <div class="s4 pacts" id="pacts"><p class="status">Loading…</p></div>
    <div class="s4 seg small" role="group" aria-label="Feed"><button data-feed="wins" class="${feed === 'wins' ? 'on' : ''}">Everyone</button><button data-feed="group" class="${feed === 'group' ? 'on' : ''}" ${access ? '' : 'disabled aria-disabled="true"'}>${access ? '' : icon('lock', 'lk')}${NAMES.paidThe[0].toUpperCase() + NAMES.paidThe.slice(1)} (private)</button></div>
    <div class="tile s4 composer"><label class="eyebrow" for="post-body">Check in</label>
      <textarea id="post-body" maxlength="600" placeholder="${feed === 'wins' ? 'How did today go? Share a win or ask for support.' : `Shared only with ${NAMES.paidThe} members`}"></textarea>
      <div class="btnrow"><select id="post-win" aria-label="Win tag">${WINS.map(w => `<option value="${esc(w)}">${w || 'No tag'}</option>`).join('')}</select><button class="btn" id="post-send">Check in</button></div></div>
    <div class="s4 feed" id="feed"><p class="status">Loading…</p></div>
    <p class="disclaim s4">Check-ins are member experiences, not medical advice. Please keep medication and dosing questions between you and your provider. Be kind.</p>
  </div>`;
}

/* ---- Pacts ---- */
let pactData = null;
const DEMO_PACTS = [
  { id: 'dp1', title: 'Protein breakfast', goal: 'Get protein in at breakfast every day.', icon: 'protein', days: 30, members_only: false },
  { id: 'dp2', title: 'Walk 8k a day', goal: 'Hit 8,000 steps, or a 30-minute walk.', icon: 'move', days: 30, members_only: false },
  { id: 'dp3', title: 'Lights out by 10:30', goal: 'Screens down and lights out by 10:30.', icon: 'sleep', days: 21, members_only: false },
  { id: 'dp4', title: 'Circle: 30-day reset', goal: 'All five daily habits, every day, with the Circle.', icon: 'check', days: 30, members_only: true },
];
async function loadPacts() {
  const el = document.getElementById('pacts'); if (!el) return;
  try {
    if (DEMO) { const d = state.demoPacts || (state.demoPacts = { mine: { dp1: dayKeyOf(new Date(Date.now() - 6 * 864e5)) }, checks: [] });
      pactData = { pacts: DEMO_PACTS.filter(p => !p.members_only || hasCircle()), stats: { dp1: [84, 31], dp2: [57, 22], dp3: [39, 0], dp4: [18, 9] }, mine: d.mine, checks: new Set(d.checks) }; }
    else pactData = await cloud.loadPacts();
    renderPacts();
  } catch (e) { console.error(e); el.innerHTML = `<p class="status">${NAMES.challenges} are coming soon.</p>`; }
}
function pactProgress(p) {
  const joined = pactData.mine[p.id]; if (!joined) return null;
  const start = new Date(joined + 'T12:00:00'), dayN = Math.floor((new Date() - start) / 864e5) + 1;
  let done = 0; for (let i = 0; i < Math.min(dayN, p.days); i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (pactData.checks.has(p.id + '|' + dayKeyOf(d))) done++; }
  return { dayN: Math.min(dayN, p.days), done, over: dayN > p.days, today: pactData.checks.has(p.id + '|' + todayKey()) };
}
function renderPacts() {
  const el = document.getElementById('pacts'); if (!el || !pactData) return;
  if (!pactData.pacts.length) { el.innerHTML = `<p class="status">No ${NAMES.challenges.toLowerCase()} yet.</p>`; return; }
  const teaser = hasCircle() ? '' : `<div class="tile pact dark locked"><div class="pact-top"><span class="hico">${icon('lock')}</span><span class="pill-k">Package members</span></div><b>Circle: 30-day reset</b><small>All five daily habits, every day, with the Circle.</small><small class="pstat">Unlocks with Foundation, Strength or Complete</small><button class="btn sun" data-tabgo="plan">See packages</button></div>`;
  el.innerHTML = pactData.pacts.map(p => {
    const pr = pactProgress(p), st = pactData.stats[p.id] || [0, 0];
    const action = !pr ? `<button class="btn" data-pact="${esc(p.id)}" data-do="join">Join</button>`
      : pr.over ? `<span class="pact-done">${pr.done >= p.days * 0.8 ? 'Challenge complete!' : 'Finished'} · ${pr.done}/${p.days}</span>`
      : pr.today ? `<button class="btn alt" data-pact="${esc(p.id)}" data-do="undo">${icon('check')}Checked in</button>`
      : `<button class="btn sun" data-pact="${esc(p.id)}" data-do="check">Check in today</button>`;
    if (p.active === false && !isAdmin()) return '';
    const adminBit = isAdmin() && !DEMO ? `<button class="linkbtn pact-edit" data-pact-edit="${esc(p.id)}">${p.active === false ? 'Ended · Edit' : 'Edit'}</button>` : '';
    return `<div class="tile pact ${p.members_only ? 'dark' : ''} ${p.active === false ? 'ended' : ''}"><div class="pact-top"><span class="hico">${icon(ICONS[p.icon] ? p.icon : 'check')}</span>${p.members_only ? `<span class="pill-k">${NAMES.paid}</span>` : ''}${adminBit}</div>
      <b>${esc(p.title)}</b><small>${esc(p.goal)}</small>
      ${pr ? `<span class="bar"><i style="width:${pr.done / p.days * 100}%"></i></span><small>Day ${pr.dayN} of ${p.days} · ${pr.done} check-in${pr.done === 1 ? '' : 's'}</small>` : `<small class="pstat">${st[0]} joined${st[1] ? ` · ${st[1]} checked in today` : ''} · ${p.days} days</small>`}
      ${action}</div>`;
  }).join('') + teaser;
}
async function pactAction(id, what) {
  const p = pactData && pactData.pacts.find(x => String(x.id) === String(id)); if (!p) return;
  const day = todayKey();
  if (what === 'join') pactData.mine[id] = day;
  if (what === 'check') pactData.checks.add(id + '|' + day);
  if (what === 'undo') pactData.checks.delete(id + '|' + day);
  if (what === 'check') { buzz([10, 30, 14]); const pr = pactProgress(p); toast(pr && pr.done === p.days ? 'Challenge complete! 🎉' : 'Checked in. Keep it going!'); }
  renderPacts();
  if (DEMO) { state.demoPacts = { mine: pactData.mine, checks: [...pactData.checks] }; save(); return; }
  try { if (what === 'join') await cloud.joinPact(id, day); else if (what === 'check') await cloud.pactCheckIn(id, day); else if (what === 'undo') await cloud.pactUndo(id, day); }
  catch (e) { console.error(e); toast('Couldn’t save that. Try again.'); loadPacts(); }
}
function postTile(p) {
  const mine = user && p.user_id === user.id;
  return `<article class="tile post s4"><header><span class="face" style="background:${faceColor(p.author_name)}">${esc((p.author_name || 'M')[0])}</span><div><b>${esc(p.author_name || 'Member')}${p.author_kept ? ` <span class="pill-k sm">${NAMES.paid}</span>` : ''}</b><small>${ago(p.created_at)} ago</small></div>${p.win ? `<span class="win">${esc(p.win)}</span>` : ''}</header>
  <p>${esc(p.body)}</p><div class="acts"><button class="cheer ${p.cheered ? 'on' : ''}" data-cheer="${esc(p.id)}">Cheer · ${p.cheer_count}</button>${mine || profile?.is_admin ? `<button class="cheer" data-delpost="${esc(p.id)}">Delete</button>` : ''}</div></article>`;
}
let feedPosts = [];
async function loadFeed() {
  const el = document.getElementById('feed'); if (!el) return;
  if (!pactData || DEMO) loadPacts(); else renderPacts();
  try {
    if (DEMO) feedPosts = DEMO_POSTS.map(p => ({ ...p, cheered: !!(state.demoCheers || {})[p.id], cheer_count: p.cheer_count + ((state.demoCheers || {})[p.id] ? 1 : 0) }));
    else {
      if (hasCircle() && profile.group_id && (!groupInfo || groupInfo.id !== profile.group_id)) { groupInfo = await cloud.getGroup(profile.group_id); if (state.tab === 'circle') { render(); return; } }
      feedPosts = await cloud.listPosts(hasCircle() && state.feed === 'group' ? profile.group_id : null);
    }
    const el2 = document.getElementById('feed'); if (!el2) return;
    el2.innerHTML = feedPosts.length ? feedPosts.map(postTile).join('') : '<p class="status">No check-ins yet. Be the first to share a win!</p>';
  } catch (e) { console.error(e); el.innerHTML = '<p class="status">Couldn’t load posts. Pull down to refresh or try again later.</p>'; }
}

/* ---------------- Plan ---------------- */
const list = items => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
function plan() {
  const tier = tierKey(), pk = PACKAGES[tier], c = concierge();
  const keptLine = hasCircle() ? `<p>The Circle is included with your package.</p>`
    : `<p>${NAMES.paidThe[0].toUpperCase() + NAMES.paidThe.slice(1)} comes with every package.</p>`;
  const others = ['essentials', 'performance', 'longevity'].filter(k => k !== tier);
  const current = pk ? `<div class="tile dark plan current s4"><span class="eyebrow">Your package · ${esc(pk.tagline)}</span><b class="hv">${esc(pk.name)}</b>${priceBlock(pk, true)}${perksBlock(pk)}
      <div class="prods">${pk.products.map(p => `<div class="prod"><b>${esc(p.name)}</b><small>${esc(p.how)}</small></div>`).join('')}</div>
      <div class="ordered"><label for="pkg-ordered">Last order arrived</label><input id="pkg-ordered" type="date" class="inp" value="${esc(state.pkgOrdered || '')}"><small>${state.pkgOrdered ? reorderText() : 'Add the date and we’ll remind you when it’s time to reorder.'}</small></div>
      <div class="circle-status">${keptLine}</div>
      ${tier === 'longevity' && BOOKING_URL ? `<a class="btn sun" href="${esc(BOOKING_URL)}" target="_blank" rel="noopener">Book your monthly 1:1</a>` : ''}</div>`
    : `<div class="tile dark plan current s4"><span class="eyebrow">Current</span><b class="hv">Free</b>${list(TIERS.free.items)}<div class="circle-status">${keptLine}</div></div>`;
  return top() + `<div class="bento">
    <div class="s4 title"><h1 class="mix"><span class="lt">Your</span><span class="hv">plan<span class="accent">.</span></span></h1><p>${pk ? 'Your package, your concierge, and what’s next.' : 'Choose a package and your concierge gets it to your door.'}</p></div>
    ${pk ? current + conciergeTile() : ''}
    <div class="s4 sec"><h2><span class="hv">${pk ? 'Other' : 'Pick a'}</span><span class="lt">${pk ? 'packages' : 'package'}</span></h2><span class="hand">ask ${esc(c.name)}</span></div>
    ${featuredTile(others, tier)}
    ${others.filter(k => k !== FEATURED.key).map((k, i, arr) => `<div class="tile paper plan ${arr.length === 1 ? 's4' : 's2'}"><span class="eyebrow">${esc(PACKAGES[k].tagline)}</span><b class="hv">${esc(PACKAGES[k].name)}</b>${priceBlock(PACKAGES[k], false)}${perksBlock(PACKAGES[k])}${contactBtn('btn', 'Ask about ' + PACKAGES[k].name, msg(`I’d like the ${PACKAGES[k].name} package.`), k)}</div>`).join('')}
    ${pk ? '' : `<div class="tile paper free-line s4"><span class="eyebrow">You’re on Free</span>${profile?.requested_tier && PACKAGES[profile.requested_tier] ? `<p class="req-note">You asked about ${esc(PACKAGES[profile.requested_tier].name)}. ${esc(c.name[0].toUpperCase() + c.name.slice(1))} will set it up and it’ll show here.</p>` : ''}<p>${TIERS.free.items.map(esc).join(' · ')}</p><div class="circle-status">${keptLine}</div></div>` + conciergeTile()}
    <div class="tile peach provider s4"><span class="eyebrow">Add-on</span><b class="hv">${esc(VALDURA.title)}</b><p>${esc(VALDURA.body)}</p>${contactBtn('btn', 'Ask ' + c.name + ' about it', msg('I’d like to know more about adding Valdura for my bloodwork.'))}</div>
    ${profile?.is_admin || selfConcierge ? `<button class="tile mint finder-tile s4" data-act="admin" id="open-admin"><span class="eyebrow">${profile?.is_admin ? 'Admin' : 'Your team'}</span><span class="ft-q hv">Members &amp; groups</span></button>` : ''}
    <p class="disclaim s4">Longevity Concierge provides general wellness education and coordination. We do not diagnose, treat, prescribe, or recommend any medication, peptide, or dosage. Supplements are not intended to diagnose, treat, cure, or prevent any disease. Valdura is a separate service with its own terms.</p>
  </div>`;
}
function featuredTile(others, tier) {
  const k = FEATURED.key, pk = PACKAGES[k]; if (!pk || !others.includes(k)) return '';
  const m = monthly(pk), cur = PACKAGES[tier];
  const diff = cur ? m.total - monthly(cur).total : null;
  const why = m.off ? `The ${money(m.off)} member discount applies, and ${NAMES.paidThe} is included.` : `Includes ${NAMES.paidThe}.`;
  return `<div class="tile dark plan feat-pkg s4"><span class="sticker">${esc(FEATURED.badge)}</span><span class="eyebrow">${esc(pk.tagline)}</span><b class="hv">${esc(pk.name)}</b>${priceBlock(pk, false)}
    <p class="why">${why}${diff !== null && diff > 0 ? ` Just ${money(diff)} more a month than ${esc(cur.name)}.` : ''}</p>${perksBlock(pk)}
    ${contactBtn('btn sun', 'Ask about ' + pk.name, msg(`I’d like the ${pk.name} package.`), FEATURED.key)}</div>`;
}
function priceBlock(pk, full) {
  const m = monthly(pk);
  const math = `${money(m.retail)} products + ${money(m.fee)} membership${m.off ? ` − ${money(m.off)} member discount` : ''}`;
  return `<div class="pblock"><span class="ptot hv">${money(m.total)}<small>/mo</small></span><span class="pmath">${math}</span></div>`;
}
const memberPerks = pk => MEMBERSHIP.perks.filter(x => monthly(pk).qualifies || !x.min).map(x => x.t);
const perksBlock = pk => `${list(pk.perks)}<div class="mperks"><span class="eyebrow">${esc(MEMBERSHIP.name)} perks</span>${list(memberPerks(pk))}${monthly(pk).qualifies ? '' : `<small class="mnote">The $${MEMBERSHIP.discount} off, free shipping and free product need a $${MEMBERSHIP.minOrder}+ order.</small>`}<small class="mnote">${esc(MEMBERSHIP.note)}</small></div>`;
function reorderText() {
  const pk = PACKAGES[tierKey()]; if (!pk || !state.pkgOrdered) return '';
  const left = Math.round((new Date(state.pkgOrdered + 'T12:00:00') - new Date()) / 864e5) + pk.reorderDays;
  return left > 0 ? `About ${left} day${left === 1 ? '' : 's'} until your next reorder.` : 'Time to reorder.';
}

/* ---------------- Mixed-media scenes ---------------- */
const SCENES = {
  dawn: { sky: ['#ffe7a3', '#ff8f5e'], sun: '#fff3d2', pos: [.7, .6], r: .17, hills: ['#3f8f73', '#22614f', '#0f3b33'] },
  dusk: { sky: ['#cbbcff', '#ff9b78'], sun: '#ffeab8', pos: [.3, .55], r: .15, hills: ['#8a6dbb', '#55408a', '#2b2257'] },
  meadow: { sky: ['#c4f0de', '#ffe39b'], sun: '#ffffff', pos: [.62, .46], r: .14, hills: ['#8fe0bd', '#45a884', '#1f5c4b'] },
};
function paint(cv) {
  const s = SCENES[cv.dataset.scene]; if (!s) return;
  const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d)); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, s.sky[0]); g.addColorStop(1, s.sky[1]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const R = s.r * Math.max(w, h), cx = s.pos[0] * w, cy = s.pos[1] * h;
  x.fillStyle = s.sun; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.fillStyle = g; [[.12, .07], [.36, .1], [.62, .13]].forEach(([o, t]) => x.fillRect(cx - R - 2, cy + o * R, 2 * R + 4, t * R));
  s.hills.forEach((c, i) => { const base = h * (.66 + i * .11), amp = h * (.07 - i * .012); x.fillStyle = c; x.beginPath(); x.moveTo(0, h);
    for (let k = 0; k <= 48; k++) { const px = k / 48 * w; x.lineTo(px, base - Math.sin(k / 48 * Math.PI * (1.1 + i * .8) + i * 1.9) * amp); } x.lineTo(w, h); x.closePath(); x.fill(); });
  const id = x.getImageData(0, 0, w, h), p = id.data; let seed = 11;
  for (let k = 0; k < p.length; k += 4) { seed = (seed * 16807) % 2147483647; const n = (seed / 2147483647 - .5) * 30; p[k] += n; p[k + 1] += n; p[k + 2] += n; }
  x.putImageData(id, 0, 0);
}
const paintAll = () => document.querySelectorAll('canvas[data-scene]').forEach(paint);

/* ---------------- Render ---------------- */
let animFrom = null, entered = false;
function render() {
  uid = 0; prune();
  tabsEl.hidden = false;
  app.innerHTML = ({ today, food, learn, circle, plan }[state.tab] || today)();
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === state.tab));
  requestAnimationFrame(paintAll);
  if (animFrom) { animFrom = null; requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.ring-fill[data-off]').forEach(r => r.setAttribute('stroke-dashoffset', r.dataset.off));
    document.querySelectorAll('.bar i[data-w]').forEach(b => { b.style.width = b.dataset.w; }); })); }
  if (!entered) { entered = true; const b = app.querySelector('.bento'); if (b) { b.classList.add('enter'); [...b.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 8))); setTimeout(() => b.classList.remove('enter'), 900); } }
  if (state.tab === 'circle') loadFeed();
}
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(paintAll, 150); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAll);
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 220); }, 2200);
}
const buzz = p => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
// Bottom sheet: slides up from the bottom edge, leaves the same way, and can be dragged down to dismiss.
function sheet(html, cls = 'panel tall') {
  const s = document.createElement('div'); s.className = 'sheet';
  s.innerHTML = `<div class="${cls}" role="dialog" aria-modal="true"><span class="grab" aria-hidden="true"></span>${html}</div>`;
  document.body.appendChild(s); document.body.classList.add('sheet-open');
  const panel = s.firstElementChild;
  requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('open')));
  s.close = () => {
    if (s.closing) return; s.closing = true;
    panel.style.transition = ''; panel.style.transform = '';
    s.classList.remove('open'); s.classList.add('closing');
    const done = () => { s.remove(); if (!document.querySelector('.sheet')) document.body.classList.remove('sheet-open'); };
    panel.addEventListener('transitionend', done, { once: true }); setTimeout(done, 320);
  };
  const onKey = e => { if (e.key === 'Escape' && document.body.contains(s)) { s.close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  // Drag to dismiss: grab the handle or header. Tracks 1:1, resists upward, dismisses on distance or a quick flick.
  let y0 = 0, t0 = 0, dy = 0, hist = [], dragging = false;
  panel.addEventListener('pointerdown', e => {
    if (!e.target.closest('.grab, .panel > header') || e.target.closest('button, a, input, select, textarea')) return;
    dragging = true; y0 = e.clientY; t0 = performance.now(); dy = 0; hist = [[t0, 0]];
    panel.setPointerCapture(e.pointerId); panel.style.transition = 'none';
  });
  panel.addEventListener('pointermove', e => {
    if (!dragging) return; const raw = e.clientY - y0;
    dy = raw >= 0 ? raw : -(Math.abs(raw) * 60) / (60 + Math.abs(raw)); // rubber-band past the top
    panel.style.transform = `translateY(${dy}px)`; hist.push([performance.now(), dy]); if (hist.length > 6) hist.shift();
  });
  const end = () => {
    if (!dragging) return; dragging = false;
    const [ta, ya] = hist[0], [tb, yb] = hist[hist.length - 1], v = (yb - ya) / Math.max(1, tb - ta); // px per ms
    if (dy > panel.offsetHeight * 0.25 || (v > 0.11 && dy > 8)) { panel.style.transition = ''; s.close(); return; }
    panel.style.transition = ''; panel.style.transform = '';
  };
  panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
  return s;
}

/* ---------------- Clicks ---------------- */
document.addEventListener('change', e => { if (e.target.id === 'pkg-ordered') { state.pkgOrdered = e.target.value || null; save(); render(); } });
document.addEventListener('click', async e => {
  if (e.target.closest('.sheet')) return; // sheets handle their own clicks
  const tab = e.target.closest('.tab'); if (tab) { state.tab = tab.dataset.tab; save(); render(); window.scrollTo(0, 0); return; }
  if (foodClicks(e)) return;
  const h = e.target.closest('[data-habit]');
  if (h) { const def = HABITS.find(x => x.id === h.dataset.habit), before = pct(), c = counts(), prevN = c[def.id] || 0; let n = prevN + 1; if (n > def.goal) n = 0; c[def.id] = n; save();
    animFrom = { pct: before, id: def.id, n: Math.min(prevN, def.goal), justDone: n === def.goal, perfect: pct() === 100 && before < 100 };
    buzz(n === def.goal ? [10, 30, 14] : 8);
    render();
    if (n === def.goal) toast(animFrom?.perfect || (pct() === 100 && before < 100) ? 'Perfect day! Streak extended.' : 'Nice! ' + def.name + ' done.'); return; }
  const pc = e.target.closest('[data-pkg]'); if (pc) { const c2 = counts(), k2 = 'pkg' + pc.dataset.pkg; c2[k2] = c2[k2] ? 0 : 1; buzz(8); save(); render(); return; }
  const rq = e.target.closest('[data-req]'); if (rq && profile && !PACKAGES[profile.tier]) { profile.requested_tier = rq.dataset.req; profile.requested_at = new Date().toISOString(); if (!DEMO && user) cloud.saveProfile(user.id, { requested_tier: profile.requested_tier, requested_at: profile.requested_at }).catch(console.error); setTimeout(() => { if (state.tab === 'plan') render(); }, 400); }
  const ar = e.target.closest('[data-article]'); if (ar) { openArticle(ar.dataset.article); return; }
  if (e.target.closest('[data-article-new]')) { editArticle(); return; }
  const pe = e.target.closest('[data-pact-edit]'); if (pe) { editPact(pactData.pacts.find(x => String(x.id) === pe.dataset.pactEdit) || {}); return; }
  if (e.target.closest('[data-pact-new]')) { editPact(); return; }
  const vb = e.target.closest('[data-video]'); if (vb) { playVideo(vb.dataset.video); return; }
  const tg = e.target.closest('[data-tabgo]'); if (tg) { state.tab = tg.dataset.tabgo; save(); render(); window.scrollTo(0, 0); return; }
  const pj = e.target.closest('[data-pact]'); if (pj) return pactAction(pj.dataset.pact, pj.dataset.do);
  const c = e.target.closest('[data-cat]'); if (c) { state.cat = c.dataset.cat; save(); render(); return; }
  const fd = e.target.closest('[data-feed]'); if (fd && !fd.disabled) { state.feed = fd.dataset.feed; save(); render(); return; }
  const ch = e.target.closest('[data-cheer]'); if (ch) return toggleCheer(ch.dataset.cheer);
  const dp = e.target.closest('[data-delpost]'); if (dp) { if (DEMO) return; try { await cloud.deletePost(dp.dataset.delpost); toast('Post deleted'); loadFeed(); } catch { toast('Couldn’t delete that post.'); } return; }
  if (e.target.closest('#post-send')) return sendPost();
  if (e.target.closest('#open-coach')) return openCoach();
  if (e.target.closest('#open-account')) return openAccount();
  const act = e.target.closest('[data-act]');
  if (act) { const a = act.dataset.act; if (a === 'checkout' || a === 'portal') return goStripe(a, act); if (a === 'admin') return openAdmin(); }
  const f = e.target.closest('[data-finder]'); if (f) return openFinder(f.dataset.finder);
  const mv = e.target.closest('[data-move]'); if (mv) return openMoves(Number(mv.dataset.move));
  if (e.target.closest('[data-moves]')) return openMoves(null);
  const lg = e.target.closest('[data-log]'); if (lg) return openLogger(lg.dataset.log);
});

async function toggleCheer(id) {
  const p = feedPosts.find(x => String(x.id) === String(id)); if (!p) return;
  const on = !p.cheered; p.cheered = on; p.cheer_count += on ? 1 : -1;
  const el = document.getElementById('feed'); if (el) el.innerHTML = feedPosts.map(postTile).join('');
  if (DEMO) { state.demoCheers = state.demoCheers || {}; state.demoCheers[id] = on; save(); return; }
  try { await cloud.setCheer(id, on); } catch { toast('Couldn’t save that cheer.'); }
}
async function sendPost() {
  const ta = document.getElementById('post-body'), win = document.getElementById('post-win').value, body = ta.value.trim();
  if (!body) { ta.focus(); return; }
  if (DEMO) { DEMO_POSTS.unshift({ id: 'd' + Date.now(), author_name: firstName(), created_at: new Date().toISOString(), body, win, cheer_count: 0 }); ta.value = ''; loadFeed(); return; }
  const btn = document.getElementById('post-send'); btn.disabled = true;
  try { await cloud.createPost({ body, win, groupId: state.feed === 'group' ? profile.group_id : null }); ta.value = ''; toast('Posted!'); loadFeed(); }
  catch (err) { console.error(err); toast('Couldn’t post that. Try again.'); }
  finally { btn.disabled = false; }
}
async function goStripe(kind, btn) {
  btn.disabled = true;
  try { const { url } = await cloud.api(kind === 'checkout' ? '/api/checkout' : '/api/portal'); location.href = url; }
  catch (err) { toast(err.message); btn.disabled = false; }
}

/* ---------------- Moves ---------------- */
const GROUPS = ['Bodyweight', 'Dumbbell', 'Bands', 'Stretch'];
function mvimg(e) { return `<span class="mvimg"><img src="${e.i[0]}" alt="" loading="lazy">${e.i[1] ? `<img class="f2" src="${e.i[1]}" alt="" loading="lazy">` : ''}</span>`; }
function dayIndex() { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
function todaysMoves() { const all = EX.map((e, i) => [e, i]), bw = all.filter(([e]) => e.g === 'Bodyweight'), st = all.filter(([e]) => e.g === 'Stretch'), k = dayIndex();
  if (!bw.length || !st.length) return []; return [bw[k % bw.length], bw[(k + 5) % bw.length], st[k % st.length]]; }
function movesTile() { const tm = todaysMoves(); if (!tm.length) return '';
  return `<div class="tile paper movest s4"><div class="mrow"><span class="eyebrow">Today’s 3 moves</span><button class="linkbtn" data-moves="lib" id="open-moves">All ${EX.length} moves →</button></div>
  <div class="mv3">${tm.map(([e, i]) => `<button class="mvbtn" data-move="${i}">${mvimg(e)}<span>${esc(e.n)}</span></button>`).join('')}</div></div>`; }
function openMoves(start) {
  const st = { g: start !== null && EX[start] ? EX[start].g : 'Bodyweight', sel: start };
  const s = sheet(`<header><span class="hv">Moves</span><button class="x" aria-label="Close">×</button></header><div class="mvbody" id="mvbody"></div>
    <div class="fine">Check with your provider or a trainer before starting a new exercise routine. Stop if anything hurts.</div>`);
  const body = s.querySelector('#mvbody');
  function draw() {
    if (st.sel !== null && EX[st.sel]) { const e = EX[st.sel];
      body.innerHTML = `<button class="linkbtn back" data-back="1">← All ${esc(e.g.toLowerCase())} moves</button>
      <div class="mvimg big">${mvimg(e).replace(/^<span class="mvimg">|<\/span>$/g, '')}</div>
      <h3 class="hv mvname">${esc(e.n)}</h3><div class="mtags">${e.m.map(m => `<span>${esc(m)}</span>`).join('')}<span>${esc(e.g)}</span></div>
      <ol class="steps">${e.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`; }
    else { body.innerHTML = `<div class="seg small" role="group" aria-label="Equipment">${GROUPS.map(g => `<button data-g="${g}" class="${g === st.g ? 'on' : ''}">${g}</button>`).join('')}</div>
      <div class="mvgrid">${EX.map((e, i) => [e, i]).filter(([e]) => e.g === st.g).map(([e, i]) => `<button class="mvcard" data-move="${i}">${mvimg(e)}<b>${esc(e.n)}</b><small>${esc(e.m.join(', '))}</small></button>`).join('')}</div>`; }
    body.scrollTop = 0;
  }
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    const g = e.target.closest('[data-g]'); if (g) { st.g = g.dataset.g; draw(); return; }
    const m = e.target.closest('[data-move]'); if (m) { st.sel = Number(m.dataset.move); draw(); return; }
    if (e.target.closest('[data-back]')) { st.sel = null; draw(); } });
  draw();
}

/* ---------------- Food tab ---------------- */
function foodSummaryTile() { const t = totals(meals());
  return `<button class="tile mint ftoday s4" data-tab-go="food" id="go-food"><span class="eyebrow">Food today</span>
  <span class="fsum"><span><b class="hv">${fmt(t.p)}</b> g protein</span><span><b class="hv">${fmt(t.f)}</b> g fiber</span></span><span class="linkish">Open food log →</span></button>`; }
function recents() {
  const seen = new Set(), out = [];
  (state.favs || []).forEach(f => { if (!seen.has(f.label)) { seen.add(f.label); out.push({ ...f, fav: true }); } });
  lastDays(30).reverse().forEach(x => mealsOn(x.key).slice().reverse().forEach(m => { if (!seen.has(m.label) && out.length < 10) { seen.add(m.label); out.push({ label: m.label, protein: m.protein, fiber: m.fiber }); } }));
  return out.slice(0, 6);
}
const isFav = label => (state.favs || []).some(f => f.label === label);
function historyChart() {
  const n = state.hn === 'fiber' ? 'f' : 'p', unit = state.hn === 'fiber' ? 'fiber' : 'protein', days = lastDays(7), sel = state.hday || todayKey();
  const vals = days.map(x => { const m = mealsOn(x.key); return { ...x, v: m.length ? totals(m)[n] : null }; });
  const target = Number(state.targets && state.targets[state.hn || 'protein']) || 0;
  const topV = Math.max(10, target, ...vals.map(x => x.v || 0)) * 1.18, W = 336, H = 176, B = 146, T = 18, step = W / 7, bw = 26;
  const y = v => B - (v / topV) * (B - T);
  const nice = Math.max(5, Math.ceil(topV / 2 / 5) * 5);
  const grid = [nice, nice * 2].filter(g => g < topV).map(g => `<line x1="0" x2="${W}" y1="${y(g)}" y2="${y(g)}" class="cg"/><text x="${W}" y="${y(g) - 4}" class="ct" text-anchor="end">${g} g</text>`).join('');
  const bars = vals.map((x, i) => { const cx = step * i + step / 2, on = x.key === sel, lbl = x.key === todayKey() ? 'Today' : DAYN[x.d.getDay()];
    const h = x.v ? Math.max(3, B - y(x.v)) : 0, r = Math.min(4, h);
    const path = x.v ? `<path class="cb${on ? ' on' : ''}" d="M${cx - bw / 2},${B} V${B - h + r} Q${cx - bw / 2},${B - h} ${cx - bw / 2 + r},${B - h} H${cx + bw / 2 - r} Q${cx + bw / 2},${B - h} ${cx + bw / 2},${B - h + r} V${B} Z"/>` : `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${B}" y2="${B}" class="cnone"/>`;
    const val = on && x.v !== null ? `<text x="${cx}" y="${B - h - 7}" class="cv" text-anchor="middle">${fmt(x.v)} g</text>` : '';
    return `${path}${val}<text x="${cx}" y="${B + 19}" class="cl${on ? ' on' : ''}" text-anchor="middle">${lbl}</text><rect x="${step * i}" y="0" width="${step}" height="${H}" class="chit" data-hday="${x.key}"><title>${lbl}: ${x.v === null ? 'nothing logged' : fmt(x.v) + ' g ' + unit}</title></rect>`; }).join('');
  const tl = target ? `<line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" class="ctarget"/><text x="4" y="${y(target) - 5}" class="ct">Your target ${fmt(target)} g</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} per day, last 7 days">${grid}<line x1="0" x2="${W}" y1="${B}" y2="${B}" class="cbase"/>${tl}${bars}</svg>`;
}
function avgOver(n, key) { const d = lastDays(n).map(x => mealsOn(x.key)).filter(m => m.length); return d.length ? d.reduce((a, m) => a + totals(m)[key], 0) / d.length : null; }
function food() {
  const t = totals(meals()), n = state.hn === 'fiber' ? 'f' : 'p', nn = state.hn === 'fiber' ? 'fiber' : 'protein';
  const a7 = avgOver(7, n), a30 = avgOver(30, n), logged = lastDays(7).filter(x => mealsOn(x.key).length).length;
  const sel = state.hday || todayKey(), selM = mealsOn(sel), selLabel = sel === todayKey() ? 'Today' : (() => { const x = lastDays(30).find(y => y.key === sel); return x ? DAYN[x.d.getDay()] + ' ' + (x.d.getMonth() + 1) + '/' + x.d.getDate() : sel; })();
  const anySample = lastDays(7).some(x => mealsOn(x.key).some(m => m.sample));
  const rec = recents(), tgt = state.targets && state.targets[state.hn || 'protein'];
  return top() + `<div class="bento">
    <div class="s4 title"><h1 class="mix"><span class="lt">Your</span><span class="hv">food<span class="accent">.</span></span></h1></div>
    <div class="tile dark ftot s4"><span class="eyebrow">Today</span>
      <div class="tot"><div><b class="hv">${fmt(t.p)}</b><span>g protein</span></div><div><b class="hv">${fmt(t.f)}</b><span>g fiber</span></div></div>
      <div class="btnrow"><button class="btn sun" data-log="text" id="log-text">${icon('pen')}Log a meal</button><button class="btn ghost" data-finder="protein">${icon('search')}Search</button></div></div>
    <div class="tile paper s4 relog"><span class="eyebrow">Log again in one tap</span>
      ${rec.length ? `<div class="rchips">${rec.map((r, i) => `<button class="rchip${r.fav ? ' fav' : ''}" data-relog="${i}"><span>${r.fav ? '★ ' : ''}${esc(r.label.length > 34 ? r.label.slice(0, 32) + '…' : r.label)}</span><small>${fmt(r.protein)} g</small></button>`).join('')}</div>` : '<p class="status">Meals you log show up here so you can repeat them with one tap.</p>'}</div>
    <div class="tile hist s4"><div class="mrow"><span class="eyebrow">Last 7 days</span>
      <div class="seg small mini" role="group" aria-label="Nutrient"><button data-hn="protein" class="${nn === 'protein' ? 'on' : ''}">Protein</button><button data-hn="fiber" class="${nn === 'fiber' ? 'on' : ''}">Fiber</button></div></div>
      ${historyChart()}
      <div class="hstats"><div><b class="hv">${a7 === null ? '–' : fmt(a7)}</b><span>7-day avg (g)</span></div><div><b class="hv">${a30 === null ? '–' : fmt(a30)}</b><span>30-day avg (g)</span></div><div><b class="hv">${logged}<small>/7</small></b><span>days logged</span></div></div>
      ${anySample ? '<p class="status small">Earlier days show sample meals so you can see how history looks.</p>' : ''}
      <div class="tgt" id="tgt">${tgt ? `<span>Personal ${nn} target: <b>${fmt(Number(tgt))} g</b></span>` : `<span>Got a ${nn} target from your provider?</span>`}<button class="linkbtn" id="target-edit">${tgt ? 'Change' : 'Add it'}</button></div></div>
    <div class="tile s4 daylist"><span class="eyebrow">Meals · ${esc(selLabel)}</span>
      ${selM.length ? selM.map((m, i) => `<div class="drow"><div class="dl">${esc(m.label)}<small>${fmt(m.protein)} g protein · ${fmt(m.fiber)} g fiber${m.sample ? ' · sample' : ''}</small></div>
        <button class="star${isFav(m.label) ? ' on' : ''}" data-fav="${i}" aria-label="${isFav(m.label) ? 'Remove from' : 'Save to'} favorites">${isFav(m.label) ? '★' : '☆'}</button><button class="rm" data-del="${i}" aria-label="Delete ${esc(m.label)}">×</button></div>`).join('') : '<p class="status">Nothing logged this day.</p>'}</div>
    <button class="tile mint finder-tile s4" data-finder="protein" id="open-finder"><span class="eyebrow">Food finder · USDA data</span><span class="ft-q hv">How much protein is in…?</span><span class="ft-search">${icon('search')}<span>Search ${FOODS.length.toLocaleString('en-US')} foods</span></span></button>
    <p class="disclaim s4">Nutrition information only, not diet advice. Your provider can tell you how much protein and fiber is right for you.</p>
  </div>`;
}
function foodClicks(e) {
  const hn = e.target.closest('[data-hn]'); if (hn) { state.hn = hn.dataset.hn; save(); render(); return true; }
  const hd = e.target.closest('[data-hday]'); if (hd) { state.hday = hd.dataset.hday; render(); return true; }
  const rl = e.target.closest('[data-relog]'); if (rl) { const r = recents()[Number(rl.dataset.relog)]; if (r) { addMeal(r.label, r.protein, r.fiber); toast('Logged again!'); } return true; }
  const fv = e.target.closest('[data-fav]'); if (fv) { const m = mealsOn(state.hday || todayKey())[Number(fv.dataset.fav)]; if (m) { state.favs = state.favs || []; const i = state.favs.findIndex(f => f.label === m.label);
    if (i >= 0) state.favs.splice(i, 1); else state.favs.unshift({ label: m.label, protein: m.protein, fiber: m.fiber }); save(); render(); } return true; }
  const dl = e.target.closest('[data-del]'); if (dl) { day(state.hday || todayKey()).meals.splice(Number(dl.dataset.del), 1); save(); render(); return true; }
  const go = e.target.closest('[data-tab-go]'); if (go) { state.tab = go.dataset.tabGo; save(); render(); window.scrollTo(0, 0); return true; }
  if (e.target.closest('#target-edit')) { const box = document.getElementById('tgt'), nn = state.hn === 'fiber' ? 'fiber' : 'protein', cur = (state.targets || {})[nn] || '';
    box.innerHTML = `<label for="target-input">Grams of ${nn} per day</label><input id="target-input" type="number" inputmode="numeric" min="0" max="400" value="${cur}"><button class="btn" id="target-save">Save</button>`;
    document.getElementById('target-input').focus(); return true; }
  if (e.target.closest('#target-save')) { const nn = state.hn === 'fiber' ? 'fiber' : 'protein', v = Number(document.getElementById('target-input').value);
    state.targets = state.targets || {}; if (v > 0 && v <= 400) state.targets[nn] = v; else delete state.targets[nn]; save(); render(); return true; }
  return false;
}

/* ---------------- Food finder ---------------- */
function openFinder(mode) {
  const st = { mode: mode === 'fiber' ? 'fiber' : 'protein', per: 'serving', q: '' };
  const s = sheet(`<header><span class="hv">Food finder</span><button class="x" aria-label="Close">×</button></header>
    <div class="fcontrols">
      <div class="seg" role="group" aria-label="Nutrient"><button data-m="protein">Protein</button><button data-m="fiber">Fiber</button></div>
      <input id="finder-input" type="search" placeholder="Search foods, like chicken or beans" autocomplete="off" aria-label="Search foods">
      <div class="seg small" role="group" aria-label="Compare by"><button data-per="serving">Per serving</button><button data-per="cal">Per 100 calories</button></div>
    </div>
    <div class="foods" id="food-list"></div>
    <div class="fine">Source: USDA Agricultural Research Service, National Nutrient Database for Standard Reference (SR Legacy). Nutrition facts only. Ask your provider how much is right for you.</div>`);
  const list = s.querySelector('#food-list'), inp = s.querySelector('#finder-input');
  const value = (r, i) => st.per === 'cal' ? (r[1] >= 5 ? r[i] / r[1] * 100 : null) : r[i] * r[4] / 100;
  function draw() {
    const i = st.mode === 'fiber' ? 3 : 2, other = i === 2 ? 3 : 2, unit = st.mode === 'fiber' ? 'fiber' : 'protein';
    s.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    s.querySelectorAll('[data-per]').forEach(b => b.classList.toggle('on', b.dataset.per === st.per));
    const q = st.q.trim().toLowerCase(); let items, label;
    if (!q) { items = FOODS.filter(r => r[6] === 1 && value(r, i) !== null).sort((a, b) => value(b, i) - value(a, i)); label = `Staples, most ${unit} first`; }
    else { const t = q.split(/\s+/); items = FOODS.filter(r => t.every(w => r.lc.includes(w))).map(r => [r, (r[6] ? -200 : 0) + (r.lc.startsWith(t[0]) ? 0 : 60) + r[0].length + (/(cooked|raw|roasted|boiled|baked)/.test(r.lc) ? -6 : 0)]).sort((a, b) => a[1] - b[1]).slice(0, 40).map(x => x[0]); label = `${items.length === 40 ? 'Top 40' : items.length} match${items.length === 1 ? '' : 'es'}`; }
    if (!items.length) { list.innerHTML = `<p class="fempty">No foods match “${esc(st.q)}”. Try a simpler word, like “beans” or “yogurt”.</p>`; return; }
    const max = Math.max(...items.map(r => value(r, i) || 0), 1);
    list.innerHTML = `<div class="flabel">${label}</div>` + items.map(r => { const v = value(r, i), g = r[4], cal = Math.round(r[1] * g / 100), ov = r[other] * g / 100;
      return `<div class="food"><div class="fn">${esc(r[0])}<small>${esc(r[5])}${r[5] === '100 g' ? '' : ` (${fmt(g)} g)`} · ${cal} cal · ${fmt(ov)} g ${i === 2 ? 'fiber' : 'protein'}</small></div>
      <div class="fv"><b class="hv">${v === null ? '–' : fmt(v)}</b><span>g ${unit}${st.per === 'cal' ? ' / 100 cal' : ''}</span></div>
      <button class="addbtn" data-add="${r.ix}" aria-label="Add one serving of ${esc(r[0])} to today’s food log">+</button>
      <div class="fbar"><i style="width:${v === null ? 0 : Math.max(2, v / max * 100)}%"></i></div></div>`; }).join('');
  }
  let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = inp.value; draw(); list.scrollTop = 0; }, 120); });
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    const m = e.target.closest('[data-m]'); if (m) { st.mode = m.dataset.m; draw(); }
    const p = e.target.closest('[data-per]'); if (p) { st.per = p.dataset.per; draw(); }
    const a = e.target.closest('[data-add]'); if (a) { const r = FOODS[Number(a.dataset.add)]; if (r) { addMeal(`${r[0]} (${r[5]})`, r[2] * r[4] / 100, r[3] * r[4] / 100); toast('Added to today’s log'); } } });
  draw();
}

/* ---------------- Meal logger ---------------- */
async function photoToBase64(file) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) throw new Error('That photo didn’t work. Try a different JPG or PNG.');
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}
// Re-check each AI item against the USDA data on the phone; use USDA numbers when the food matches.
function usdaCheck(x) {
  if (!(x.grams > 0)) return x;
  const raw = String(x.name).toLowerCase();
  if (/\b(with|and)\b|&|\+/.test(raw)) return x;            // mixed dishes: keep the AI estimate
  const name = raw.replace(/[,;]/g, ' ');
  const m = parseMeal(FOODS, `${Math.round(x.grams)} g ${name}`, true).matched[0];
  if (!m) return x;
  const head = name.split(/\s+/).find(w => w && !/^(cooked|steamed|grilled|roasted|baked|boiled|raw|fried|sauteed|fresh|plain|scrambled|chopped|sliced)$/.test(w)) || '';
  const sameFood = m.name.toLowerCase().startsWith(head.replace(/(?<!s)s$/, '').slice(0, 5));
  const close = (a, b) => Math.abs(a - b) <= Math.max(3, 0.4 * Math.max(a, b));
  return sameFood && close(m.protein, x.protein) ? { ...x, protein: m.protein, fiber: m.fiber, source: 'usda', usda: m.name } : x;
}
function openLogger(mode) {
  const s = sheet(`<header><span class="hv">Log a meal</span><button class="x" aria-label="Close">×</button></header>
    <div class="logger">
      <label for="meal-text" class="eyebrow">What did you eat?</label>
      <textarea id="meal-text" placeholder="e.g. 2 scrambled eggs, 1 slice whole-wheat toast, black coffee"></textarea>
      <div class="btnrow"><label class="btn alt" id="photo-label" for="meal-photo">${icon('camera')}Add a photo</label><input type="file" id="meal-photo" accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
        <button class="btn" id="meal-estimate">Estimate protein &amp; fiber</button></div>
      <div class="photo-prev" id="photo-prev" hidden></div>
      <div class="est" id="est"></div>
    </div>
    <div class="fine">Meals are matched to USDA data on your phone. Portions are approximate. Nutrition facts only, not diet advice.</div>`);
  const ta = s.querySelector('#meal-text'), file = s.querySelector('#meal-photo'), plabel = s.querySelector('#photo-label'), prev = s.querySelector('#photo-prev'), est = s.querySelector('#est'), go = s.querySelector('#meal-estimate');
  let photo = null, busy = false, pending = null;
  const aiOn = false; // photo + AI estimates retired: typed meals match USDA data on the phone
  if (!aiOn) { plabel.hidden = true; est.innerHTML = '<p class="status">List foods with amounts, like “2 eggs, 1 cup greek yogurt”.</p>'; }
  if (mode === 'photo' && aiOn) file.click(); else ta.focus();
  file.addEventListener('change', () => { photo = file.files && file.files[0] || null; if (photo) { const u = URL.createObjectURL(photo); prev.hidden = false; prev.innerHTML = `<img src="${u}" alt="Your meal photo"><span>Photo added</span><button class="linkbtn" data-clear="1">Remove</button>`; } });
  function renderEst() {
    const missHtml = pending && pending.missed && pending.missed.length ? `<div class="miss"><p class="status">Couldn’t match: ${pending.missed.map(esc).join(', ')}</p>${aiOn ? '<button class="btn alt" id="meal-fill">Fill in the rest with AI</button>' : '<p class="status">Try simpler words, or add them from the Food finder.</p>'}</div>` : '';
    if (!pending || !pending.items.length) { est.innerHTML = missHtml || `<p class="status">${esc(pending && pending.note || 'No foods found. Try listing foods with amounts, like “2 eggs, 1 cup greek yogurt”.')}</p>`; return; }
    const P = pending.items.reduce((a, x) => a + x.protein, 0), F = pending.items.reduce((a, x) => a + x.fiber, 0);
    est.innerHTML = `<div class="flabel">Estimate</div>${pending.items.map((x, i) => `<div class="est-row"><div>${esc(x.name)}<small>${esc(x.amount)}${x.source === 'usda' ? '' : ' · <span class="tag-est">rough estimate</span>'}</small></div>
      <div class="nums"><b>${fmt(x.protein)}</b> g P<br><b>${fmt(x.fiber)}</b> g F</div><button class="rm" data-rm="${i}" aria-label="Remove ${esc(x.name)}">×</button></div>`).join('')}
      <div class="est-tot"><span class="hv">${fmt(P)} g protein · ${fmt(F)} g fiber</span></div>
      ${missHtml}${pending.note ? `<p class="status">${esc(pending.note)}</p>` : ''}
      <button class="btn" id="meal-save">Log this meal</button>`;
  }
  async function estimate(fill) {
    const text = ta.value.trim(); if (!text && !photo) { est.innerHTML = '<p class="status">Type what you ate or add a photo first.</p>'; return; }
    if (!photo && !fill) { const r = parseMeal(FOODS, text);
      if (r.matched.length || !aiOn) { pending = { items: r.matched, missed: r.missed, note: r.matched.length ? 'Matched to USDA data on your phone. No AI used.' : '', text }; renderEst(); return; } }
    if (!aiOn || busy) return;
    const aiText = fill && pending && pending.missed && pending.missed.length ? pending.missed.join(', ') : text;
    busy = true; go.disabled = true; est.innerHTML = '<p class="status">Thinking…</p>';
    try {
      const body = { text: aiText };
      if (photo && !fill) { body.image = await photoToBase64(photo); body.mediaType = 'image/jpeg'; }
      const r = await cloud.api('/api/estimate', body);
      if (r.limit) { est.innerHTML = `<p class="status">${esc(r.note)}</p>`; return; }
      const items = (r.items || []).map(usdaCheck);
      if (fill && pending) pending = { items: pending.items.concat(items), missed: [], note: 'Filled in with AI. ' + (r.note || ''), text };
      else pending = { items, missed: [], note: r.note, text };
      renderEst();
    } catch (err) { est.innerHTML = `<p class="status">${esc(err.message)}</p>`; }
    finally { busy = false; go.disabled = false; }
  }
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    if (e.target.closest('#meal-estimate')) { estimate(false); return; }
    if (e.target.closest('#meal-fill')) { estimate(true); return; }
    if (e.target.closest('[data-clear]')) { photo = null; file.value = ''; prev.hidden = true; prev.innerHTML = ''; return; }
    const rm = e.target.closest('[data-rm]'); if (rm && pending) { pending.items.splice(Number(rm.dataset.rm), 1); renderEst(); return; }
    if (e.target.closest('#meal-save') && pending && pending.items.length) { const P = pending.items.reduce((a, x) => a + x.protein, 0), F = pending.items.reduce((a, x) => a + x.fiber, 0);
      addMeal(pending.text || pending.items.map(x => x.name).join(', '), P, F, pending.items); s.close(); toast('Meal logged!'); } });
}

/* ---------------- Coach ---------------- */
function demoReply(q) {
  if (/protein|breakfast|meal|snack|eat|recipe/i.test(q)) return 'A few easy high-protein ideas people like: Greek yogurt with berries, eggs with cottage cheese, a protein shake with a banana, or a sheet pan of chicken and vegetables for the week.';
  if (/water|hydrat|drink/i.test(q)) return 'Try anchoring water to things you already do: a glass when you wake up, one with every meal, and a bottle in the car.';
  if (/workout|exercise|strength|gym|walk|move/i.test(q)) return 'Start simple: a 20-minute walk and two short strength sessions a week is a common starting point. Ask your provider or a trainer what fits you.';
  return 'I can help with habits, meal ideas, movement, and staying consistent. (Demo mode: the real AI coach turns on once the app is connected.)';
}
function coachContext() {
  const c = counts();
  const hab = HABITS.map(h => `${h.name}: ${Math.min(c[h.id] || 0, h.goal)} of ${h.goal} ${h.unit}`).join('; ');
  const wk = lastDays(7).map(x => { const m = mealsOn(x.key); if (!m.length) return null; const t = totals(m); return `${x.key === todayKey() ? 'today' : DAYN[x.d.getDay()]}: ${fmt(t.p)} g protein, ${fmt(t.f)} g fiber`; }).filter(Boolean).join('; ');
  return `Today's habits: ${hab}. Current streak: ${streak()} days. Food log totals, last 7 days: ${wk || 'nothing logged'}. Today's meals: ${meals().map(m => m.label).join('; ') || 'none yet'}.`;
}
function openCoach() {
  const s = sheet(`<header><span class="hv">Your coach</span><button class="x" aria-label="Close">×</button></header>
    <div class="msgs" id="msgs"><div class="msg bot">Hi ${esc(firstName())}. I can help with meal ideas, habits, and staying on track. What’s on your mind?</div></div>
    <div class="suggest">${['High-protein breakfast?', 'Feeling unmotivated', 'Is my dose right?', 'Easy fiber ideas'].map(x => `<button class="chip" data-q="${x}">${x}</button>`).join('')}</div>
    <form class="ask" id="ask"><input id="coach-input" placeholder="Ask about habits or meals" autocomplete="off" maxlength="1000"><button type="submit">Send</button></form>
    <div class="fine">AI coach for habits and general wellness. Medical questions go to your provider.</div>`, 'panel');
  const msgs = s.querySelector('#msgs'), inp = s.querySelector('#coach-input');
  const turns = []; let busy = false;
  const add = (cls, html) => { msgs.insertAdjacentHTML('beforeend', `<div class="msg ${cls}">${html}</div>`); msgs.scrollTop = msgs.scrollHeight; return msgs.lastElementChild; };
  async function send(q) {
    q = q.trim(); if (!q || busy) return; add('me', esc(q));
    const pre = preFilter(q); if (pre) { add('bot route', esc(pre.text)); return; }
    if (DEMO) { add('bot', esc(demoReply(q))); return; }
    turns.push({ role: 'user', content: q.slice(0, 1000) }); busy = true;
    const typing = add('bot typing', '<span></span><span></span><span></span>');
    try {
      const r = await cloud.api('/api/coach', { messages: turns.slice(-8), context: coachContext() });
      typing.remove();
      if (r.kind === 'ok') { turns.push({ role: 'assistant', content: r.text }); add('bot', esc(r.text)); if (r.left <= 5 && r.left > 0) add('bot note', `${r.left} coach message${r.left === 1 ? '' : 's'} left today.`); }
      else if (r.kind === 'limit') { turns.pop(); add('bot note', esc(r.text)); }
      else { turns.push({ role: 'assistant', content: r.text || PROVIDER_TEXT }); add('bot route', esc(r.text || PROVIDER_TEXT)); }
    } catch (err) { typing.remove(); turns.pop(); add('bot note', esc(err.message)); }
    finally { busy = false; }
  }
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) s.close(); const q = e.target.closest('[data-q]'); if (q) send(q.dataset.q); });
  s.querySelector('#ask').addEventListener('submit', e => { e.preventDefault(); send(inp.value); inp.value = ''; });
  setTimeout(() => inp.focus(), 50);
}

/* ---------------- Account ---------------- */
function openAccount() {
  const s = sheet(`<header><span class="hv">Account</span><button class="x" aria-label="Close">×</button></header>
    <div class="mvbody acct">
      ${DEMO ? '<p class="status">You’re in demo mode. Nothing here is saved to an account.</p>' : `
      <div class="tile"><span class="eyebrow">Signed in as</span><b>${esc(user?.email || '')}</b></div>
      <label class="eyebrow" for="acct-name">First name</label>
      <div class="btnrow"><input id="acct-name" class="inp" maxlength="40" value="${esc(profile?.first_name || '')}"><button class="btn" id="acct-save">Save</button></div>
      <button class="btn alt" id="acct-signout">Sign out</button>`}
      <p class="status"><a href="/privacy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms</a></p>
      ${DEMO ? '' : `<div class="danger"><p class="status">Delete your account and all your data. This can’t be undone, and any paid membership is cancelled.</p>
        <button class="btn alt" id="acct-del">Delete my account</button><div id="acct-confirm"></div></div>`}
    </div>`);
  s.addEventListener('click', async e => {
    if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    if (e.target.closest('#acct-save')) { const v = s.querySelector('#acct-name').value.trim().slice(0, 40); if (!v) return; try { await cloud.saveProfile(user.id, { first_name: v }); profile.first_name = v; toast('Saved'); render(); } catch { toast('Couldn’t save. Try again.'); } return; }
    if (e.target.closest('#acct-signout')) { await cloud.flushSave(); await cloud.signOut(); location.reload(); return; }
    if (e.target.closest('#acct-del')) { s.querySelector('#acct-confirm').innerHTML = '<p class="status">Type DELETE to confirm.</p><div class="btnrow"><input id="del-word" class="inp" autocomplete="off"><button class="btn" id="del-go">Delete forever</button></div>'; return; }
    if (e.target.closest('#del-go')) { if (s.querySelector('#del-word').value.trim() !== 'DELETE') { toast('Type DELETE to confirm.'); return; }
      try { await cloud.api('/api/delete-account'); try { localStorage.removeItem(cacheKey()); } catch {} await cloud.signOut(); location.reload(); } catch (err) { toast(err.message); } }
  });
}

/* ---------------- Admin ---------------- */
async function openAdmin() {
  const s = sheet(`<header><span class="hv">Admin</span><button class="x" aria-label="Close">×</button></header><div class="mvbody" id="adm"><p class="status">Loading…</p></div>`);
  const box = s.querySelector('#adm');
  async function load() {
    try {
      const d = await cloud.api('/api/admin', null, 'GET');
      const gname = id => (d.groups.find(g => g.id === id) || {}).name || '—';
      const cname = id => ((d.concierges || []).find(c => c.id === id) || {}).name || '—';
      box.innerHTML = `
        ${d.teams === false ? '' : `<p class="status">${d.scope === 'all' ? 'You see every team.' : 'You see your team only.'}</p>`}
        ${d.scope === 'all' && d.teams !== false ? `<div class="flabel">Concierges (${d.concierges.length})</div>
        ${d.concierges.map(c => `<div class="tile adm-group"><b>${esc(c.name)}${c.is_house ? ' · house team' : ''}</b><small>Join link: ${esc(location.host.replace(/^www\./, ''))}/j/${esc(c.slug)} · ${c.members} members${c.login_email ? ' · login ' + esc(c.login_email) : ' · no login linked'}</small></div>`).join('')}
        <div class="tile adm-group"><b>Add a concierge</b>
          <input class="inp" id="cn-name" maxlength="60" placeholder="Full name (shown to their members)">
          <input class="inp" id="cn-slug" maxlength="30" placeholder="Link name, e.g. sarah" autocapitalize="none" autocorrect="off">
          <input class="inp" id="cn-email" type="email" placeholder="Their login email (they sign up first)" autocapitalize="none">
          <input class="inp" id="cn-url" placeholder="Contact link: sms:+15555551234, mailto:…, or https://…" autocapitalize="none">
          <button class="btn" id="cn-add">Add concierge</button></div>` : ''}
        ${d.self ? `<div class="flabel">Your contact button</div><div class="tile adm-group"><small>Your join link: ${esc(location.host.replace(/^www\./, ''))}/j/${esc(d.self.slug)}</small>
          <input class="inp" id="me-url" value="${esc(d.self.contact_url || '')}" placeholder="sms:+15555551234, mailto:…, or https://…" autocapitalize="none">
          <input class="inp" id="me-label" maxlength="40" value="${esc(d.self.contact_label || '')}" placeholder="Button text, e.g. Text Sarah">
          <button class="btn alt" id="me-save">Save</button></div>` : ''}
        <div class="flabel">Flagged coach replies (${d.flags.length})</div>
        ${d.flags.length ? d.flags.map(f => `<div class="tile adm-flag"><small>${new Date(f.created_at).toLocaleString()}</small><p><b>Asked:</b> ${esc(f.question)}</p><p><b>Blocked reply:</b> ${esc(f.reply)}</p><p><b>Why:</b> ${esc(f.reason)}</p><button class="btn alt" data-review="${f.id}">Mark reviewed</button></div>`).join('') : '<p class="status">Nothing to review.</p>'}
        <div class="flabel">Groups</div>
        ${d.groups.map(g => `<div class="tile adm-group"><b>${esc(g.name)}</b><input class="inp" data-gcall="${g.id}" value="${esc(g.next_call || '')}" placeholder="Next call (e.g. Thursday 7 pm)"><input class="inp" data-glink="${g.id}" value="${esc(g.call_link || '')}" placeholder="Call link (Zoom, etc.)"><button class="btn alt" data-gsave="${g.id}">Save</button></div>`).join('')}
        ${(() => { const w = d.members.filter(waiting), rest = d.members.filter(x => !waiting(x));
          const row = m => `<div class="tile adm-mem ${waiting(m) ? 'waiting' : ''}"><b>${esc(m.first_name || '(no name)')}${waiting(m) ? ` <span class="pill-k sm">Requested ${esc(PACKAGES[m.requested_tier].name)}${m.requested_at ? ' · ' + ago(m.requested_at) + ' ago' : ''}</span>` : ''}</b><small>${esc(m.email)}${m.circle_active ? ' · ' + NAMES.paid + ' subscriber' : ''} · group: ${esc(gname(m.group_id))}${d.scope === 'all' && d.teams !== false ? ' · team: ' + esc(cname(m.concierge_id)) : ''}</small>
          <label class="adm-pkg">Package <select data-tier="${m.id}" aria-label="Package for ${esc(m.first_name || m.email)}">${Object.keys(TIERS).map(k => `<option value="${k}" ${m.tier === k ? 'selected' : ''}>${TIERS[k].name}</option>`).join('')}</select></label>${m.is_admin ? '<small class="adm-note">Admin</small>' : `<button class="linkbtn danger adm-del" data-del-member="${m.id}">Remove member</button>`}</div>`;
          return (w.length ? `<div class="flabel">Waiting on a package (${w.length}) · set their package below</div>${w.map(row).join('')}` : '') + `<div class="flabel">Members (${rest.length})</div>${rest.map(row).join('')}`; })()}`;
    } catch (err) { box.innerHTML = `<p class="status">${esc(err.message)}</p>`; }
  }
  s.addEventListener('click', async e => {
    if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    const dm = e.target.closest('[data-del-member]'); if (dm) { if (!confirmTap(dm)) return; dm.disabled = true; await cloud.api('/api/admin', { action: 'deleteMember', id: dm.dataset.delMember }).then(() => toast('Member removed')).catch(err => toast(err.message)); load(); return; }
    const r = e.target.closest('[data-review]'); if (r) { await cloud.api('/api/admin', { action: 'reviewFlag', id: Number(r.dataset.review) }).catch(err => toast(err.message)); load(); return; }
    if (e.target.closest('#cn-add')) { const v = id => s.querySelector(id).value.trim(); await cloud.api('/api/admin', { action: 'addConcierge', name: v('#cn-name'), slug: v('#cn-slug').toLowerCase(), email: v('#cn-email').toLowerCase(), contactUrl: v('#cn-url') }).then(() => { toast('Concierge added'); load(); }).catch(err => toast(err.message)); return; }
    if (e.target.closest('#me-save')) { await cloud.api('/api/admin', { action: 'setContact', contactUrl: s.querySelector('#me-url').value.trim(), contactLabel: s.querySelector('#me-label').value.trim() }).then(() => toast('Saved')).catch(err => toast(err.message)); return; }
    const g = e.target.closest('[data-gsave]'); if (g) { const id = g.dataset.gsave; await cloud.api('/api/admin', { action: 'setGroupCall', id, nextCall: s.querySelector(`[data-gcall="${id}"]`).value, callLink: s.querySelector(`[data-glink="${id}"]`).value }).then(() => toast('Saved')).catch(err => toast(err.message)); }
  });
  s.addEventListener('change', async e => { const t = e.target.closest('[data-tier]'); if (t) { await cloud.api('/api/admin', { action: 'setTier', id: t.dataset.tier, tier: t.value }).then(() => toast('Package updated')).catch(err => toast(err.message)); load(); } });
  load();
}


/* ---------------- Install-to-home-screen nudge (shown before sign-up) ---------------- */
let installEvt = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-native-install]').forEach(b => b.hidden = false); });
function platform() {
  const ua = navigator.userAgent || '';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|Snapchat|Line\/|LinkedInApp|Twitter/i.test(ua);
  return { standalone, ios, android, inApp, mobile: ios || android };
}
const SHARE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function installTile(p) {
  let steps;
  if (p.inApp) steps = `<p>You opened this inside another app, which can’t install it. Tap the <b>•••</b> or <b>⋮</b> menu and choose <b>Open in ${p.ios ? 'Safari' : 'browser'}</b>, then come back to this screen.</p>`;
  else if (p.ios) steps = `<ol class="steps"><li>Tap <b>Share</b> ${SHARE_ICON} at the bottom of Safari. On newer iPhones it’s inside the <b>•••</b> menu.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>, then open <b>LongevityCo</b> from your home screen and sign up there.</li></ol>`;
  else steps = `<button class="btn sun" type="button" data-native-install ${installEvt ? '' : 'hidden'}>Install the app</button>
    <ol class="steps"><li>Tap the <b>⋮</b> menu at the top right of Chrome.</li><li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li><li>Open <b>LongevityCo</b> from your home screen and sign up there.</li></ol>`;
  return `<div class="tile install-tile"><span class="eyebrow">Step 1 · Before you sign up</span>
    <h2 class="hv onb-h">Put it on your home screen.</h2>
    <p>It opens full screen like a regular app, and you stay signed in. If you sign up here in the browser first, you’ll have to sign in again inside the app.</p>
    ${steps}
    <button class="linkbtn" type="button" id="skip-install">Continue in the browser instead</button></div>`;
}

/* ---------------- Desktop landing (the app is phone-first) ---------------- */
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR code for ${esc(text)}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0f3b33"/></svg>`;
}
function desktopScreen() {
  tabsEl.hidden = true; uid = 0;
  document.body.classList.add('desk-mode');
  const site = /longevityconcierge\.app$/.test(location.hostname) || /vercel\.app$/.test(location.hostname) ? 'https://longevityconcierge.app' : location.origin;
  const url = site.replace(/^https?:\/\/(www\.)?/, '');
  app.innerHTML = `<div class="desk">
    <header class="top">${wordmark()}</header>
    <div class="desk-grid">
      <div class="tile hero halftone desk-hero"><canvas data-scene="dawn"></canvas>
        <div class="txt"><span class="eyebrow">Your wellness concierge</span><h1 class="mix"><span class="lt">Small habits.</span><span class="hv">Big life.</span></h1></div></div>
      <div class="tile desk-qr"><span class="eyebrow">Made for your phone</span>
        <div class="qr">${qrSvg(site + (REF ? '/j/' + REF : '/'))}</div>
        <p class="desk-scan">Scan with your phone camera</p>
        <p class="desk-or">or type <b>${esc(url)}</b> into your phone’s browser</p></div>
      <div class="tile desk-feat"><b class="hv">Daily habits</b><p>Protein, water, fiber, movement and sleep, checked off in seconds.</p></div>
      <div class="tile desk-feat butter"><b class="hv">Food log</b><p>Type what you ate or snap a photo. Totals use USDA nutrition data.</p></div>
      <div class="tile desk-feat mint"><b class="hv">Habit coach</b><p>Friendly nudges and simple meal ideas when you need them.</p></div>
      <div class="tile desk-feat lilac"><b class="hv">Check-ins</b><p>Challenges, cheers and people on the same path.</p></div>
      <div class="tile desk-steps"><span class="eyebrow">How to get the app</span>
        <ol class="steps"><li>Open the link on your phone.</li><li>Add it to your home screen. The page shows you how on iPhone and Android.</li><li>Open <b>LongevityCo</b> from your home screen and sign up.</li></ol></div>
    </div>
    <p class="disclaim">General wellness education and coordination, not medical care. <a href="/privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms</a> · <button class="linkbtn" type="button" id="desk-continue">Already a member? Sign in on this computer</button></p>
  </div>`;
  requestAnimationFrame(paintAll);
  document.getElementById('desk-continue').onclick = () => { try { sessionStorage.setItem('lc-desktop-ok', '1'); } catch { /* storage blocked */ } document.body.classList.remove('desk-mode'); authScreen(); };
}
function isDesktop() {
  const p = platform();
  return !p.mobile && matchMedia('(pointer: fine)').matches && innerWidth >= 900;
}
/* ---------------- Sign-in + onboarding ---------------- */
function authScreen(msg = '') {
  let deskOk = false; try { deskOk = sessionStorage.getItem('lc-desktop-ok') === '1'; } catch { /* storage blocked */ }
  if (!msg && !deskOk && isDesktop()) return desktopScreen();
  tabsEl.hidden = true; uid = 0;
  const p = platform();
  let skipped = false; try { skipped = sessionStorage.getItem('lc-skip-install') === '1'; } catch { /* storage blocked */ }
  const nudge = p.mobile && !p.standalone && !skipped && !msg;
  app.innerHTML = `<div class="auth"><header class="top">${wordmark()}</header>
    <div class="tile hero halftone auth-hero"><canvas data-scene="dawn"></canvas><div class="txt"><span class="eyebrow">Members</span><h1 class="mix"><span class="lt">Small habits.</span><span class="hv">Big life.</span></h1></div><button class="watch" type="button" id="watch-promo">${icon('play')}Watch the 18-second tour</button></div>
    ${nudge ? installTile(p) : ''}
    <form class="tile auth-form" id="auth-form" ${nudge ? 'hidden' : ''}><label class="eyebrow" for="auth-email">Sign in or create your account</label>
      <input id="auth-email" class="inp" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required>
      <button class="btn sun" type="submit">Email me a sign-in code</button>
      <p class="status" id="team-line" hidden></p>
      <p class="status">No password needed. We’ll email you a link and a sign-in code.</p>${msg ? `<p class="status err">${esc(msg)}</p>` : ''}</form>
    <p class="disclaim">General wellness education and coordination, not medical care. <a href="/privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms</a></p></div>`;
  requestAnimationFrame(paintAll);
  document.getElementById('watch-promo').onclick = () => playVideo('promo');
  let seenPromo = false; try { seenPromo = localStorage.getItem('lc-promo-seen') === '1'; } catch { /* storage blocked */ }
  if (!seenPromo && !msg && !quietMode()) { try { localStorage.setItem('lc-promo-seen', '1'); } catch { /* storage blocked */ } playVideo('promo'); }
  const skip = document.getElementById('skip-install');
  if (skip) skip.onclick = () => { try { sessionStorage.setItem('lc-skip-install', '1'); } catch { /* storage blocked */ } document.querySelector('.install-tile').remove(); document.getElementById('auth-form').hidden = false; };
  const nat = document.querySelector('[data-native-install]');
  if (nat) nat.onclick = async () => { if (!installEvt) return; installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; nat.hidden = true; if (r?.outcome === 'accepted') toast('Installed. Open LongevityCo from your home screen.'); };
  if (REF) cloud.conciergeName(REF).then(n => { const el = document.getElementById('team-line'); if (n && el) { el.innerHTML = `You’re joining <b>${esc(n)}</b>’s team.`; el.hidden = false; } }).catch(() => {});
  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault(); const email = document.getElementById('auth-email').value.trim().toLowerCase(); if (!email) return;
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
    try { await cloud.sendLink(email, REF); codeScreen(email); }
    catch (err) { authScreen(/rate/i.test(err.message) ? 'Too many emails sent. Wait a minute and try again.' : err.message); }
  });
}
function codeScreen(email, msg = '') {
  const f = document.querySelector('.auth-form') || app;
  f.outerHTML = `<form class="tile auth-form" id="code-form"><span class="eyebrow">Check your email</span>
    <p>We sent a sign-in link and a code to <b>${esc(email)}</b>. ${platform().standalone ? 'Type the code here. The link would open your browser instead of the app.' : 'Tap the link, or type the code here.'}</p>
    <input id="auth-code" class="inp code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••••">
    <button class="btn sun" type="submit">Sign in</button>
    <button class="linkbtn" type="button" id="auth-back">Use a different email</button>${msg ? `<p class="status err">${esc(msg)}</p>` : ''}</form>`;
  document.getElementById('auth-code').focus();
  document.getElementById('auth-back').onclick = () => authScreen();
  document.getElementById('code-form').addEventListener('submit', async e => {
    e.preventDefault(); const form = e.currentTarget; if (form.dataset.busy) return;
    const code = document.getElementById('auth-code').value.trim(); const clean = code.replace(/\D/g, ''); if (clean.length < 6) return;
    form.dataset.busy = '1'; const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Signing in…';
    try { const session = await cloud.verifyCode(email, clean); if (session) startSession(session); }
    catch {
      if (await cloud.getSession().catch(() => null)) return; // already signed in (e.g. the email link was tapped)
      if (document.getElementById('code-form')) codeScreen(email, 'That code didn’t work. Check the newest email, or request a new one.');
    }
  });
}
function onboarding() {
  tabsEl.hidden = true; uid = 0;
  app.innerHTML = `<div class="auth"><header class="top">${wordmark()}</header>
    <form class="tile auth-form" id="onb"><span class="eyebrow">Welcome</span><h2 class="hv onb-h">Let’s get you set up.</h2>
      <label class="eyebrow" for="onb-name">Your first name</label>
      <input id="onb-name" class="inp" maxlength="40" autocomplete="given-name" required value="${esc(profile?.first_name || '')}">
      <label class="check"><input type="checkbox" id="onb-ack" required> <span>I understand Longevity Concierge provides general wellness education and coordination, not medical care. I’ll bring medical, medication and dosing questions to my licensed provider.</span></label>
      <label class="check"><input type="checkbox" id="onb-terms" required> <span>I agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
      <button class="btn sun" type="submit">Start</button></form></div>`;
  document.getElementById('onb').addEventListener('submit', async e => {
    e.preventDefault(); const name = document.getElementById('onb-name').value.trim().slice(0, 40);
    try { const patch = { first_name: name, accepted_at: new Date().toISOString() }; await cloud.saveProfile(user.id, patch); Object.assign(profile, patch); render(); maybeExplainer(); }
    catch { toast('Couldn’t save. Check your connection and try again.'); }
  });
}



/* ---------------- Articles: reader + admin editor ---------------- */
let articles = null;
const isAdmin = () => !!profile?.is_admin;
async function loadArticles() {
  if (DEMO) { articles = SEED_ARTICLES; return; }
  articles = SEED_ARTICLES; // show starter set instantly, then swap in live
  try { articles = await cloud.loadArticles(); if (state.tab === 'learn') render(); } catch (e) { console.error(e); }
}
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
function md(text) {
  const out = []; let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.join('')}</${list.t}>`); list = null; } };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let mm;
    if ((mm = line.match(/^##\s+(.*)/))) { flush(); out.push(`<h3>${inline(mm[1])}</h3>`); }
    else if ((mm = line.match(/^[-•]\s+(.*)/))) { if (!list || list.t !== 'ul') { flush(); list = { t: 'ul', items: [] }; } list.items.push(`<li>${inline(mm[1])}</li>`); }
    else if ((mm = line.match(/^\d+[.)]\s+(.*)/))) { if (!list || list.t !== 'ol') { flush(); list = { t: 'ol', items: [] }; } list.items.push(`<li>${inline(mm[1])}</li>`); }
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush(); return out.join('');
}
function openArticle(id) {
  const a = (articles || SEED_ARTICLES).find(x => String(x.id) === String(id)); if (!a) return;
  const src = (a.sources || '').split('\n').filter(Boolean);
  const s = sheet(`<header><span class="eyebrow">${esc(a.cat)} · ${a.minutes} min read${a.published ? '' : ' · Draft'}</span><button class="x" aria-label="Close">×</button></header>
    <article class="mvbody art"><h2 class="hv">${esc(a.title)}</h2>${a.summary ? `<p class="lede">${inline(a.summary)}</p>` : ''}${md(a.body)}
      ${src.length ? `<div class="srcs"><span class="eyebrow">Sources</span><ul>${src.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>` : ''}
      <p class="disclaim">General wellness education, not medical advice. Talk with your provider before changing your nutrition, exercise or medications.</p>
      ${isAdmin() && !DEMO ? `<button class="btn alt" data-edit-article="${esc(a.id)}">${icon('pen')}Edit article</button>` : ''}</article>`);
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    if (e.target.closest('[data-edit-article]')) { s.close(); setTimeout(() => editArticle(a), 280); } });
}
const ART_CATS = ['Protein', 'Strength', 'Nutrition', 'Mindset', 'Provider', 'Sleep'];
function editArticle(a = {}) {
  const isNew = !a.id;
  const s = sheet(`<header><span class="hv">${isNew ? 'New article' : 'Edit article'}</span><button class="x" aria-label="Close">×</button></header>
    <form class="mvbody adm-form" id="art-form">
      <label>Title<input class="inp" name="title" maxlength="120" required value="${esc(a.title || '')}"></label>
      <div class="row2"><label>Category<select class="inp" name="cat">${ART_CATS.map(c => `<option ${c === (a.cat || 'Nutrition') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Minutes<input class="inp" name="minutes" type="number" min="1" max="30" value="${a.minutes || 4}"></label></div>
      <label>One-line summary<input class="inp" name="summary" maxlength="240" value="${esc(a.summary || '')}"></label>
      <label>Article<textarea class="inp tall" name="body" required placeholder="Write here. Start a line with ## for a heading, - for a bullet, 1. for a numbered list. Wrap words in **double stars** for bold.">${esc(a.body || '')}</textarea></label>
      <label>Sources (one per line)<textarea class="inp" name="sources" rows="3">${esc(a.sources || '')}</textarea></label>
      <div class="row2"><label>Order (lower = first)<input class="inp" name="sort" type="number" value="${a.sort ?? 100}"></label>
        <label class="check"><input type="checkbox" name="published" ${a.published ? 'checked' : ''}> <span>Published (members can see it)</span></label></div>
      <p class="status">Keep it general wellness: no dosing, no promises to treat or cure, no medication claims.</p>
      <div class="btnrow"><button class="btn sun" type="submit">Save</button><button class="btn alt" type="button" data-preview="1">Preview</button>${isNew ? '' : '<button class="btn ghost danger" type="button" data-del="1">Delete</button>'}</div>
    </form>`);
  const f = s.querySelector('#art-form');
  const read = () => { const d = Object.fromEntries(new FormData(f)); return { id: a.id, title: d.title.trim(), cat: d.cat, minutes: +d.minutes || 4, icon: a.icon || ({ Protein: 'protein', Strength: 'move', Nutrition: 'fiber', Mindset: 'sleep', Provider: 'ask', Sleep: 'sleep' }[d.cat]), summary: d.summary.trim(), body: d.body, sources: d.sources.trim(), sort: +d.sort || 100, published: !!d.published }; };
  s.addEventListener('click', async e => {
    if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    if (e.target.closest('[data-preview]')) { const p = read(); const pv = sheet(`<header><span class="eyebrow">Preview</span><button class="x" aria-label="Close">×</button></header><article class="mvbody art"><h2 class="hv">${esc(p.title)}</h2>${p.summary ? `<p class="lede">${inline(p.summary)}</p>` : ''}${md(p.body)}</article>`); pv.addEventListener('click', ev => { if (ev.target === pv || ev.target.closest('.x')) pv.close(); }); }
    if (e.target.closest('[data-del]')) { if (!confirmTap(e.target.closest('[data-del]'))) return; try { await cloud.deleteArticle(a.id); articles = articles.filter(x => x.id !== a.id); s.close(); render(); toast('Article deleted'); } catch (err) { toast(err.message); } }
  });
  f.addEventListener('submit', async e => { e.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Saving…';
    try { const saved = await cloud.saveArticle(read()); articles = [...(articles || []).filter(x => x.id !== saved.id), saved].sort((x, y) => x.sort - y.sort); s.close(); state.tab = 'learn'; render(); toast(saved.published ? 'Published' : 'Saved as draft'); }
    catch (err) { btn.disabled = false; btn.textContent = 'Save'; toast(err.message); } });
}
// Two-tap confirm without browser dialogs.
function confirmTap(btn) { if (btn.dataset.armed) return true; btn.dataset.armed = '1'; const t = btn.textContent; btn.textContent = 'Tap again to confirm'; setTimeout(() => { delete btn.dataset.armed; btn.textContent = t; }, 3000); return false; }

/* ---------------- Challenges admin ---------------- */
const PACT_ICONS = ['check', 'protein', 'move', 'water', 'fiber', 'sleep'];
function editPact(p = {}) {
  const isNew = !p.id;
  const s = sheet(`<header><span class="hv">${isNew ? 'New challenge' : 'Edit challenge'}</span><button class="x" aria-label="Close">×</button></header>
    <form class="mvbody adm-form" id="pact-form">
      <label>Name<input class="inp" name="title" maxlength="60" required value="${esc(p.title || '')}"></label>
      <label>Goal (one line)<input class="inp" name="goal" maxlength="140" required value="${esc(p.goal || '')}"></label>
      <div class="row2"><label>Days<input class="inp" name="days" type="number" min="7" max="90" value="${p.days || 30}"></label>
        <label>Icon<select class="inp" name="icon">${PACT_ICONS.map(i => `<option ${i === (p.icon || 'check') ? 'selected' : ''}>${i}</option>`).join('')}</select></label></div>
      <div class="row2"><label>Order<input class="inp" name="sort" type="number" value="${p.sort ?? 10}"></label>
        <label class="check"><input type="checkbox" name="members_only" ${p.members_only ? 'checked' : ''}> <span>Package members only</span></label></div>
      <div class="btnrow"><button class="btn sun" type="submit">Save</button>${isNew ? '' : `<button class="btn ghost" type="button" data-toggle="1">${p.active === false ? 'Restart challenge' : 'End challenge'}</button>`}</div>
    </form>`);
  const f = s.querySelector('#pact-form');
  const read = (extra = {}) => { const d = Object.fromEntries(new FormData(f)); return { id: p.id, title: d.title.trim(), goal: d.goal.trim(), days: Math.min(90, Math.max(7, +d.days || 30)), icon: d.icon, sort: +d.sort || 10, members_only: !!d.members_only, active: p.active !== false, ...extra }; };
  const save = async row => { try { await cloud.savePact(row); s.close(); pactData = null; loadPacts(); toast('Saved'); } catch (err) { toast(err.message); } };
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('.x')) { s.close(); return; }
    const t = e.target.closest('[data-toggle]'); if (t && confirmTap(t)) save(read({ active: p.active === false })); });
  f.addEventListener('submit', e => { e.preventDefault(); save(read()); });
}

/* ---------------- Video overlays (promo before sign-up, explainer after first login) ---------------- */
const VIDEOS = {
  promo: { src: '/media/promo.mp4?v=2', poster: '/media/promo.jpg', cta: 'Get started →', label: 'Quick tour' },
  explainer: { src: '/media/explainer.mp4?v=4', poster: '/media/explainer.jpg', cta: 'Let’s go →', label: 'How it works' },
};
function playVideo(key, onDone) {
  const v = VIDEOS[key]; document.querySelector('.vidov')?.remove();
  const el = document.createElement('div'); el.className = 'vidov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', v.label);
  el.innerHTML = `<video playsinline muted autoplay preload="auto" poster="${v.poster}" src="${v.src}"></video>
    <button class="vsound" type="button" aria-pressed="false">${icon('sound')}<span>Tap for sound</span></button>
    <div class="vbar"><i></i></div>
    <button class="btn sun vgo" type="button">${esc(v.cta)}</button>`;
  document.body.appendChild(el);
  const vid = el.querySelector('video'), snd = el.querySelector('.vsound'), bar = el.querySelector('.vbar i');
  let done = false;
  const close = () => { if (done) return; done = true; vid.pause(); el.classList.add('out'); setTimeout(() => el.remove(), 260); onDone && onDone(); };
  snd.onclick = () => { vid.muted = !vid.muted; if (!vid.muted && vid.ended) { vid.currentTime = 0; } vid.play().catch(() => {}); snd.setAttribute('aria-pressed', String(!vid.muted)); snd.querySelector('span').textContent = vid.muted ? 'Tap for sound' : 'Sound on'; buzz(8); };
  vid.addEventListener('timeupdate', () => { if (vid.duration) bar.style.width = (vid.currentTime / vid.duration * 100) + '%'; });
  vid.addEventListener('ended', close);
  vid.addEventListener('click', () => snd.click());
  el.querySelector('.vgo').onclick = close;
  vid.play().catch(() => {});
}
const quietMode = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;

/* ---------------- Boot ---------------- */
let started = false;
async function startSession(session) {
  if (started && user && session?.user?.id === user.id) return;
  started = true; user = session.user;
  history.replaceState(null, '', location.pathname + location.search.replace(/[?&]code=[^&]*/, ''));
  try { profile = await cloud.loadProfile(user.id); }
  catch (e) { console.error(e); app.innerHTML = '<div class="auth"><p class="status">Couldn’t load your account. Check your connection and refresh.</p></div>'; return; }
  const cached = loadCache(); let remote = null;
  try { remote = await cloud.loadState(user.id); } catch (e) { console.error(e); }
  state = Object.assign(blankState(), remote || cached || {});
  state.tab = 'today';
  const params = new URLSearchParams(location.search);
  if (params.get('circle') === 'joined') { state.tab = 'circle'; toast(`Welcome to ${NAMES.paidThe}!`); setTimeout(async () => { profile = await cloud.loadProfile(user.id).catch(() => profile); render(); }, 2500); }
  if (params.has('circle')) history.replaceState(null, '', location.pathname);
  try { const c = await cloud.loadConcierges(user.id, profile.concierge_id); myConcierge = c.mine; selfConcierge = c.self; } catch (e) { console.error(e); }
  if (!profile.first_name || !profile.accepted_at) return onboarding();
  render(); maybeExplainer();
}
function maybeExplainer() { if (state.seenExplainer || DEMO) return; state.seenExplainer = true; save(); setTimeout(() => playVideo('explainer'), 400); }
async function boot() {
  if (DEMO) {
    const dt = new URLSearchParams(location.search).get('tier');
    profile = { first_name: 'Alex', tier: ['free', 'essentials', 'performance', 'longevity'].includes(dt) ? dt : 'performance', circle_active: false, is_admin: new URLSearchParams(location.search).has('admin') };
    const cached = loadCache(); state = Object.assign(blankState(), cached || {});
    if (!cached) { seedDemo(); save(); }
    render(); return;
  }
  cloud.onAuth((event, session) => { if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) startSession(session); if (event === 'SIGNED_OUT') { user = null; started = false; authScreen(); } });
  const session = await cloud.getSession();
  if (session) startSession(session); else authScreen();
}
{ const tc = document.getElementById('tab-circle'); if (tc) tc.lastChild.textContent = NAMES.tab; }
boot();
