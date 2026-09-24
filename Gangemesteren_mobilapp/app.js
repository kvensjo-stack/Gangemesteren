const $ = (id) => document.getElementById(id);
const TABLES = [2,3,4,5,6,7,8,9];
const state = {
  selected: new Set([2,3,4,5]), questions: [], index: 0, correct: 0,
  streak: 0, answered: false, sound: true, sessionStats: {}
};

function getStats() {
  try { return JSON.parse(localStorage.getItem('gangemesterenStats')) || {sessions:0, correct:0, total:0, tables:{}}; }
  catch { return {sessions:0, correct:0, total:0, tables:{}}; }
}
function saveStats(stats) { localStorage.setItem('gangemesterenStats', JSON.stringify(stats)); }

function buildPicker() {
  $('tablePicker').innerHTML = '';
  TABLES.forEach(n => {
    const b = document.createElement('button');
    b.className = 'table-chip' + (state.selected.has(n) ? ' selected' : '');
    b.textContent = `${n} ×`;
    b.setAttribute('aria-pressed', state.selected.has(n));
    b.onclick = () => { state.selected.has(n) ? state.selected.delete(n) : state.selected.add(n); buildPicker(); };
    $('tablePicker').appendChild(b);
  });
}
function selectPreset(kind) {
  const values = kind === 'easy' ? [2,3,4,5] : kind === 'hard' ? [6,7,8,9] : TABLES;
  state.selected = new Set(values); buildPicker();
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  $('homeBtn').classList.toggle('hidden', id === 'startScreen');
  window.scrollTo({top:0, behavior:'smooth'});
}
function rand(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function factorFor(level) {
  if (level === 'rolig') return 1 + Math.floor(Math.random()*5);
  if (level === 'utfordring') return 6 + Math.floor(Math.random()*7);
  return 1 + Math.floor(Math.random()*10);
}
function makeQuestion(level, forcedType) {
  const table = rand([...state.selected]);
  const factor = factorFor(level);
  const product = table * factor;
  const types = level === 'rolig' ? ['direct','direct','missing','sequence'] :
                level === 'utfordring' ? ['direct','missing','reverse','sequence','story'] :
                ['direct','direct','missing','reverse','sequence','story'];
  const type = forcedType || rand(types);
  if (type === 'missing') return {table, type, label:'FINN TALLET', text:`${table} × ? = ${product}`, answer:factor, hint:'Hvilket tall mangler?'};
  if (type === 'reverse') return {table, type, label:'DEL OPP', text:`${product} ÷ ${table} = ?`, answer:factor, hint:'Tenk motsatt vei i gangetabellen.'};
  if (type === 'sequence') {
    const start = Math.max(0, factor-2);
    return {table, type, label:'FORTSETT REKKA', text:`${start*table}, ${(start+1)*table}, ${(start+2)*table}, ?`, answer:(start+3)*table, hint:`Legg til ${table}.`};
  }
  if (type === 'story') {
    const nouns = [
      ['poser', 'kuler'], ['esker', 'blyanter'], ['lag', 'spillere'], ['bord', 'glass']
    ];
    const [groups, items] = rand(nouns);
    return {table, type, label:'TEKSTOPPGAVE', text:`Det er ${factor} ${groups} med ${table} ${items} i hver. Hvor mange ${items} er det til sammen?`, answer:product, hint:`Regn ${factor} × ${table}.`};
  }
  return {table, type:'direct', label:'REGN UT', text:`${factor} × ${table} = ?`, answer:product, hint:''};
}
function buildSession() {
  const count = Number($('questionCount').value);
  const level = $('difficulty').value;
  const seedTypes = ['direct','missing','sequence','reverse','story'];
  state.questions = Array.from({length:count}, (_,i) => makeQuestion(level, count >= 5 ? seedTypes[i % seedTypes.length] : undefined));
  state.questions.sort(() => Math.random() - .5);
  state.index = 0; state.correct = 0; state.streak = 0; state.answered = false; state.sessionStats = {};
}
function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;
  $('questionType').textContent = q.label;
  $('questionText').textContent = q.text;
  $('questionText').classList.toggle('story', q.type === 'story');
  $('hintText').textContent = q.hint;
  $('answerInput').value = '';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('checkBtn').classList.remove('hidden'); $('checkBtn').disabled = true;
  $('nextBtn').classList.add('hidden');
  $('progressText').textContent = `Oppgave ${state.index+1} av ${state.questions.length}`;
  $('streakText').textContent = `🔥 ${state.streak} på rad`;
  $('progressBar').style.width = `${(state.index/state.questions.length)*100}%`;
}
function enterDigit(d) {
  if (state.answered) return;
  const input = $('answerInput');
  if (input.value.length < 4) input.value += d;
  $('checkBtn').disabled = input.value === '';
}
function eraseDigit() {
  if (state.answered) return;
  $('answerInput').value = $('answerInput').value.slice(0,-1);
  $('checkBtn').disabled = $('answerInput').value === '';
}
function tone(ok) {
  if (!state.sound || !window.AudioContext) return;
  const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.frequency.value = ok ? 660 : 220; gain.gain.value = .04; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .12);
}
function checkAnswer() {
  if (state.answered) return;
  const q = state.questions[state.index];
  const value = Number($('answerInput').value);
  const ok = value === q.answer;
  state.answered = true;
  const rec = state.sessionStats[q.table] || {correct:0,total:0}; rec.total++; if (ok) rec.correct++; state.sessionStats[q.table] = rec;
  if (ok) { state.correct++; state.streak++; $('feedback').textContent = rand(['Riktig! ⭐','Supert! 🎉','Helt riktig! 🙌']); $('feedback').classList.add('good'); }
  else { state.streak = 0; $('feedback').textContent = `Nesten. Riktig svar er ${q.answer}.`; $('feedback').classList.add('bad'); }
  tone(ok); $('streakText').textContent = `🔥 ${state.streak} på rad`;
  $('checkBtn').classList.add('hidden'); $('nextBtn').classList.remove('hidden');
  $('nextBtn').textContent = state.index === state.questions.length-1 ? 'Se resultatet' : 'Neste oppgave';
}
function finishSession() {
  const stats = getStats(); stats.sessions++; stats.correct += state.correct; stats.total += state.questions.length;
  Object.entries(state.sessionStats).forEach(([t,r]) => {
    const old = stats.tables[t] || {correct:0,total:0}; old.correct += r.correct; old.total += r.total; stats.tables[t] = old;
  }); saveStats(stats);
  const pct = Math.round(state.correct/state.questions.length*100);
  $('resultEmoji').textContent = pct >= 90 ? '🏆' : pct >= 60 ? '🌟' : '💪';
  $('resultTitle').textContent = pct >= 90 ? 'Fantastisk!' : pct >= 60 ? 'Flott jobbet!' : 'Bra innsats!';
  $('resultScore').textContent = `${state.correct} av ${state.questions.length} riktige`;
  $('resultMessage').textContent = pct >= 90 ? 'Du har virkelig kontroll.' : 'Hver økt gjør gangetabellen lettere.';
  const weak = Object.entries(state.sessionStats).filter(([,r]) => r.correct < r.total).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
  $('weakTables').innerHTML = weak.length ? weak.map(([t,r]) => `<div class="weak-item"><strong>${t}-gangen</strong><br>${r.correct} av ${r.total} riktige i denne økten</div>`).join('') : '<div class="weak-item">Ingen spesielle områder. Alt satt!</div>';
  $('progressBar').style.width = '100%'; showScreen('resultScreen');
}
function nextQuestion() { if (++state.index >= state.questions.length) finishSession(); else renderQuestion(); }
function renderProgress() {
  const stats = getStats();
  $('summaryText').textContent = stats.sessions ? `${stats.sessions} økter gjennomført. ${stats.correct} av ${stats.total} oppgaver er besvart riktig.` : 'Ingen økter ennå. Start en treningsøkt for å bygge statistikk.';
  $('tableStats').innerHTML = TABLES.map(t => {
    const r = stats.tables[t] || {correct:0,total:0}; const pct = r.total ? Math.round(r.correct/r.total*100) : 0;
    return `<div class="stat-row"><div class="stat-head"><span>${t}-gangen</span><span>${r.total ? pct+' %' : 'Ikke trent'}</span></div><div class="stat-track"><div class="stat-fill" style="width:${pct}%"></div></div></div>`;
  }).join('');
}
function goHome() { showScreen('startScreen'); buildPicker(); }

TABLES.forEach(() => {}); buildPicker();
$('keypad').innerHTML = [1,2,3,4,5,6,7,8,9,0].map(n => `<button class="key" data-key="${n}">${n}</button>`).join('');
$('keypad').addEventListener('click', e => { if (e.target.matches('.key')) enterDigit(e.target.dataset.key); });
document.querySelectorAll('[data-select]').forEach(b => b.onclick = () => selectPreset(b.dataset.select));
$('startBtn').onclick = () => { if (!state.selected.size) { alert('Velg minst én gangetabell.'); return; } buildSession(); showScreen('quizScreen'); renderQuestion(); };
$('checkBtn').onclick = checkAnswer; $('nextBtn').onclick = nextQuestion; $('eraseBtn').onclick = eraseDigit;
$('retryBtn').onclick = () => { buildSession(); showScreen('quizScreen'); renderQuestion(); };
$('resultHomeBtn').onclick = goHome; $('progressHomeBtn').onclick = goHome; $('homeBtn').onclick = goHome;
$('progressBtn').onclick = () => { renderProgress(); showScreen('progressScreen'); };
$('resetBtn').onclick = () => { if (confirm('Vil du nullstille all lagret fremgang?')) { localStorage.removeItem('gangemesterenStats'); renderProgress(); } };
$('soundBtn').onclick = () => { state.sound = !state.sound; $('soundBtn').textContent = state.sound ? '🔊' : '🔇'; };
document.addEventListener('keydown', e => { if (/^[0-9]$/.test(e.key)) enterDigit(e.key); if (e.key === 'Backspace') eraseDigit(); if (e.key === 'Enter' && !$('checkBtn').classList.contains('hidden') && !$('checkBtn').disabled) checkAnswer(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
