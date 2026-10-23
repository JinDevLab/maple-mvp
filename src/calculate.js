export const FEE = 0.03;
export const MESO = 100_000_000;
export const defaults = () => ({
  version: 1, budget: 100000, packageCash: 10000, packagePoints: 10000,
  marketRate: 2200, marketUnit: 1, mode: 'efficiency',
  items: [
    { id: 'royal', name: '메이플 로얄 스타일', cash: 2200, price: 1.05 },
    { id: 'master', name: '프리미엄 마스터피스', cash: 1900, price: 0.95 },
    { id: 'scissors', name: '플래티넘 카르마의 가위', cash: 5900, price: 2.65 }
  ]
});

const valid = (value, zero = false) => typeof value === 'number' && Number.isFinite(value) && value >= (zero ? 0 : Number.MIN_VALUE) && value <= 1e12;
export function validate(state) {
  const errors = [];
  for (const key of ['budget', 'packageCash', 'packagePoints', 'marketRate']) {
    if (!valid(state[key], key === 'budget') || !Number.isSafeInteger(state[key])) errors.push(key);
  }
  if (!valid(state.marketUnit) || state.marketUnit > 10000 || state.marketUnit < 0.0001) errors.push('marketUnit');
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
    for (const key of ['budget', 'packageCash', 'packagePoints', 'marketRate', 'marketUnit']) {
      if (typeof value[key] === 'number' || value[key] === '') state[key] = value[key];
    }
    state.mode = value.mode === 'budget' ? 'budget' : 'efficiency';
    state.items = value.items.filter(x => x && typeof x.name === 'string').map((item, i) => ({
      id: `saved-${i}`, name: item.name.slice(0, 60),
      cash: typeof item.cash === 'number' ? item.cash : '',
      price: typeof item.price === 'number' ? item.price : ''
    }));
    return state;
  } catch { return fallback; }
}
