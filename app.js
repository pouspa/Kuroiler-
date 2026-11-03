'use strict';
const KEY = 'suivi-kuroiler-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

let S = load();
function load() {
  const def = { start: today(), initial: 50, logs: {}, done: {} };
  try { return Object.assign(def, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { return def; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Erreur de sauvegarde'); } }

const dayOf = date => Math.round((Date.parse(date) - Date.parse(S.start)) / 864e5);
const phase = d => d < 0 ? 'Avant arrivée' : d <= 28 ? 'Démarrage' : d <= 84 ? 'Croissance' : 'Entretien';
const target = d => d < 0 ? null : d <= 7 ? 35 : d <= 14 ? 32 : d <= 21 ? 29 : d <= 28 ? 26 : null;
const feedName = d => d <= 28 ? 'aliment démarrage' : d <= 84 ? 'aliment croissance' : 'aliment entretien';

const TASKS = [
  { k: 'j0',  d: 0,  t: 'Eau tiède + vitamines/sucre, aliment démarrage à volonté' },
  { k: 'nd1', d: 5,  t: 'Vaccin Newcastle (HB1)' },
  { k: 'gum', d: 12, t: 'Vaccin Gumboro' },
  { k: 'nd2', d: 21, t: 'Rappel Newcastle (La Sota)' },
  { k: 'tr',  d: 21, t: 'Transfert au poulailler si ≥ 24 °C' },
  { k: 'chf', d: 29, t: 'Arrêt chauffage, passer à l\'aliment croissance (sur 3 jours)' },
  { k: 'ent', d: 85, t: 'Passer à l\'aliment entretien (sur 3 jours)' }
];

function toast(m) {
  const t = $('#toast'); t.textContent = m; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 1800);
}

function render() {
  const d = dayOf(today());
  const morts = Object.values(S.logs).reduce((a, l) => a + (l.morts || 0), 0);
  const vivants = S.initial - morts;
  const tg = target(d);
  $('#hero').innerHTML =
    `<div class="day">J${d}</div>` +
    `<p><b>${phase(d)}</b> · ${tg ? 'chaleur cible ' + tg + ' °C' : 'sans chauffage'}</p>` +
    `<p>${vivants} vivants sur ${S.initial} · mortalité ${(morts / S.initial * 100).toFixed(1)} %</p>`;

  // alerte mortalité semaine 1
  let m7 = 0;
  for (const [dt, l] of Object.entries(S.logs)) { const x = dayOf(dt); if (x >= 0 && x <= 7) m7 += l.morts || 0; }
  $('#alert').innerHTML = m7 / S.initial > 0.02
    ? '<div class="a">Mortalité élevée (> 2 % en semaine 1) : vérifie chaleur, eau et appelle le vétérinaire.</div>' : '';

  $('#tasks').innerHTML = TASKS.map(t => {
    const ok = S.done[t.k], due = !ok && d >= t.d;
    return `<li class="${ok ? 'ok' : due ? 'due' : ''}"><input type="checkbox" data-k="${t.k}" ${ok ? 'checked' : ''} aria-label="${esc(t.t)}">` +
           `<span><b>J${t.d}</b> ${esc(t.t)}</span></li>`;
  }).join('');

  const rows = Object.keys(S.logs).sort().reverse().map(dt => {
    const l = S.logs[dt], v = x => x === undefined ? '' : x;
    return `<tr><td>J${dayOf(dt)}</td><td>${esc(dt.slice(5))}</td><td>${v(l.morts)}</td><td>${v(l.temp)}</td>` +
           `<td>${v(l.feed)}</td><td>${v(l.poids)}</td><td class="n">${esc(l.note || '')}</td></tr>`;
  }).join('');
  $('#hist').innerHTML = '<tr><th>Jour</th><th>Date</th><th>Morts</th><th>T°</th><th>kg</th><th>Poids g</th><th>Note</th></tr>' +
    (rows || '<tr><td colspan="7" class="muted">Aucune saisie pour l\'instant.</td></tr>');

  $('#start').value = S.start;
  $('#initial').value = S.initial;
}

const f = $('#f');
function fillForm() {
  const l = S.logs[f.date.value] || {};
  f.morts.value = l.morts ?? ''; f.temp.value = l.temp ?? '';
  f.feed.value = l.feed ?? ''; f.poids.value = l.poids ?? ''; f.note.value = l.note || '';
}
f.date.addEventListener('change', fillForm);
f.addEventListener('submit', e => {
  e.preventDefault();
  const o = {};
  for (const k of ['morts', 'temp', 'feed', 'poids']) if (f[k].value !== '') o[k] = +f[k].value;
  if (f.note.value.trim()) o.note = f.note.value.trim();
  if (Object.keys(o).length) S.logs[f.date.value] = o; else delete S.logs[f.date.value];
  save(); render(); toast('Enregistré');
});

$('#tasks').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  S.done[k] = e.target.checked; save(); render();
});
$('#start').addEventListener('change', e => { if (e.target.value) { S.start = e.target.value; save(); render(); } });
$('#initial').addEventListener('change', e => { if (+e.target.value > 0) { S.initial = +e.target.value; save(); render(); } });

$('#exp').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = 'suivi-kuroiler-' + today() + '.json'; a.click();
});
$('#imp').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', e => {
  const r = new FileReader();
  r.onload = () => {
    try { const o = JSON.parse(r.result); if (!o.logs) throw 0; S = Object.assign(S, o); save(); render(); fillForm(); toast('Restauré'); }
    catch (x) { toast('Fichier invalide'); }
  };
  if (e.target.files[0]) r.readAsText(e.target.files[0]);
});

f.date.value = today();
fillForm();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
