export const FEE = 0.03;
export const MESO = 100_000_000;
export const defaults = () => ({
  version: 1, budget: 100000, packageCash: 10000, packagePoints: 10000,
  targetMeso: 10, cashRate: '', marketRate: 2200, marketUnit: 1, mode: 'efficiency',
  items: [
    { id: 'royal', name: '메이플 로얄 스타일', cash: 2200, price: 1.15 },
    { id: 'master', name: '프리미엄 마스터피스', cash: 1900, price: 0.9 },
    { id: 'scissors', name: '플래티넘 카르마의 가위', cash: 5900, price: 3.14 },
    { id: 'prism', name: '컬러링 프리즘 프로', cash: 25000, price: 12.6 },
    { id: 'gift', name: '부티크 기프트', cash: 33000, price: 17.3 },
    { id: 'berry', name: '원더베리', cash: 54000, price: 28 },
    { id: 'luna', name: '루나 크리스탈', cash: 3900, price: 2 }
  ]
});

const valid = (value, zero = false) => typeof value === 'number' && Number.isFinite(value) && value >= (zero ? 0 : Number.MIN_VALUE) && value <= 1e12;
export function validate(state) {
  const errors = [];
  for (const key of ['budget', 'packageCash', 'packagePoints', 'marketRate']) {
    if (key === 'budget' && state.mode === 'target') continue;
    if (!valid(state[key], key === 'budget') || !Number.isSafeInteger(state[key])) errors.push(key);
  }
  if (state.cashRate !== '' && state.cashRate !== undefined && (!valid(state.cashRate) || !Number.isSafeInteger(state.cashRate))) errors.push('cashRate');
  if (!valid(state.marketUnit) || state.marketUnit > 10000 || state.marketUnit < 0.0001) errors.push('marketUnit');
  if (state.mode === 'target' && (!valid(state.targetMeso) || state.targetMeso < 0.0001 || state.targetMeso > 10000)) errors.push('targetMeso');
  return errors;
}
export function validItem(item) {
  return typeof item.name === 'string' && item.name.trim().length > 0 && valid(item.cash) && Number.isSafeInteger(item.cash) && valid(item.price, true) && item.price <= 10000;
}

// Quotients close to integers may be represented just below the boundary.
const whole = (n) => Math.floor(n + Number.EPSILON * Math.max(1, n) * 2);
export function calculate(state) {
  const errors = validate(state);
  if (errors.length) return { errors, rows: [] };
  if (state.mode === 'target') return calculateTarget(state);
  const pointsPerCash = state.packagePoints / state.packageCash;
  const mesoPerPoint = MESO / state.marketRate;
  const packageCount = whole(state.budget / state.packageCash);
  const points = packageCount * state.packagePoints;
  const lotPoints = state.marketRate * state.marketUnit;
  const lots = whole(points / lotPoints);
  const market = {
    id: 'market', name: '메소마켓', kind: 'market',
    efficiency: 10000 * pointsPerCash * mesoPerPoint,
    total: lots * state.marketUnit * MESO,
    count: packageCount, spent: packageCount * state.packageCash,
    cashLeft: state.budget - packageCount * state.packageCash,
    pointsLeft: Math.max(0, points - lots * lotPoints), lots
  };
  const items = state.items.filter(validItem).map(item => {
    const count = whole(state.budget / item.cash);
    const net = item.price * MESO * (1 - FEE);
    const efficiency = net / item.cash * 10000;
    return { ...item, kind: 'item', count, net, efficiency, total: count * net,
      spent: count * item.cash, cashLeft: state.budget - count * item.cash,
      pointsLeft: 0, advantage: (efficiency / market.efficiency - 1) * 100,
      breakEven: item.cash * pointsPerCash * mesoPerPoint / (1 - FEE)
    };
  });
  const metric = state.mode === 'budget' ? 'total' : 'efficiency';
  const rows = [market, ...items].sort((a, b) => b[metric] - a[metric]);
  for (const row of rows) {
    row.money = cashOutcome(row[metric], state.mode === 'budget' ? row.spent : 10000, state.cashRate);
    row.marketDifference = row[metric] - market[metric];
  }
  const top = rows[0][metric];
  const winners = rows.filter(row => Math.abs(row[metric] - top) <= Math.max(0.01, top * 1e-10));
  return { errors, market, items, rows, winners, metric };
}

export function restore(raw) {
  const fallback = defaults();
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length > 100) return fallback;
    const state = { ...fallback };
    for (const key of ['budget', 'packageCash', 'packagePoints', 'marketRate', 'marketUnit', 'cashRate', 'targetMeso']) {
      if (typeof value[key] === 'number' || value[key] === '') state[key] = value[key];
    }
    state.mode = ['budget', 'target'].includes(value.mode) ? value.mode : 'efficiency';
    state.items = value.items.filter(x => x && typeof x.name === 'string').map((item, i) => ({
      id: `saved-${i}`, name: item.name.slice(0, 60),
      cash: typeof item.cash === 'number' ? item.cash : '',
      price: typeof item.price === 'number' ? item.price : ''
    }));
    return state;
  } catch { return fallback; }
}

export function cashOutcome(meso, cost, rate) {
  if (!valid(rate)) return null;
  const revenue = meso / MESO * rate;
  const profit = revenue - cost;
  return { revenue, cost, profit, mesoProfit: profit / rate * MESO,
    percent: cost > 0 ? profit / cost * 100 : null };
}

export function addBudget(current, increment) {
  const base = Number.isSafeInteger(current) && current >= 0 ? current : 0;
  return Math.min(1e12, base + increment);
}

// Reverse calculation: buy only enough market lots to meet the target,
// then buy enough whole packages to fund those lots. Unused points stay separate.
function calculateTarget(state) {
  const base = calculate({ ...state, mode: 'efficiency', budget: 0 });
  const target = state.targetMeso * MESO;
  const ceil = value => Math.ceil(value - Number.EPSILON * Math.max(1, value) * 2);
  const market = { ...base.market };
  market.lots = ceil(state.targetMeso / state.marketUnit);
  const requiredPoints = market.lots * state.marketUnit * state.marketRate;
  market.count = ceil(requiredPoints / state.packagePoints);
  market.spent = market.count * state.packageCash;
  market.total = market.lots * state.marketUnit * MESO;
  market.pointsLeft = Math.max(0, market.count * state.packagePoints - requiredPoints);
  const items = base.items.map(item => {
    const count = item.net > 0 ? ceil(target / item.net) : Infinity;
    return { ...item, count, spent: count * item.cash, total: count * item.net };
  });
  const candidates = [market, ...items];
  const rows = candidates.filter(row => Number.isSafeInteger(row.count) && Number.isSafeInteger(row.spent) && Number.isFinite(row.total));
  for (const row of rows) {
    row.cashLeft = 0;
    row.excess = Math.max(0, row.total - target);
    row.money = cashOutcome(row.total, row.spent, state.cashRate);
    row.cashSaving = Number.isSafeInteger(market.spent) ? market.spent - row.spent : null;
  }
  rows.sort((a,b) => a.spent - b.spent);
  const winners = rows.filter(row => row.spent === rows[0]?.spent);
  return { errors: [], market, items, rows, winners, metric: 'spent', target,
    unavailable: candidates.filter(row => !rows.includes(row)) };
}
