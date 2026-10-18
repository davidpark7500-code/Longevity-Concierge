import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare, parseMeal, lookup } from '../src/shared/foodsearch.js';
import { preFilter } from '../src/shared/guardrails.js';

const rows = prepare(JSON.parse(readFileSync(new URL('../src/data/foods.json', import.meta.url), 'utf8')));

test('free matcher handles a typical breakfast without AI', () => {
  const r = parseMeal(rows, '2 eggs, 1 cup greek yogurt, 1 slice whole wheat toast, black coffee');
  assert.equal(r.missed.length, 0);
  assert.deepEqual(r.matched.map(m => m.name), ['Egg, hard-boiled', 'Greek yogurt, plain lowfat', 'Whole-wheat bread', 'Coffee, brewed']);
  const protein = r.matched.reduce((a, m) => a + m.protein, 0);
  assert.ok(protein > 35 && protein < 50, `protein ${protein}`);
});
test('splits "with" and maps protein shake to whey', () => {
  const r = parseMeal(rows, 'protein shake, oatmeal with blueberries');
  assert.deepEqual(r.matched.map(m => m.name), ['Whey protein powder', 'Oats, dry', 'Blueberries']);
});
test('lookup returns USDA rows for the AI tool', () => {
  const r = lookup(rows, 'chicken breast');
  assert.ok(r.length > 0 && r[0].protein_g_per_100g > 20);
});
test('guardrails catch emergencies and medical questions before AI', () => {
  assert.equal(preFilter('I have chest pain')?.kind, 'emergency');
  assert.equal(preFilter('is my dose right?')?.kind, 'provider');
  assert.equal(preFilter('what about my Ozempic')?.kind, 'provider');
  assert.equal(preFilter('what should I eat for dinner?'), null);
  assert.equal(preFilter('I love my drumsticks'), null, 'no false positive on "drumsticks" (contains "mg"-like letters)');
});
