// Headless smoke test: loads index.html with jsdom, runs scripts, plays games.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...a) => errors.push('[console.error] ' + a.map(String).join(' ')));
virtualConsole.on('jsdomError', (e) => errors.push('[jsdomError] ' + e.message));

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
window.alert = (m) => console.log('[alert]', m);

// Manually execute local scripts in order (jsdom won't fetch them for us here)
const scriptRe = /<script defer src="([^"]+)"><\/script>/g;
let m2, files = [];
while ((m2 = scriptRe.exec(html))) files.push(m2[1]);
files.forEach(f => {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  try { window.eval(code); } catch (e) { errors.push(`[script ${f}] ${e.message}`); }
});

function tick(ms) { // advance timers via real time waits
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  // fire DOMContentLoaded handlers already registered? jsdom fired it during parse;
  // our game modules register init on DOMContentLoaded with setTimeout(...,200).
  await tick(1500);

  const W = window;
  const results = {};

  // ---------- HABITAT ----------
  try {
    const H = W.HabitatGame;
    if (!H) throw new Error('HabitatGame undefined');
    H.open();
    const modal = W.document.getElementById('habitat-modal');
    if (modal.classList.contains('hidden')) throw new Error('habitat modal hidden after open');
    if (!W.document.querySelector('#habitat-biomes .habitat-biom')) throw new Error('no biome buttons');
    const info = W.document.getElementById('habitat-info-body');
    if (!info.textContent.includes('Места обитания') && !info.innerHTML.includes('hi-section'))
      throw new Error('info panel empty: ' + info.textContent.slice(0,60));
    // answer all rounds correctly by clicking correct biome each time
    let guard = 0;
    while (guard++ < 60) {
      const item = H.roundItems && H.roundItems[H.currentIdx];
      if (!item) break;
      const correct = item.biome;
      const btn = W.document.querySelector(`#habitat-biomes [data-biom="${correct}"]`);
      if (!btn) break;
      btn.click();
      if (!W.document.getElementById('habitat-next-round-btn').classList.contains('hidden')) {
        // round finished banner -> click continue
        W.document.getElementById('habitat-next-round-btn').click();
      }
      if (!W.document.getElementById('habitat-modal').classList.contains('hidden') === false) break;
      if (W.document.getElementById('habitat-end-screen') && !W.document.getElementById('habitat-end-screen').classList.contains('hidden')) break;
    }
    results.habitat = { score: H.score, mistakes: H.mistakes, logEntries: W.document.querySelectorAll('#habitat-log .hl-entry').length, endVisible: !W.document.getElementById('habitat-end-screen').classList.contains('hidden') };
    H.close();
  } catch (e) { results.habitat = 'FAIL: ' + e.message; }

  // ---------- STATUS ----------
  try {
    const S = W.StatusGame;
    S.open();
    const card = W.document.querySelector('#status-card .st-photo-card');
    if (!card) throw new Error('no photo card');
    if (!card.classList.contains('flipped')) throw new Error('card not flipped (back visible)');
    if (!W.document.querySelector('#status-options .status-option-btn')) throw new Error('no options');
    // answer 10 questions always choosing value 3 to check common-share limiting
    let q = 0;
    while (q < 12) {
      const opt = W.document.querySelector('#status-options .status-option-btn[data-value="3"]');
      if (!opt) break;
      opt.click();
      const nextBtn = W.document.getElementById('status-next-btn');
      if (nextBtn.classList.contains('hidden')) break; // shouldn't happen
      nextBtn.click();
      q++;
      if (W.document.getElementById('status-end-screen') && !W.document.getElementById('status-end-screen').classList.contains('hidden')) break;
    }
    results.status = { questions: S.qNum, score: S.score, mistakes: S.mistakes, commonUsed: S.commonUsed, endVisible: !W.document.getElementById('status-end-screen').classList.contains('hidden') };
    S.close();
  } catch (e) { results.status = 'FAIL: ' + e.message; }

  // ---------- FAMILY ----------
  try {
    const F = W.FamilyGame;
    F.open();
    const trayCards = () => W.document.querySelectorAll('#family-tray .family-card');
    if (trayCards().length !== 6) throw new Error('expected 6 tray cards, got ' + trayCards().length);
    // place ALL cards into WRONG baskets deliberately (choose basket != item.group)
    const first = F.roundItems[0];
    const wrongKey = F.groups().map(g=>g.key).find(k => k !== first.group);
    // simulate tap-place for every card into its own wrong basket
    F.roundItems.forEach(item => {
      F.selectedCard = item;
      const basket = W.document.querySelector(`#family-baskets .family-basket[data-group="${wrongKey}"]`);
      F.placeInto(wrongKey, basket);
    });
    if (F.mistakes !== 0) throw new Error('mistakes counted before check!');
    if (trayCards().length !== 0) throw new Error('cards still in tray after placing');
    // check -> all 6 wrong -> returned to tray, mistakes=6
    W.document.getElementById('family-check-btn').click();
    if (F.mistakes !== 6) throw new Error('after check mistakes should be 6, got ' + F.mistakes);
    if (trayCards().length !== 6) throw new Error('wrong cards not returned to tray, got ' + trayCards().length);
    const resEl = W.document.getElementById('family-check-result');
    if (resEl.classList.contains('hidden')) throw new Error('check result not shown');
    // now place correctly and check again
    F.roundItems.forEach(item => {
      F.selectedCard = item;
      const basket = W.document.querySelector(`#family-baskets .family-basket[data-group="${item.group}"]`);
      F.placeInto(item.group, basket);
    });
    W.document.getElementById('family-check-btn').click();
    if (F.score !== 6) throw new Error('score after correct check should be 6, got ' + F.score);
    const nextBtn = W.document.getElementById('family-next-round-btn');
    if (nextBtn.classList.contains('hidden')) throw new Error('next-round button not shown after full success');
    // rounds 2 & 3: just complete quickly
    let rounds = 0;
    while (rounds < 5) {
      nextBtn.click();
      rounds++;
      if (!W.document.getElementById('family-end-screen').classList.contains('hidden')) break;
      F.roundItems.forEach(item => {
        F.selectedCard = item;
        const basket = W.document.querySelector(`#family-baskets .family-basket[data-group="${item.group}"]`);
        F.placeInto(item.group, basket);
      });
      W.document.getElementById('family-check-btn').click();
    }
    results.family = { score: F.score, mistakes: F.mistakes, endVisible: !W.document.getElementById('family-end-screen').classList.contains('hidden') };
    F.close();
  } catch (e) { results.family = 'FAIL: ' + e.message; }

  // ---------- ERUDITE: forward only by button ----------
  try {
    const E = W.EruditeGame;
    E.open ? E.open() : documentClick('btn-erudite');
    results.erudite = 'opened';
  } catch (e) { results.erudite = 'n/a: ' + e.message; }

  console.log(JSON.stringify(results, null, 2));
  console.log('ERRORS:', errors.length ? errors.slice(0, 10) : 'none');
})();
