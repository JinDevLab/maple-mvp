import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, defaults, restore, MESO } from '../src/calculate.js';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
test('example: 3% fee and fee-free market, normalized to 10,000 cash', () => {
  const r = calculate(defaults());
  near(r.items[0].net, 101850000);
  near(r.items[0].efficiency, 462954545.454545);
  near(r.market.efficiency, 454545454.545454);
  near(r.items[0].advantage, 1.85);
  assert.equal(r.rows[0].id, 'master');
});
test('integer budget purchases preserve unused cash and points', () => {
  const r = calculate({ ...defaults(), budget: 101000, mode: 'budget' });
  assert.equal(r.market.count, 10);
  assert.equal(r.market.total, 45 * MESO);
  assert.equal(r.market.cashLeft, 1000);
  assert.equal(r.market.pointsLeft, 1000);
  assert.equal(r.items[0].count, 45);
  assert.equal(r.items[0].cashLeft, 2000);
});
test('package bonus and market purchase units are applied independently', () => {
  const r = calculate({ ...defaults(), budget: 20000, packagePoints: 11000, marketUnit: 10 });
  assert.equal(r.market.total, 10 * MESO);
  assert.equal(r.market.pointsLeft, 0);
  near(r.market.efficiency, 5 * MESO);
});
test('break-even price produces equal normalized efficiency', () => {
  const state = defaults();
  const r = calculate(state);
  state.items = [{ ...state.items[0], price: r.items[0].breakEven / MESO }];
  const equal = calculate(state);
  near(equal.items[0].efficiency, equal.market.efficiency);
  assert.equal(equal.winners.length, 2);
});
test('normalized winner can differ from affordable budget winner', () => {
  const state = { ...defaults(), budget: 10000, items: [{ id: 'x', name: '비싼 아이템', cash: 11000, price: 6 }] };
  assert.equal(calculate(state).rows[0].id, 'x');
  assert.equal(calculate({ ...state, mode: 'budget' }).rows[0].id, 'market');
});
test('zero budget and zero sale price remain finite', () => {
  const state = { ...defaults(), budget: 0, mode: 'budget' };
  state.items[0].price = 0;
  const r = calculate(state);
  assert.equal(r.items[0].efficiency, 0);
  assert.ok(r.rows.every(x => x.total === 0 && Number.isFinite(x.efficiency)));
});
test('invalid global inputs never produce calculations', () => {
  for (const value of [0, -1, '', NaN, Infinity, 0.5, 1e13]) {
    const r = calculate({ ...defaults(), marketRate: value });
    assert.ok(r.errors.includes('marketRate'));
    assert.deepEqual(r.rows, []);
  }
});
test('invalid items are excluded; empty list still calculates market', () => {
  const state = defaults();
  state.items = [{ id: 'x', name: '', cash: 10, price: 2 }, { id: 'y', name: 'bad', cash: 0, price: 3 }];
  assert.equal(calculate(state).rows.length, 1);
  assert.equal(calculate({ ...state, items: [] }).rows[0].id, 'market');
});
test('fractional market unit does not lose a lot at floating point boundary', () => {
  const r = calculate({ ...defaults(), budget: 10000, marketRate: 1000, marketUnit: 0.1 });
  assert.equal(r.market.lots, 100);
  assert.equal(r.market.total, 10 * MESO);
});
test('saved data: corrupt/version mismatch fallback, empty list and partial entries survive', () => {
  assert.deepEqual(restore('{broken'), defaults());
  assert.deepEqual(restore('{"version":2,"items":[]}'), defaults());
  assert.deepEqual(restore(JSON.stringify({ ...defaults(), items: [] })).items, []);
  const state = restore(JSON.stringify({ ...defaults(), items: [{ name: '<img onerror=alert(1)>', cash: '', price: '' }] }));
  assert.equal(state.items[0].cash, '');
  assert.equal(calculate(state).rows.length, 1);
});
