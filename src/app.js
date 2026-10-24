import { defaults, calculate, restore, validItem, MESO, cashOutcome, addBudget } from './calculate.js';

const KEY = 'maple-mvp:v1';
const $ = selector => document.querySelector(selector);
const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const fmt = n => nf.format(n);
const eok = n => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(n / MESO);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signed = (n, format = fmt) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${format(Math.abs(n))}`;
const cashValue = (meso) => Number(state.cashRate) > 0 ? `${fmt(meso / MESO * state.cashRate)}원` : '—원';
function moneyMarkup(money) {
  if (!money) return '';
  const tone = money.profit >= 0 ? 'positive' : 'negative';
  return `<div class="money-summary"><span>예상 판매대금 <strong>${fmt(money.revenue)}원</strong></span><span>비용 ${fmt(money.cost)}원</span><span class="${tone}">현금 손익 <strong>${signed(money.profit)}원</strong> (${money.percent === null ? '투입액 없음' : `${signed(money.percent)}%`})</span><span class="${tone}">메소 환산 손익 <strong>${signed(money.mesoProfit, eok)}억 메소</strong></span></div>`;
}
let state = defaults();
try { const saved = localStorage.getItem(KEY); if (saved) state = restore(saved); }
catch { $('#save-status').textContent = '자동 저장을 사용할 수 없습니다'; }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); $('#save-status').textContent = '이 브라우저에 자동 저장됨'; }
  catch { $('#save-status').textContent = '저장 불가 · 현재 화면에서 계산 가능'; }
}
function renderSettings() {
  document.querySelectorAll('[data-setting]').forEach(input => { input.value = state[input.dataset.setting]; });
}
function renderItems() {
  $('#item-count').textContent = state.items.length;
  $('#add-item').disabled = state.items.length >= 100;
  $('#items').innerHTML = state.items.map((item, index) => `
    <article class="item" data-id="${escape(item.id)}">
      <div class="item-head"><span class="item-index">${String(index + 1).padStart(2, '0')}</span><label class="sr-only" for="name-${escape(item.id)}">아이템 ${index + 1} 이름</label><input class="item-name" id="name-${escape(item.id)}" data-field="name" value="${escape(item.name)}" maxlength="60" placeholder="아이템 이름"><button class="delete-button" data-delete="${escape(item.id)}" aria-label="${escape(item.name || '아이템')} 삭제" title="아이템 삭제">×</button></div>
      <div class="item-fields"><label>1개 구매가<div class="input-unit"><input data-field="cash" aria-label="아이템 ${index + 1} 구매가" type="number" min="1" max="1000000000000" step="1" value="${escape(item.cash)}"><span>캐시</span></div></label><label>1개 경매장 판매가<div class="input-unit"><input data-field="price" aria-label="아이템 ${index + 1} 판매가" type="number" min="0" max="10000" step="any" value="${escape(item.price)}"><span>억 메소</span></div></label></div>
      <div class="item-detail" data-detail="${escape(item.id)}"></div>
    </article>`).join('') || '<div class="empty">등록된 아이템이 없습니다.<br>아이템을 추가하면 메소마켓과 바로 비교할 수 있어요.</div>';
}
function render() {
  const result = calculate(state);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.querySelectorAll('[data-setting]').forEach(input => input.setAttribute('aria-invalid', String(result.errors.includes(input.dataset.setting))));
  $('#mode-description').textContent = state.mode === 'target' ? `목표 ${fmt(Number(state.targetMeso) || 0)}억 메소 이상을 확보하는 최소 캐시 순서입니다. 아이템·패키지는 올림 구매합니다.` : state.mode === 'budget' ? `${fmt(Number(state.budget) || 0)}캐시 안에서 구매 가능한 수량으로 비교합니다. 잔액은 아래에 별도 표시합니다.` : '구매 단위와 잔액을 제외하고, 같은 1만 캐시의 메소 확보 효율을 비교합니다.';
  for (const item of state.items) {
    const container = document.querySelector(`[data-detail="${CSS.escape(item.id)}"]`);
    const row = result.items?.find(x => x.id === item.id);
    const valid = validItem(item);
    const nameInput = document.getElementById(`name-${item.id}`);
    nameInput?.setAttribute('aria-invalid', String(!item.name.trim()));
    container.innerHTML = !valid ? '<span class="error">이름, 양의 정수 구매가, 0 이상의 판매가(최대 10,000억)를 입력하세요.</span>' : !row ? '비교 기준을 올바르게 입력하면 계산됩니다.' : `<span>실수령 <strong>${eok(row.net)}억 · ${cashValue(row.net)}</strong></span><span>손익분기 판매가 <strong>${eok(row.breakEven)}억 · ${cashValue(row.breakEven)}</strong></span><span class="${row.advantage >= 0 ? 'positive' : 'negative'}">마켓 대비 ${row.advantage >= 0 ? '+' : ''}${fmt(row.advantage)}% · ${signed(row.net - row.cash / 10000 * result.market.efficiency, eok)}억 메소 · ${cashValue(row.net - row.cash / 10000 * result.market.efficiency)}</span>${moneyMarkup(cashOutcome(row.net, row.cash, state.cashRate))}`;
  }
  if (result.errors.length) {
    $('#recommendation').innerHTML = '<h2>비교 기준을 확인해 주세요.</h2><p>캐시·메포는 1조 이하의 정수로 입력하세요. 예산은 0 이상, 나머지는 0보다 커야 합니다. 메소 구매 단위와 목표 메소는 0.0001~10,000억 범위입니다.</p>';
    $('#rankings').innerHTML = '<p class="empty">올바른 값을 입력하면 비교 결과가 표시됩니다.</p>';
    return;
  }
  if (state.mode === 'target') { renderTarget(result); return; }
  const { rows, market, winners, metric } = result;
  const winner = rows[0];
  const top = winner[metric];
  const isBudget = state.mode === 'budget';
  const alternative = winner.kind === 'item' ? market : rows.find(row => row.kind === 'item');
  const diff = alternative ? top - alternative[metric] : 0;
  const gain = alternative && alternative[metric] > 0 ? diff / alternative[metric] * 100 : null;
  const title = top === 0 ? '현재 예산으로 구매할 수 없어요.' : winners.length > 1 ? `${winners.length}개 방법의 결과가 같아요.` : `${escape(winner.name)}${winner.kind === 'item' ? ' 판매' : ''}가 유리해요.`;
  const excluded = state.items.length - result.items.length;
  $('#recommendation').innerHTML = `<h2>${title}</h2><p>${top === 0 ? '예산 또는 구매가를 조정해 주세요.' : alternative && diff > 0.01 ? `${escape(alternative.name)} 대비 <strong>${eok(diff)}억 메소 · ${cashValue(diff)}${gain !== null ? ` (+${fmt(gain)}%)` : ''}</strong> 더 확보할 수 있어요.` : '아래에서 각 방법의 효율과 남는 재화를 확인하세요.'}</p><div class="hero-stats"><div><span>${isBudget ? '예산 내 예상 실수령' : '1만 캐시당 예상 실수령'}</span><strong>${eok(top)}<small>억 메소</small></strong><span>${cashValue(top)}</span></div><div><span>${isBudget ? '입력 예산' : '비교 기준'}</span><strong>${isBudget ? fmt(state.budget) : '10,000'}<small>캐시</small></strong></div></div>${moneyMarkup(winner.money) || '<span class="money-note">현금 시세를 입력하면 원화·메소 환산 손익이 표시됩니다.</span>'}${excluded ? `<p class="error">입력이 완료되지 않은 아이템 ${excluded}개는 비교에서 제외했습니다.</p>` : ''}`;
  $('#rankings').innerHTML = `<table class="comparison-table"><caption class="sr-only">${isBudget ? '예산 내 실제 구매 결과' : '1만 캐시당 효율'} 순위</caption><thead><tr><th scope="col">순위</th><th scope="col">구매·판매 방법</th><th scope="col" class="numeric">실수령 / 억 메소·원</th><th scope="col" class="numeric">마켓 대비</th></tr></thead><tbody>${rows.map((row, index) => {
    const best = top > 0 && winners.includes(row);
    const relative = market[metric] > 0 ? (row[metric] / market[metric] - 1) * 100 : null;
    const comparison = row.kind === 'market' ? '기준' : relative === null ? '—' : `${relative > 0 ? '+' : ''}${fmt(relative)}%`;
    return `<tr class="${best ? 'best' : ''}"><td class="rank-number">${String(index + 1).padStart(2, '0')}</td><th scope="row"><span class="rank-name">${escape(row.name)}${best ? `<span class="best-label">${isBudget ? '최대 실수령' : '최고 효율'}</span>` : ''}</span><span class="route-note">${row.kind === 'market' ? '메포 → 메소 · 수수료 0%' : '경매장 판매 · 수수료 3%'}</span>${isBudget ? `<span class="budget-details">${row.kind === 'market' ? `패키지 ${fmt(row.count)}개 · ${fmt(row.lots)}회분 구매 단위` : `${fmt(row.count)}개 구매·판매`} · 사용 ${fmt(row.spent)}캐시<br>잔액 ${fmt(row.cashLeft)}캐시${row.kind === 'market' ? ` + ${fmt(row.pointsLeft)}메포` : ''}</span>` : ''}</th><td class="rank-value numeric">${eok(row[metric])}<span class="cash-secondary">${cashValue(row[metric])}</span></td><td class="numeric relative ${relative > 0 ? 'positive' : relative < 0 ? 'negative' : ''}">${comparison}${row.kind === 'market' ? '' : `<span class="cash-secondary">${signed(row.marketDifference, eok)}억</span><span class="cash-secondary">${cashValue(row.marketDifference)}</span>`}</td></tr>${row.money ? `<tr class="profit-row"><td colspan="4">${moneyMarkup(row.money)}</td></tr>` : ''}`;
  }).join('')}</tbody></table>`;

}
function renderTarget(result) {
  const { rows, winners, target } = result;
  const winner = rows[0];
  const excluded = state.items.length - result.items.length;
  const notices = `${excluded ? `미완성 아이템 ${excluded}개 제외. ` : ''}${result.unavailable.length ? `판매가 0 또는 계산 범위를 넘은 방법 ${result.unavailable.length}개는 역산에서 제외했습니다.` : ''}`;
  if (!winner) {
    $('#recommendation').innerHTML = '<h2>계산 가능한 방법이 없습니다.</h2><p>판매가와 전환 설정을 확인해 주세요.</p>';
    $('#rankings').innerHTML = `<p class="empty">${notices}</p>`;
    return;
  }
  const savingText = value => value === null ? '마켓 기준 계산 불가' : `${signed(value)}원${Number(state.cashRate) > 0 ? ` · ${signed(value / state.cashRate * MESO, eok)}억 메소 환산` : ''}`;
  $('#recommendation').innerHTML = `<h2>${winners.length > 1 ? `${winners.length}개 방법의 필요 캐시가 같아요.` : `${escape(winner.name)}${winner.kind === 'item' ? ' 판매' : ''}의 필요 캐시가 가장 적어요.`}</h2><p>목표 ${eok(target)}억 → 실제 ${eok(winner.total)}억 메소 (${cashValue(winner.total)})<br>초과 ${eok(winner.excess)}억 메소 · ${cashValue(winner.excess)}</p><div class="hero-stats"><div><span>목표 달성에 필요한 캐시</span><strong>${fmt(winner.spent)}<small>캐시</small></strong><span>${fmt(winner.spent)}원 · 1캐시=1원</span></div><div><span>목표</span><strong>${eok(target)}<small>억 메소</small></strong></div></div>${moneyMarkup(winner.money) || '<span class="money-note">현금 시세를 입력하면 손익을 함께 계산합니다.</span>'}${notices ? `<p class="error">${notices}</p>` : ''}`;
  $('#rankings').innerHTML = `<table class="comparison-table"><caption class="sr-only">목표 메소 달성 최소 캐시 순위</caption><thead><tr><th scope="col">순위</th><th scope="col">방법 · 구매 수량</th><th scope="col" class="numeric">필요 캐시 / 원</th><th scope="col" class="numeric">수령 / 억 메소</th></tr></thead><tbody>${rows.map((row,index) => `<tr class="${winners.includes(row) ? 'best' : ''}"><td class="rank-number">${index+1}</td><th scope="row"><span class="rank-name">${escape(row.name)}${winners.includes(row) ? '<span class="best-label">최소 캐시</span>' : ''}</span><span class="route-note">${row.kind === 'market' ? `패키지 ${fmt(row.count)}개 · 메소 ${fmt(row.lots)}단위 구매` : `${fmt(row.count)}개 구매·판매 · 수수료 3%`}</span><span class="budget-details">초과 ${eok(row.excess)}억 · ${cashValue(row.excess)}${row.kind === 'market' ? `<br>남는 메포 ${fmt(row.pointsLeft)}메포` : ''}<br>메소마켓 대비 비용 절감 ${savingText(row.cashSaving)}</span></th><td class="numeric rank-value">${fmt(row.spent)}<span class="cash-secondary">${fmt(row.spent)}원</span></td><td class="numeric relative">${eok(row.total)}<span class="cash-secondary">${cashValue(row.total)}</span></td></tr>${row.money ? `<tr class="profit-row"><td colspan="4">${moneyMarkup(row.money)}</td></tr>` : ''}`).join('')}</tbody></table>`;
}

document.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.setting) {
    state[input.dataset.setting] = input.value === '' ? '' : input.valueAsNumber;
    if (input.dataset.setting === 'targetMeso') state.mode = 'target';
    if (input.dataset.setting === 'budget' && state.mode === 'target') state.mode = 'budget';
  }
  else if (input.dataset.field) {
    const item = state.items.find(x => x.id === input.closest('[data-id]').dataset.id);
    item[input.dataset.field] = input.dataset.field === 'name' ? input.value : input.value === '' ? '' : input.valueAsNumber;
    if (input.dataset.field === 'name') input.closest('.item').querySelector('[data-delete]').setAttribute('aria-label', `${input.value || '아이템'} 삭제`);
  } else return;
  save(); render();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.budget) { state.budget = addBudget(state.budget, Number(button.dataset.budget)); if (state.mode === 'target') state.mode = 'budget'; renderSettings(); }
  else if (button.id === 'clear-budget') { state.budget = 0; if (state.mode === 'target') state.mode = 'budget'; renderSettings(); }
  else if (button.dataset.mode) state.mode = button.dataset.mode;
  else if (button.dataset.delete) {
    const index = state.items.findIndex(x => x.id === button.dataset.delete);
    state.items.splice(index, 1); renderItems();
    const next = $('#items').querySelectorAll('.item-name')[Math.min(index, state.items.length - 1)];
    (next || $('#add-item')).focus();
  } else if (button.id === 'add-item' && state.items.length < 100) {
    state.items.push({ id: crypto.randomUUID(), name: '', cash: '', price: '' }); renderItems();
    $('#items').lastElementChild.querySelector('.item-name').focus();
  } else if (button.id === 'reset') {
    if (!confirm('저장된 입력값과 아이템 목록을 기본 프리셋으로 초기화할까요?')) return;
    state = defaults(); renderSettings(); renderItems();
  } else return;
  save(); render();
});
renderSettings(); renderItems(); render();
