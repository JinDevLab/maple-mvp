import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, defaults as presets, restore, MESO, cashOutcome, addBudget } from '../src/calculate.js';
// Keep the original arithmetic examples independent of the editable default presets.
const defaults = () => ({ ...presets(), mode: 'efficiency', items: [
  { id: 'royal', name: '메이플 로얄 스타일', cash: 2200, price: 1.05 },
  { id: 'master', name: '프리미엄 마스터피스', cash: 1900, price: 0.95 },
  { id: 'scissors', name: '플래티넘 카르마의 가위', cash: 5900, price: 2.65 }
] });
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
  assert.deepEqual(restore('{broken'), presets());
  assert.deepEqual(restore('{"version":2,"items":[]}'), presets());
  assert.deepEqual(restore(JSON.stringify({ ...defaults(), items: [] })).items, []);
  const state = restore(JSON.stringify({ ...defaults(), items: [{ name: '<img onerror=alert(1)>', cash: '', price: '' }] }));
  assert.equal(state.items[0].cash, '');
  assert.equal(calculate(state).rows.length, 1);
});

test('default presets match the seven supplied items', () => {
  assert.deepEqual(presets().items.map(({cash, price}) => [cash, price]), [[2200,1.15],[1900,0.9],[5900,3.14],[25000,12.6],[33000,17.3],[54000,28],[3900,2]]);
});
test('budget buttons add repeatedly, handle empty input and respect the upper bound', () => {
  assert.equal(addBudget(addBudget(100000, 10000), 10000), 120000);
  assert.equal(addBudget('', 50000), 50000);
  assert.equal(addBudget(999999999999, 1000000), 1e12);
});
test('cash sale losses, gains and exact break-even use the same meso rate', () => {
  const loss = cashOutcome(5 * MESO, 10000, 1800);
  assert.equal(loss.revenue, 9000);
  assert.equal(loss.profit, -1000);
  assert.equal(loss.percent, -10);
  near(loss.mesoProfit, -1000 / 1800 * MESO);
  assert.equal(cashOutcome(5 * MESO, 10000, 2200).profit, 1000);
  assert.equal(cashOutcome(5 * MESO, 10000, 2000).profit, 0);
});
test('cash rate is optional; invalid values block calculation', () => {
  assert.equal(calculate(defaults()).market.money, null);
  for (const rate of [0, -1, Infinity, NaN, 0.5]) assert.ok(calculate({...defaults(),cashRate:rate}).errors.includes('cashRate'));
  assert.equal(cashOutcome(0,0,1800).percent, null);
});
test('budget cash outcome uses spent cash; unspent cash and points are not sale proceeds', () => {
  const r = calculate({...defaults(), mode:'budget', budget:101000, cashRate:1800});
  assert.equal(r.market.money.cost,100000);
  assert.equal(r.market.money.revenue,81000);
  assert.equal(r.market.money.profit,-19000);
  assert.equal(r.market.cashLeft,1000);
  assert.equal(r.market.pointsLeft,1000);
  assert.equal(r.items[0].money.cost,99000);
  near(r.items[0].money.profit,45.8325 * 1800 - 99000);
});
test('normalized cash outcome always uses 10000 cash; old saved settings migrate safely', () => {
  const old = defaults(); delete old.cashRate;
  const restored = restore(JSON.stringify(old));
  assert.equal(restored.cashRate,'');
  assert.equal(restored.items[0].price,1.05);
  const r = calculate({...restored,cashRate:1800});
  assert.ok(r.rows.every(row=>row.money.cost===10000));
  assert.equal(restore(JSON.stringify({...old,cashRate:1800})).cashRate,1800);
});

test('reverse mode rounds up item count after auction fee and sorts by cost', () => {
  const r = calculate({...defaults(), mode:'target', targetMeso:10, cashRate:1800});
  const royal = r.items[0];
  assert.equal(royal.count,10);
  assert.equal(royal.spent,22000);
  near(royal.total,10.185 * MESO);
  near(royal.excess,0.185 * MESO);
  assert.ok(r.rows.every((row,i) => i===0 || row.spent >= r.rows[i-1].spent));
  for (const row of r.items) assert.ok((row.count-1) * row.net < r.target);
  near(royal.money.profit,10.185 * 1800 - 22000);
});
test('reverse market rounds lots then packages, preserving unused points', () => {
  const r = calculate({...defaults(),mode:'target',targetMeso:10.5});
  assert.equal(r.market.lots,11);
  assert.equal(r.market.count,3);
  assert.equal(r.market.spent,30000);
  assert.equal(r.market.total,11 * MESO);
  assert.equal(r.market.pointsLeft,5800);
  assert.equal(r.market.excess,0.5 * MESO);
});
test('reverse exact boundaries do not buy an extra item or package', () => {
  const r = calculate({...defaults(),mode:'target',targetMeso:10.185,packagePoints:11000});
  assert.equal(r.items[0].count,10);
  const exact = calculate({...defaults(),mode:'target',targetMeso:10,packagePoints:11000});
  assert.equal(exact.market.count,2);
  assert.equal(exact.market.pointsLeft,0);
});
test('reverse accepts fractional lots, ignores the cash budget, rejects invalid target', () => {
  const r = calculate({...defaults(),mode:'target',budget:'',targetMeso:0.15,marketUnit:0.1});
  assert.deepEqual(r.errors,[]);
  assert.equal(r.market.lots,2);
  near(r.market.total,0.2 * MESO);
  for(const target of [0,-1,'',NaN,Infinity,10001]) assert.ok(calculate({...defaults(),mode:'target',targetMeso:target}).errors.includes('targetMeso'));
});
test('reverse zero-sale and unsafe-count routes are excluded without Infinity in results', () => {
  const state = {...defaults(),mode:'target',targetMeso:10};
  state.items[0].price=0;
  state.items[1].price=1e-20;
  const r = calculate(state);
  assert.equal(r.unavailable.length,2);
  assert.ok(r.rows.every(row=>Number.isFinite(row.total) && Number.isSafeInteger(row.spent)));
});
test('reverse ties and saved settings survive restoration', () => {
  const state = {...defaults(),mode:'target',targetMeso:10,items:[{id:'x',name:'동률',cash:30000,price:10/0.97}]};
  const r = calculate(state);
  assert.equal(r.winners.length,2);
  const saved=restore(JSON.stringify(state));
  assert.equal(saved.mode,'target');
  assert.equal(saved.targetMeso,10);
  const old=defaults(); delete old.targetMeso;
  assert.equal(restore(JSON.stringify(old)).targetMeso,10);
});


test('cash mode starts with actual budget and ignores an inactive target', () => {
  const state = {...presets(), targetMeso: ''};
  assert.equal(state.mode, 'budget');
  const result = calculate(state);
  assert.deepEqual(result.errors, []);
  assert.equal(result.metric, 'total');
  assert.equal(result.market.total, 45 * MESO);
  const saved = restore(JSON.stringify(state));
  assert.equal(saved.mode, 'budget');
  assert.equal(saved.targetMeso, '');
  assert.ok(calculate({...saved, mode: 'target'}).errors.includes('targetMeso'));
  assert.equal(restore(JSON.stringify({...state, mode: 'unknown'})).mode, 'budget');
});
