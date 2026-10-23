import { defaults, calculate, restore, validItem, MESO } from './calculate.js';

const KEY = 'maple-mvp:v1';
const $ = selector => document.querySelector(selector);
const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const fmt = n => nf.format(n);
const eok = n => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(n / MESO);
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
      <div class="item-head"><span class="item-icon">${['✦', '◈', '✂'][index % 3]}</span><label class="sr-only" for="name-${escape(item.id)}">아이템 ${index + 1} 이름</label><input class="item-name" id="name-${escape(item.id)}" data-field="name" value="${escape(item.name)}" maxlength="60" placeholder="아이템 이름"><button class="delete-button" data-delete="${escape(item.id)}" aria-label="${escape(item.name || '아이템')} 삭제" title="아이템 삭제">×</button></div>
      <div class="item-fields"><label>1개 구매가<div class="input-unit"><input data-field="cash" aria-label="아이템 ${index + 1} 구매가" type="number" min="1" max="1000000000000" step="1" value="${escape(item.cash)}"><span>캐시</span></div></label><label>1개 경매장 판매가<div class="input-unit"><input data-field="price" aria-label="아이템 ${index + 1} 판매가" type="number" min="0" max="10000" step="any" value="${escape(item.price)}"><span>억 메소</span></div></label></div>
      <div class="item-detail" data-detail="${escape(item.id)}"></div>
    </article>`).join('') || '<div class="empty">등록된 아이템이 없습니다.<br>아이템을 추가하면 메소마켓과 바로 비교할 수 있어요.</div>';
}
function render() {
  const result = calculate(state);
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.querySelectorAll('[data-setting]').forEach(input => input.setAttribute('aria-invalid', String(result.errors.includes(input.dataset.setting))));
  $('#mode-description').textContent = state.mode === 'budget' ? `${fmt(Number(state.budget) || 0)}캐시 안에서 구매 가능한 수량으로 비교합니다. 잔액은 아래에 별도 표시합니다.` : '구매 단위와 잔액을 제외하고, 같은 1만 캐시의 메소 확보 효율을 비교합니다.';
  for (const item of state.items) {
    const container = document.querySelector(`[data-detail="${CSS.escape(item.id)}"]`);
    const row = result.items?.find(x => x.id === item.id);
    const valid = validItem(item);
    const nameInput = document.getElementById(`name-${item.id}`);
    nameInput?.setAttribute('aria-invalid', String(!item.name.trim()));
    container.innerHTML = !valid ? '<span class="error">이름, 양의 정수 구매가, 0 이상의 판매가(최대 10,000억)를 입력하세요.</span>' : !row ? '비교 기준을 올바르게 입력하면 계산됩니다.' : `<span>실수령 <strong>${eok(row.net)}억</strong></span><span>손익분기 판매가 <strong>${eok(row.breakEven)}억</strong></span><span class="${row.advantage >= 0 ? 'positive' : 'negative'}">마켓 대비 ${row.advantage >= 0 ? '+' : ''}${fmt(row.advantage)}%</span>`;
  }
  if (result.errors.length) {
    $('#recommendation').innerHTML = '<h2>비교 기준을 확인해 주세요.</h2><p>캐시·메포는 1조 이하의 정수로 입력하세요. 예산은 0 이상, 나머지는 0보다 커야 합니다. 메소 구매 단위는 0.0001~10,000억 범위입니다.</p>';
    $('#rankings').innerHTML = '<p class="empty">올바른 값을 입력하면 비교 결과가 표시됩니다.</p>';
    return;
  }
  const { rows, market, winners, metric } = result;
  const winner = rows[0];
  const top = winner[metric];
  const isBudget = state.mode === 'budget';
  const alternative = winner.kind === 'item' ? market : rows.find(row => row.kind === 'item');
  const diff = alternative ? top - alternative[metric] : 0;
  const gain = alternative && alternative[metric] > 0 ? diff / alternative[metric] * 100 : null;
  const title = top === 0 ? '현재 예산으로 구매할 수 없어요.' : winners.length > 1 ? `${winners.length}개 방법의 결과가 같아요.` : `${escape(winner.name)}${winner.kind === 'item' ? ' 판매' : ''}가 유리해요.`;
  const excluded = state.items.length - result.items.length;
  $('#recommendation').innerHTML = `<h2>${title}</h2><p>${top === 0 ? '예산 또는 구매가를 조정해 주세요.' : alternative && diff > 0.01 ? `${escape(alternative.name)} 대비 <strong>${eok(diff)}억 메소${gain !== null ? ` (+${fmt(gain)}%)` : ''}</strong> 더 확보할 수 있어요.` : '아래에서 각 방법의 효율과 남는 재화를 확인하세요.'}</p><div class="hero-stats"><div><span>${isBudget ? '예산 내 예상 실수령' : '1만 캐시당 예상 실수령'}</span><strong>${eok(top)}<small>억 메소</small></strong></div><div><span>${isBudget ? '입력 예산' : '비교 기준'}</span><strong>${isBudget ? fmt(state.budget) : '10,000'}<small>캐시</small></strong></div></div>${excluded ? `<p class="error">입력이 완료되지 않은 아이템 ${excluded}개는 비교에서 제외했습니다.</p>` : ''}`;
  $('#rankings').innerHTML = rows.map((row, index) => {
    const best = top > 0 && winners.includes(row);
    const width = top ? Math.max(0, Math.min(100, row[metric] / top * 100)) : 0;
    return `<article class="ranking ${best ? 'best' : ''}"><div class="rank-line"><span class="rank-number">${String(index + 1).padStart(2, '0')}</span><div class="rank-name"><strong>${escape(row.name)}</strong><span>${row.kind === 'market' ? '메포 → 메소 · 수수료 없음' : '캐시 아이템 판매 · 수수료 3%'} ${best ? '<b class="best-label">BEST</b>' : ''}</span></div><div class="rank-value"><strong>${eok(row[metric])}</strong><span>억 메소</span></div></div><div class="bar-track"><div class="bar" style="width:${width}%"></div></div>${isBudget ? `<div class="budget-details"><span>${row.kind === 'market' ? `패키지 ${fmt(row.count)}개 · ${fmt(row.lots)}회분 구매 단위` : `${fmt(row.count)}개 구매·판매`} · 사용 ${fmt(row.spent)}캐시</span><span>잔액 ${fmt(row.cashLeft)}캐시${row.kind === 'market' ? ` + ${fmt(row.pointsLeft)}메포` : ''}</span></div>` : ''}</article>`;
  }).join('');
}
document.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.setting) state[input.dataset.setting] = input.value === '' ? '' : input.valueAsNumber;
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
  if (button.dataset.budget) { state.budget = Number(button.dataset.budget); renderSettings(); }
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
    if (!confirm('저장된 입력값과 아이템 목록을 예시로 초기화할까요?')) return;
    state = defaults(); renderSettings(); renderItems();
  } else return;
  save(); render();
});
renderSettings(); renderItems(); render();
