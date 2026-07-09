/* ======================================================================
   4. UI WIRING
   ====================================================================== */
const el = id => document.getElementById(id);
const codeInput = el('codeInput');
const exampleSelect = el('exampleSelect');
const errorNote = el('errorNote');

let trace = [];
let currentIndex = -1;
let playing = false;
let playTimer = null;
let speed = 0.75;
const BASE_INTERVAL = 1500;
let autoplayTimer = null;

const typeInfo = {
  'push':               { label: 'Call Stack',       color: 'var(--amber)', zone: 'zone-callstack' },
  'pop':                { label: 'Call Stack',       color: 'var(--amber)', zone: 'zone-callstack' },
  'await-hit':          { label: 'Call Stack',       color: 'var(--amber)', zone: 'zone-callstack' },
  'log':                { label: 'Console',          color: '#ffffff',      zone: 'zone-console' },
  'schedule-timer':     { label: 'Web APIs',         color: 'var(--cyan)',  zone: 'zone-webapis' },
  'timer-fire':         { label: 'Timer Fired',      color: 'var(--cyan)',  zone: 'zone-macrotask' },
  'schedule-microtask': { label: 'Microtask Queue',  color: 'var(--violet)',zone: 'zone-microtask' },
  'dequeue-microtask':  { label: 'Microtask Queue',  color: 'var(--violet)',zone: 'zone-microtask' },
  'dequeue-macrotask':  { label: 'Macrotask Queue',  color: 'var(--teal)',  zone: 'zone-macrotask' },
  'tick':               { label: 'Event Loop',       color: '#8891a6',      zone: 'zone-loop' },
  'done':               { label: 'Complete',         color: 'var(--teal)',  zone: 'zone-loop' },
  'other':              { label: 'Statement',        color: '#8891a6',      zone: 'zone-callstack' }
};

function populateExamples(){
  exampleSelect.innerHTML = examples.map((e, i) => `<option value="${i}">${e.name}</option>`).join('');
}

function loadExample(idx){
  clearTimeout(autoplayTimer);
  stopPlaying();
  codeInput.value = examples[idx].code;
  trace = [];
  currentIndex = -1;
  errorNote.style.display = 'none';
  renderHistory();
  clearStage();
}

function clearStage(){
  ['csList', 'waList', 'mtList', 'mcList'].forEach(id => { el(id).innerHTML = ''; });
  el('csEmpty').style.display = 'block';
  el('waEmpty').style.display = 'block';
  el('mtEmpty').style.display = 'block';
  el('mcEmpty').style.display = 'block';
  el('consoleOut').innerHTML = '';
  const badge = el('explainBadge');
  badge.textContent = 'Ready';
  badge.style.color = 'var(--muted)';
  badge.style.borderColor = 'var(--line)';
  el('explainText').innerHTML = 'Press <b>Run</b> to build the step-by-step trace and watch it play.';
  el('loopLabel').textContent = 'The Event Loop constantly asks: is the stack empty? Anything queued?';
  updateCounters();
}

function runSimulation(){
  stopPlaying();
  clearTimeout(autoplayTimer);
  try{
    validateSyntax(codeInput.value);
    trace = simulate(codeInput.value);
    errorNote.style.display = 'none';
  }catch(e){
    trace = [];
    currentIndex = -1;
    clearStage();
    errorNote.textContent = 'Î“ÃœÃ¡ ' + e.message;
    errorNote.style.display = 'block';
    renderHistory();
    updateCounters();
    return;
  }
  currentIndex = 0;
  renderHistory();
  renderStepAt(0, false);
  // Play the whole mechanism through once automatically, slowly and smoothly,
  // so the person can just watch before taking the controls themselves.
  if (trace.length > 1){
    autoplayTimer = setTimeout(() => startPlaying(), 700);
  }
}

/* ---- diffed chip rendering ---- */
function diffRenderZone(containerId, emptyId, items, chipClass){
  const container = el(containerId);
  const existing = new Map();
  container.querySelectorAll('[data-id]').forEach(node => existing.set(node.dataset.id, node));
  const wanted = new Set(items.map(it => it.id));

  existing.forEach((node, id) => {
    if (!wanted.has(id)){
      node.classList.add('chip-exit');
      setTimeout(() => node.remove(), 320);
    }
  });

  items.forEach(it => {
    let node = existing.get(it.id);
    if (!node){
      node = document.createElement('div');
      node.className = 'chip ' + chipClass + ' chip-enter';
      node.dataset.id = it.id;
      container.appendChild(node);
    }
    node.textContent = it.label + (it.delay !== undefined ? ` (${it.delay}ms)` : '');
    container.appendChild(node); // reorders into place
  });

  el(emptyId).style.display = items.length ? 'none' : 'block';
}

function renderConsole(outputArr){
  const box = el('consoleOut');
  box.innerHTML = outputArr.map((line, i) =>
    `<div class="console-line${i === outputArr.length - 1 ? ' latest' : ''}"><span class="idx">${i + 1}</span>${escapeHtml(line)}</div>`
  ).join('');
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s){
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

function flashZone(zoneClass){
  document.querySelectorAll('.zone').forEach(z => z.classList.remove('flash'));
  if (!zoneClass) return;
  const zone = document.querySelector('.' + zoneClass);
  if (!zone) return;
  void zone.offsetWidth;
  zone.classList.add('flash');
}

function pulseHub(){
  const hub = el('loopHub');
  hub.classList.remove('pulse');
  void hub.offsetWidth;
  hub.classList.add('pulse');
  setTimeout(() => hub.classList.remove('pulse'), 900);
}

function renderStepAt(idx, animate){
  const step = trace[idx];
  if (!step) return;

  diffRenderZone('csList', 'csEmpty', step.stack, 'cs');
  diffRenderZone('waList', 'waEmpty', step.webApis, 'wa');
  diffRenderZone('mtList', 'mtEmpty', step.microtaskQ, 'mt');
  diffRenderZone('mcList', 'mcEmpty', step.macrotaskQ, 'mc');
  renderConsole(step.output);

  const info = typeInfo[step.type] || { label: step.type, color: '#8891a6', zone: null };
  const badge = el('explainBadge');
  badge.textContent = info.label;
  badge.style.color = info.color;
  badge.style.borderColor = info.color;
  el('explainText').textContent = step.desc;
  el('loopLabel').textContent = step.desc;

  if (animate){
    flashZone(info.zone);
    if (['dequeue-microtask','dequeue-macrotask','timer-fire','tick'].includes(step.type)) pulseHub();
  }

  updateCounters();
  highlightHistory(idx);
}

function updateCounters(){
  el('stepNow').textContent = currentIndex + 1 > 0 ? currentIndex + 1 : 0;
  el('stepTotal').textContent = trace.length;
}

function renderHistory(){
  const wrap = el('historyScroll');
  wrap.innerHTML = trace.map((s, i) =>
    `<div class="history-item" data-idx="${i}"><span class="h-idx">${i + 1}.</span>${escapeHtml(s.desc)}</div>`
  ).join('');
  wrap.querySelectorAll('.history-item').forEach(node => {
    node.addEventListener('click', () => {
      clearTimeout(autoplayTimer);
      stopPlaying();
      currentIndex = parseInt(node.dataset.idx, 10);
      renderStepAt(currentIndex, true);
    });
  });
  highlightHistory(currentIndex);
}

function highlightHistory(idx){
  document.querySelectorAll('.history-item').forEach(node => {
    node.classList.toggle('active', parseInt(node.dataset.idx, 10) === idx);
  });
  const active = document.querySelector('.history-item.active');
  if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

/* ---- transport controls ---- */
function stepForward(){
  if (currentIndex < trace.length - 1){
    currentIndex++;
    renderStepAt(currentIndex, true);
  } else {
    stopPlaying();
  }
}
function stepBack(){
  if (currentIndex > 0){
    currentIndex--;
    renderStepAt(currentIndex, true);
  }
}
function stopPlaying(){
  playing = false;
  clearTimeout(playTimer);
  el('playBtn').textContent = 'Î“Ã»â•¢ Play';
}
function startPlaying(){
  if (!trace.length) return;
  if (currentIndex >= trace.length - 1) currentIndex = 0;
  playing = true;
  el('playBtn').textContent = 'Î“Ã…â•• Pause';
  tick();
}
function tick(){
  if (!playing) return;
  renderStepAt(currentIndex, true);
  if (currentIndex >= trace.length - 1){
    stopPlaying();
    return;
  }
  playTimer = setTimeout(() => {
    currentIndex++;
    tick();
  }, BASE_INTERVAL / speed);
}
function togglePlay(){
  if (playing) stopPlaying(); else startPlaying();
}

/* ---- events ---- */
populateExamples();
exampleSelect.addEventListener('change', e => loadExample(parseInt(e.target.value, 10)));
el('runBtn').addEventListener('click', runSimulation);
el('runBtn2').addEventListener('click', runSimulation);
el('resetBtn').addEventListener('click', () => { clearTimeout(autoplayTimer); stopPlaying(); currentIndex = trace.length ? 0 : -1; if (trace.length) renderStepAt(0, false); });
el('backBtn').addEventListener('click', () => { clearTimeout(autoplayTimer); stopPlaying(); stepBack(); });
el('fwdBtn').addEventListener('click', () => { clearTimeout(autoplayTimer); stopPlaying(); stepForward(); });
el('playBtn').addEventListener('click', () => { clearTimeout(autoplayTimer); togglePlay(); });
el('speedRange').addEventListener('input', e => {
  speed = parseFloat(e.target.value);
  el('speedLabel').textContent = speed + 'â”œÃ¹';
});

loadExample(0);
