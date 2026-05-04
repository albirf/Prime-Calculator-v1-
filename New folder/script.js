/* ============================================================
   PRIME CALCULATOR — script.js
   ============================================================ */

'use strict';

// ── DOM refs ──────────────────────────────────────────────────
const resultEl      = document.getElementById('result');
const expressionEl  = document.getElementById('expression');
const historyList   = document.getElementById('historyList');
const themeToggle   = document.getElementById('themeToggle');
const historyToggle = document.getElementById('historyToggle');
const historyPanel  = document.getElementById('historyPanel');
const clearHistBtn  = document.getElementById('clearHistory');
const copyBtn       = document.getElementById('copyBtn');
const copyLabel     = document.getElementById('copyLabel');
const calcDisplay   = document.querySelector('.display');

// ── State ─────────────────────────────────────────────────────
let currentInput   = '0';
let expression     = '';
let justCalculated = false;
let history        = JSON.parse(localStorage.getItem('primeCalcHistory') || '[]');

// ── Audio Context (click sounds) ──────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playClick(type = 'num') {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const map = { num: [660, 0.06], op: [880, 0.06], eq: [1100, 0.10], fn: [440, 0.05] };
    const [freq, vol] = map[type] || map.num;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) { /* audio blocked — silent fail */ }
}

// ── Display helpers ───────────────────────────────────────────
function updateDisplay(value, expr = '') {
  const str = String(value);
  resultEl.textContent = str;
  expressionEl.textContent = expr;

  // Shrink font for long numbers
  const len = str.replace('-','').length;
  resultEl.style.fontSize = len > 12 ? '1.4rem' : len > 9 ? '1.9rem' : '';
  resultEl.classList.toggle('has-value', str !== '0' && str !== 'Error');
}

function showError(msg = 'Error') {
  currentInput = 'Error';
  expression   = '';
  updateDisplay('Error');
  calcDisplay.classList.add('error');
  setTimeout(() => calcDisplay.classList.remove('error'), 500);
}

// ── Ripple effect ─────────────────────────────────────────────
function triggerRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = ((e.clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width * 100;
  const y = ((e.clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height * 100;
  btn.style.setProperty('--ripple-x', x + '%');
  btn.style.setProperty('--ripple-y', y + '%');
  btn.classList.remove('rippling');
  void btn.offsetWidth; // reflow
  btn.classList.add('rippling');
  setTimeout(() => btn.classList.remove('rippling'), 500);
}

// ── History ───────────────────────────────────────────────────
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<li class="empty-hist">No calculations yet</li>';
    return;
  }
  historyList.innerHTML = '';
  [...history].reverse().forEach(item => {
    const li = document.createElement('li');
    li.className = 'hist-item';
    li.innerHTML = `<div class="hist-expr">${item.expr}</div><div class="hist-result">${item.result}</div>`;
    li.addEventListener('click', () => {
      currentInput = String(item.result);
      expression   = '';
      justCalculated = true;
      updateDisplay(currentInput);
    });
    historyList.appendChild(li);
  });
}

function addHistory(expr, result) {
  history.push({ expr, result });
  if (history.length > 50) history.shift();
  localStorage.setItem('primeCalcHistory', JSON.stringify(history));
  renderHistory();
}

renderHistory();

// ── Core calculation logic ────────────────────────────────────
function safeEval(expr) {
  // Replace display symbols with JS operators
  const sanitised = expr
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/π/g, Math.PI)
    .replace(/\^/g, '**');

  // Whitelist check
  if (!/^[\d+\-*/().%eE ]+$/.test(sanitised)) throw new Error('Invalid');

  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + sanitised + ')')();
  if (!isFinite(result)) throw new Error('Overflow');
  return result;
}

function formatResult(num) {
  if (Number.isInteger(num) && Math.abs(num) < 1e15) return String(num);
  // Limit decimal places for display
  const str = parseFloat(num.toPrecision(12)).toString();
  return str;
}

// ── Button actions ────────────────────────────────────────────
function handleAction(action, e, btn) {
  const digits = '0123456789';
  const operators = ['÷', '×', '+', '-', '−'];

  if (btn) triggerRipple(btn, e || {});

  // Digits
  if (digits.includes(action)) {
    playClick('num');
    if (justCalculated) { currentInput = action; expression = ''; justCalculated = false; }
    else currentInput = currentInput === '0' ? action : currentInput + action;
    updateDisplay(currentInput, expression);
    return;
  }

  // Decimal
  if (action === '.') {
    playClick('num');
    if (justCalculated) { currentInput = '0.'; justCalculated = false; }
    else if (!currentInput.includes('.')) currentInput += '.';
    updateDisplay(currentInput, expression);
    return;
  }

  // Clear All
  if (action === 'clear') {
    playClick('fn');
    currentInput = '0'; expression = ''; justCalculated = false;
    updateDisplay('0', '');
    return;
  }

  // Delete last
  if (action === 'del') {
    playClick('fn');
    if (justCalculated) { currentInput = '0'; justCalculated = false; }
    else currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';
    updateDisplay(currentInput, expression);
    return;
  }

  // Percentage
  if (action === '%') {
    playClick('op');
    try {
      const val = formatResult(parseFloat(currentInput) / 100);
      currentInput = val;
      updateDisplay(currentInput, expression);
    } catch (_) { showError(); }
    return;
  }

  // Operators
  if (operators.includes(action)) {
    playClick('op');
    const displayOp = action === '-' ? '−' : action;
    // If expression already ends with an operator, replace it
    if (expression && /[÷×+−-]$/.test(expression.trim())) {
      expression = expression.trim().slice(0, -1) + displayOp + ' ';
    } else {
      expression = (expression || currentInput) + ' ' + displayOp + ' ';
      currentInput = '0';
    }
    justCalculated = false;
    updateDisplay(currentInput, expression);
    return;
  }

  // Equals
  if (action === '=') {
    playClick('eq');
    const fullExpr = (expression + currentInput).trim();
    if (!fullExpr) return;
    try {
      const raw = safeEval(fullExpr);
      const res = formatResult(raw);
      addHistory(fullExpr, res);
      expression = fullExpr + ' =';
      currentInput = res;
      justCalculated = true;
      updateDisplay(res, fullExpr + ' =');
    } catch (_) { showError(); }
    return;
  }

  // ── Scientific functions ──────────────────────────────────────
  const sciMap = {
    sin:    v => Math.sin(v * Math.PI / 180),
    cos:    v => Math.cos(v * Math.PI / 180),
    tan:    v => Math.tan(v * Math.PI / 180),
    sqrt:   v => Math.sqrt(v),
    square: v => v * v,
    log:    v => Math.log10(v),
    pi:     ()=> Math.PI,
  };

  if (sciMap[action]) {
    playClick('op');
    try {
      const input = parseFloat(currentInput);
      const raw   = sciMap[action](input);
      if (!isFinite(raw) || isNaN(raw)) throw new Error('Domain error');
      const res = formatResult(raw);
      const label = action === 'pi' ? 'π' :
                    action === 'sqrt' ? '√(' + currentInput + ')' :
                    action === 'square' ? currentInput + '²' :
                    action + '(' + currentInput + '°)';
      addHistory(label, res);
      expression   = label + ' =';
      currentInput = res;
      justCalculated = true;
      updateDisplay(res, label + ' =');
    } catch (_) { showError('Domain Error'); }
  }
}

// ── Button click events ───────────────────────────────────────
document.querySelectorAll('.calc-btn, .sci-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    handleAction(btn.dataset.action, e, btn);
  });
});

// ── Keyboard support ──────────────────────────────────────────
const keyMap = {
  '0':'0','1':'1','2':'2','3':'3','4':'4',
  '5':'5','6':'6','7':'7','8':'8','9':'9',
  '.':'.', ',':'.',
  '+':'+', '-':'-', '*':'×', '/':'÷',
  'Enter':'=', '=':'=',
  'Backspace':'del', 'Delete':'clear', 'Escape':'clear',
  '%':'%',
};

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const action = keyMap[e.key];
  if (!action) return;
  e.preventDefault();

  // Highlight matching button briefly
  const btn = [...document.querySelectorAll('.calc-btn, .sci-btn')]
    .find(b => b.dataset.action === action);
  if (btn) {
    btn.classList.add('rippling');
    setTimeout(() => btn.classList.remove('rippling'), 200);
  }
  handleAction(action, null, null);
});

// ── Copy result ───────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  const text = resultEl.textContent;
  if (!text || text === 'Error') return;
  try {
    await navigator.clipboard.writeText(text);
    copyLabel.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyLabel.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 1800);
  } catch (_) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    copyLabel.textContent = 'Copied!';
    setTimeout(() => (copyLabel.textContent = 'Copy'), 1800);
  }
});

// ── Theme toggle ──────────────────────────────────────────────
const savedTheme = localStorage.getItem('primeCalcTheme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('primeCalcTheme', next);
  playClick('fn');
});

// ── History panel toggle ──────────────────────────────────────
historyToggle.addEventListener('click', () => {
  historyPanel.classList.toggle('open');
  playClick('fn');
});

clearHistBtn.addEventListener('click', () => {
  history = [];
  localStorage.removeItem('primeCalcHistory');
  renderHistory();
  playClick('fn');
});

// Close history on outside click
document.addEventListener('click', (e) => {
  if (!historyPanel.contains(e.target) && e.target !== historyToggle) {
    historyPanel.classList.remove('open');
  }
});
