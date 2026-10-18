// POST /api/estimate  { text?: string, image?: base64 (no data: prefix), mediaType?: 'image/jpeg' }
// Claude identifies foods from a photo or description and looks each one up in the bundled USDA data.
import { readFileSync } from 'node:fs';
import { CAPS, estimatePrompt } from '../src/shared/guardrails.js';
import { lookup, prepare } from '../src/shared/foodsearch.js';
import { bumpUsage, claude, fail, handle, json, parseJson, requireUser, textOf } from './_lib.js';

let FOODS;
function foods() {
  if (!FOODS) {
    let raw;
    try { raw = readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8'); }
    catch { raw = readFileSync(process.cwd() + '/src/data/foods.json', 'utf8'); }
    FOODS = prepare(JSON.parse(raw));
  }
  return FOODS;
}

const TOOLS = [{
  name: 'lookup_food',
  description: 'Search the USDA food database. Returns up to 6 matching foods with kcal, protein and fiber per 100 g and a typical serving. Use one short query per food, like "egg scrambled" or "yogurt greek".',
  input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Short food name to search for' } }, required: ['query'] },
}];
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 600) : '';
  const image = typeof body.image === 'string' ? body.image : '';
  if (!text && !image) return fail('Type what you ate or add a photo first.');
  if (image && (image.length > 6_000_000 || !TYPES.includes(body.mediaType))) return fail('That photo didn’t work. Try a smaller JPG or PNG.');

  const capMsg = await bumpUsage(user.id, 'est', CAPS);
  if (capMsg) return json({ limit: true, note: capMsg, items: [] });

  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: body.mediaType, data: image } });
  content.push({ type: 'text', text: estimatePrompt({ hasPhoto: !!image, text }) });
  const messages = [{ role: 'user', content }];

  let msg;
  for (let round = 0; round < 5; round++) {
    msg = await claude({ system: 'You are a careful nutrition estimator. Final answer is JSON only.', messages, tools: TOOLS, maxTokens: 900 });
    if (msg.stop_reason !== 'tool_use') break;
    const results = msg.content.filter(b => b.type === 'tool_use').map(b => ({
      type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(lookup(foods(), String(b.input?.query || ''))),
    }));
    messages.push({ role: 'assistant', content: msg.content }, { role: 'user', content: results });
  }
  const r = parseJson(textOf(msg)) || {};
  const items = (Array.isArray(r.items) ? r.items : []).filter(x => x && typeof x === 'object').slice(0, 15).map(x => ({
    name: String(x.name || 'Food').slice(0, 80), amount: String(x.amount || '').slice(0, 40),
    protein: Math.min(300, Math.max(0, Number(x.protein_g) || 0)), fiber: Math.min(150, Math.max(0, Number(x.fiber_g) || 0)),
    source: x.source === 'usda' ? 'usda' : 'estimate',
  }));
  return json({ items, note: String(r.note || '').slice(0, 240) });
});
