'use strict';
const KEY = 'suivi-kuroiler-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Math.round(n).toLocaleString('fr-FR');
const F = n => num(n) + ' F';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const sum = (a, k) => a.reduce((t, x) => t + (+x[k] || 0), 0);

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

const SEED = [['Achat des poussins (50)', 37500], ['Transport', 2000], ['Divers', 1000], ['Vitamines', 8500], ['Ampoule chauffante', 500]];

let S = load();
function load() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const s = Object.assign({ start: today(), initial: 50, capital: 60000, logs: {}, done: {} }, o);
  if (!Array.isArray(s.depenses)) s.depenses = SEED.map(([label, montant], i) => ({ id: 's' + i, date: s.start, label, montant }));
  if (!Array.isArray(s.ventes)) s.ventes = [];
  for (const l of Object.values(s.logs)) { // ancienne version : kg -> g
    if (l.feed !== undefined && l.feedg === undefined) l.feedg = Math.round(l.feed * 1000);
    delete l.feed;
  }
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Erreur de sauvegarde'); } }

const dayOf = date => Math.round((Date.parse(date) - Date.parse(S.start)) / 864e5);
const phase = d => d < 0 ? 'Avant arrivée' : d <= 28 ? 'Démarrage' : d <= 84 ? 'Croissance' : 'Entretien';
const target = d => d < 0 ? null : d <= 7 ? 35 : d <= 14 ? 32 : d <= 21 ? 29 : d <= 28 ? 26 : null;

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

function vivantsAt(date) {
  let m = 0, v = 0;
  for (const [dt, l] of Object.entries(S.logs)) if (dt <= date) m += l.morts || 0;
  for (const x of S.ventes) if (x.date <= date) v += +x.nb || 0;
  return S.initial - m - v;
}

function stats() {
  const morts = sum(Object.values(S.logs), 'morts');
  const vendus = sum(S.ventes, 'nb');
  const dep = sum(S.depenses, 'montant'), ven = sum(S.ventes, 'montant');
  return { morts, vendus, vivants: S.initial - morts - vendus, dep, ven, benef: ven - dep, treso: S.capital - dep + ven };
}

const kv = (a, b, neg) => `<div class="it"><span>${a}</span><b class="${neg ? 'neg' : ''}">${b}</b></div>`;

function report() {
  const st = stats(), d = dayOf(today()), dates = Object.keys(S.logs).sort();
  const feedDays = dates.filter(x => S.logs[x].feedg !== undefined);
  const totalG = sum(Object.values(S.logs), 'feedg');
  const avgPer = feedDays.length ? feedDays.reduce((t, x) => t + S.logs[x].feedg / Math.max(1, vivantsAt(x)), 0) / feedDays.length : 0;
  const lastW = dates.filter(x => S.logs[x].poids !== undefined).pop();
  const lastT = dates.filter(x => S.logs[x].temp !== undefined).pop();
  const survivants = st.vivants + st.vendus;
  const r = [['Lot'],
    ['Âge', d + ' jours (semaine ' + (Math.floor(d / 7) + 1) + ') · ' + phase(d)],
    ['Poussins reçus', S.initial],
    ['Vivants', st.vivants],
    ['Morts', st.morts + ' (' + (st.morts / S.initial * 100).toFixed(1) + ' %)'],
    ['Vendus', st.vendus],
    ['Alimentation'],
    ['Aliment total', num(totalG) + ' g (' + (totalG / 1000).toFixed(1).replace('.', ',') + ' kg)'],
    ['Moyenne par poussin', avgPer ? Math.round(avgPer) + ' g/jour' : '-'],
    ['Croissance'],
    ['Dernier poids moyen', lastW ? S.logs[lastW].poids + ' g (J' + dayOf(lastW) + ')' : '-'],
    ['Dernière température', lastT ? S.logs[lastT].temp + ' °C (J' + dayOf(lastT) + ')' : '-'],
    ['Finance'],
    ['Capital de départ', F(S.capital)],
    ['Dépenses', F(st.dep)],
    ['Ventes', F(st.ven)],
    ['Bénéfice / perte', F(st.benef), st.benef < 0],
    ['Trésorerie', F(st.treso), st.treso < 0]];
  if (survivants > 0) r.push(['Dépense par oiseau (vivants + vendus)', F(st.dep / survivants)]);
  if (st.vendus > 0) r.push(['Prix moyen de vente par oiseau', F(st.ven / st.vendus)]);
  return r;
}

function render() {
  const d = dayOf(today()), st = stats(), tg = target(d);
  $('#hero').innerHTML =
    `<div class="day">${Math.max(d, 0)}<small> jours</small></div>` +
    `<p><b>${phase(d)}</b> · ${tg ? 'chaleur cible ' + tg + ' °C' : 'sans chauffage'}</p>` +
    `<p>${st.vivants} vivants sur ${S.initial} · mortalité ${(st.morts / S.initial * 100).toFixed(1)} %</p>`;

  let m7 = 0;
  for (const [dt, l] of Object.entries(S.logs)) { const x = dayOf(dt); if (x >= 0 && x <= 7) m7 += l.morts || 0; }
  let al = '';
  if (m7 / S.initial > 0.02) al += '<div class="a">Mortalité élevée (> 2 % en semaine 1) : vérifie chaleur, eau et appelle le vétérinaire.</div>';
  if (st.treso < 0) al += '<div class="a">Trésorerie négative : les dépenses dépassent le capital et les ventes.</div>';
  $('#alert').innerHTML = al;

  const next = TASKS.filter(t => !S.done[t.k]).sort((a, b) => a.d - b.d)[0];
  $('#age').innerHTML = '<h2>Âge du lot</h2>' + (d < 0
    ? `<p>Arrivée dans <b>${-d} jours</b>.</p>`
    : `<p><b>${d} jours</b> (semaine ${Math.floor(d / 7) + 1}) · ${phase(d)}</p>` +
      (next ? `<p class="muted">Prochaine étape : ${esc(next.t)} — ${next.d > d ? 'dans ' + (next.d - d) + ' j (J' + next.d + ')' : 'à faire maintenant'}</p>` : ''));

  $('#tasks').innerHTML = TASKS.map(t => {
    const ok = S.done[t.k], due = !ok && d >= t.d;
    return `<li class="${ok ? 'ok' : due ? 'due' : ''}"><input type="checkbox" data-k="${t.k}" ${ok ? 'checked' : ''} aria-label="${esc(t.t)}">` +
           `<span><b>J${t.d}</b> ${esc(t.t)}</span></li>`;
  }).join('');

  const rows = Object.keys(S.logs).sort().reverse().map(dt => {
    const l = S.logs[dt], v = x => x === undefined ? '' : x;
    const per = l.feedg !== undefined ? Math.round(l.feedg / Math.max(1, vivantsAt(dt))) : '';
    return `<tr><td>J${dayOf(dt)}</td><td>${esc(dt.slice(5))}</td><td>${v(l.morts)}</td><td>${v(l.temp)}</td>` +
           `<td>${v(l.feedg)}</td><td>${per}</td><td>${v(l.poids)}</td><td class="n">${esc(l.note || '')}</td></tr>`;
  }).join('');
  $('#hist').innerHTML = '<tr><th>Jour</th><th>Date</th><th>Morts</th><th>T°</th><th>Aliment g</th><th>g/poussin</th><th>Poids g</th><th>Note</th></tr>' +
    (rows || '<tr><td colspan="8" class="muted">Aucune saisie pour l\'instant.</td></tr>');

  $('#fin').innerHTML = kv('Capital de départ', F(S.capital)) + kv('Dépenses', F(st.dep)) + kv('Ventes', F(st.ven)) +
    kv('Bénéfice / perte', F(st.benef), st.benef < 0) + kv('Trésorerie (en caisse)', F(st.treso), st.treso < 0);

  const byDate = (a, b) => b.date.localeCompare(a.date);
  const line = (k, x, extra) => `<div class="it"><span>${esc(x.label)}${extra || ''}<br><span class="muted">${esc(x.date)}</span></span>` +
    `<span><b>${F(x.montant)}</b><button class="sm" data-e="${k}:${x.id}">Modifier</button><button class="sm alt" data-x="${k}:${x.id}" aria-label="Supprimer">×</button></span></div>`;
  $('#deps').innerHTML = [...S.depenses].sort(byDate).map(x => line('d', x)).join('') || '<p class="muted">Aucune dépense.</p>';
  $('#ventes').innerHTML = [...S.ventes].sort(byDate).map(x => line('v', x, x.nb ? ' (' + x.nb + ' oiseaux)' : '')).join('') || '<p class="muted">Aucune vente.</p>';

  $('#rapport').innerHTML = report().map(r => r.length === 1 ? `<div class="it h">${r[0]}</div>` : kv(r[0], r[1], r[2])).join('');

  $('#start').value = S.start;
  $('#initial').value = S.initial;
  $('#capital').value = S.capital;
  ageLabel();
}

/* Saisie du jour */
const f = $('#f');
function ageLabel() { const d = dayOf(f.date.value); $('#agej').textContent = f.date.value ? 'Âge ce jour : ' + d + ' jours' : ''; }
function fillForm() {
  const l = S.logs[f.date.value] || {};
  f.morts.value = l.morts ?? ''; f.temp.value = l.temp ?? '';
  f.feedg.value = l.feedg ?? ''; f.poids.value = l.poids ?? ''; f.note.value = l.note || '';
  ageLabel();
}
f.date.addEventListener('change', fillForm);
f.addEventListener('submit', e => {
  e.preventDefault();
  const o = {};
  for (const k of ['morts', 'temp', 'feedg', 'poids']) if (f[k].value !== '') o[k] = +f[k].value;
  if (f.note.value.trim()) o.note = f.note.value.trim();
  if (Object.keys(o).length) S.logs[f.date.value] = o; else delete S.logs[f.date.value];
  save(); render(); toast('Enregistré');
});

/* Dépenses et ventes (ajout, modification, suppression) */
const CFG = {
  d: { key: 'depenses', form: $('#fd'), btn: 'Ajouter la dépense', fields: ['date', 'label', 'montant'] },
  v: { key: 'ventes', form: $('#fv'), btn: 'Ajouter la vente', fields: ['date', 'label', 'nb', 'montant'] }
};
function resetForm(k) {
  const c = CFG[k];
  c.form.reset(); delete c.form.dataset.id; c.form.date.value = today();
  c.form.querySelector('.go').textContent = c.btn; c.form.querySelector('.cancel').hidden = true;
}
function editItem(k, id) {
  const c = CFG[k], x = S[c.key].find(i => i.id === id);
  if (!x) return;
  c.form.dataset.id = id;
  for (const n of c.fields) c.form[n].value = x[n] ?? '';
  c.form.querySelector('.go').textContent = 'Mettre à jour';
  c.form.querySelector('.cancel').hidden = false;
  c.form.scrollIntoView({ behavior: 'smooth' });
}
for (const k of Object.keys(CFG)) {
  const c = CFG[k];
  c.form.addEventListener('submit', e => {
    e.preventDefault();
    const o = { id: c.form.dataset.id || uid() };
    for (const n of c.fields) { const v = c.form[n].value; o[n] = (n === 'label' || n === 'date') ? v.trim() : +v; }
    const a = S[c.key], i = a.findIndex(x => x.id === o.id);
    if (i >= 0) a[i] = o; else a.push(o);
    save(); resetForm(k); render(); toast('Enregistré');
  });
  c.form.querySelector('.cancel').addEventListener('click', () => resetForm(k));
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-e],button[data-x]');
  if (!b) return;
  const [k, id] = (b.dataset.e || b.dataset.x).split(':');
  if (b.dataset.e) editItem(k, id);
  else if (confirm('Supprimer cette ligne ?')) { S[CFG[k].key] = S[CFG[k].key].filter(x => x.id !== id); save(); render(); }
});

/* Tâches, réglages, onglets */
$('#tasks').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  S.done[k] = e.target.checked; save(); render();
});
$('#start').addEventListener('change', e => { if (e.target.value) { S.start = e.target.value; save(); render(); } });
$('#initial').addEventListener('change', e => { if (+e.target.value > 0) { S.initial = +e.target.value; save(); render(); } });
$('#capital').addEventListener('change', e => { if (e.target.value !== '') { S.capital = +e.target.value; save(); render(); } });

document.querySelector('nav').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]'); if (!b) return;
  for (const x of document.querySelectorAll('nav button')) x.setAttribute('aria-current', x === b);
  for (const t of ['suivi', 'finance', 'rapport']) $('#tab-' + t).hidden = t !== b.dataset.t;
  window.scrollTo(0, 0);
});

$('#copy').addEventListener('click', async () => {
  const txt = 'RAPPORT KUROILER - ' + today() + '\n' +
    report().map(r => r.length === 1 ? '\n' + r[0].toUpperCase() : r[0] + ' : ' + r[1]).join('\n');
  try { await navigator.clipboard.writeText(txt); toast('Rapport copié'); } catch (x) { toast('Copie impossible'); }
});

$('#exp').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = 'suivi-kuroiler-' + today() + '.json'; a.click();
});
$('#imp').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', e => {
  const r = new FileReader();
  r.onload = () => {
    try { const o = JSON.parse(r.result); if (!o.logs) throw 0; localStorage.setItem(KEY, JSON.stringify(o)); S = load(); save(); render(); fillForm(); toast('Restauré'); }
    catch (x) { toast('Fichier invalide'); }
  };
  if (e.target.files[0]) r.readAsText(e.target.files[0]);
});

f.date.value = today();
resetForm('d'); resetForm('v');
fillForm();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
