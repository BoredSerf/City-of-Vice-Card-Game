const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function load_engine() {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
  const source = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
  const module_stub = {exports: {}};
  Function('document', 'module', 'exports', source)(
    {getElementById: () => ({})},
    module_stub,
    module_stub.exports,
  );
  return module_stub.exports;
}

const engine = load_engine();

function complete_crew(player, crew) {
  player.active.push(...engine.CARDS.filter((card) => card.crew === crew).map((card) => card.id));
}

function drawing_state(who = 0) {
  const state = engine.newState(() => 0.5);
  state.current = who;
  state.phase = 'play';
  const player = state.players[who];
  player.active = [0, 24];
  player.hand = [25, 26];
  player.res.Green = 1;
  player.drawPrice = 1;
  state.deck = state.deck.filter((id) => id !== 27);
  state.deck.push(27);
  return state;
}

test('drawing a fourth possessed legit business forces one inactive legit to be cashed', () => {
  const state = drawing_state();

  assert.equal(engine.drawCard(state, 0, ['Green']), null);
  assert.equal(state.phase, 'legit_cash');
  assert.equal(engine.legitPossessionCount(state.players[0]), 4);
  assert.equal(engine.activateCard(state, 0, 25), 'Finish the current step first.');

  assert.equal(engine.cashPendingLegit(state, 0, 25, 'Blue'), null);
  assert.equal(state.phase, 'play');
  assert.equal(engine.legitPossessionCount(state.players[0]), 3);
  assert.ok(state.discard.includes(25));
  assert.equal(state.players[0].res.Blue, 1);
});

test('the rival resolves a forced legit cash before taking another action', () => {
  const state = drawing_state(1);
  engine.drawCard(state, 1, ['Green']);

  assert.equal(engine.actAI(state), true);
  assert.equal(state.phase, 'play');
  assert.equal(engine.legitPossessionCount(state.players[1]), 3);
  assert.ok(state.discard.includes(27));
});

test('drawing a non-legit card does not create a forced decision', () => {
  const state = drawing_state();
  state.deck.push(1);

  assert.equal(engine.drawCard(state, 0, ['Green']), null);
  assert.equal(state.phase, 'play');
  assert.equal(state.pendingLegitCash, undefined);
});

test('each completed crew applies its distinct rules bonus', () => {
  const docks = engine.newState(() => 0.5);
  docks.phase = 'play';
  docks.players[0].active = [];
  docks.players[0].hand = [];
  complete_crew(docks.players[0], 'The Docks');
  docks.players[0].res.Green = 1;
  docks.deck = [24, 25];
  assert.equal(engine.drawCard(docks, 0, ['Green'], true), null);
  assert.equal(docks.phase, 'draw_discard');
  assert.deepEqual(docks.pendingDrawDiscard.ids, [25, 24]);
  assert.equal(engine.discardDrawChoice(docks, 0, 25), null);
  assert.ok(docks.players[0].hand.includes(24));
  assert.ok(docks.discard.includes(25));

  const club = engine.newState(() => 0.5);
  complete_crew(club.players[0], 'Club Circuit');
  assert.equal(engine.operatorLimit(club.players[0]), 2);
  club.phase = 'play';
  club.players[0].active.push(30);
  club.players[0].res.Purple = 1;
  club.players[0].res.Black = 1;
  club.players[1].active = [6, 9];
  assert.equal(engine.useOperator(club, 0, 30, [6, 9]), null);
  assert.ok(club.discard.includes(6));
  assert.ok(club.discard.includes(9));

  const trailer = engine.newState(() => 0.5);
  trailer.phase = 'play';
  trailer.players[0].active = [0, 30];
  trailer.players[0].res.Purple = 1;
  trailer.players[1].active = [6, 7, 8];
  assert.equal(engine.useOperator(trailer, 0, 30, 6), null);
  assert.ok(trailer.players[1].hand.includes(6));
  assert.ok(!trailer.discard.includes(6));
  const buyout = engine.newState(() => 0.5);
  buyout.phase = 'play';
  buyout.players[0].active = [0, 34];
  buyout.players[0].res.Purple = 2;
  buyout.players[1].active = [6, 7, 8];
  assert.equal(engine.useOperator(buyout, 0, 34, 6), null);
  assert.ok(buyout.players[1].hand.includes(6));
  assert.ok(!buyout.players[0].active.includes(6));

  const burbs = engine.newState(() => 0.5);
  burbs.players[0].active = [];
  burbs.players[0].hand = [];
  complete_crew(burbs.players[0], 'The Burbs');
  const hand_before = burbs.players[0].hand.length;
  engine.startTurn(burbs, 0);
  assert.equal(burbs.players[0].hand.length, hand_before + 1);

  const pipeline = engine.newState(() => 0.5);
  pipeline.phase = 'play';
  pipeline.players[0].active = [0, 30];
  pipeline.players[1].active = [];
  complete_crew(pipeline.players[1], 'Pipeline');
  pipeline.players[1].res.Green = 1;
  assert.equal(engine.useOperator(pipeline, 0, 30, 12), null);
  assert.ok(pipeline.players[1].active.includes(30));

  const night = engine.newState(() => 0.5);
  night.players[0].active = [];
  complete_crew(night.players[0], 'Night Shift');
  assert.equal(engine.resourceLimit(night.players[0]), 12);
  engine.startTurn(night, 0);
  assert.equal(engine.total(night.players[0].res), 4);

  const arts = engine.newState(() => 0.5);
  arts.phase = 'play';
  arts.players[0].active = [];
  complete_crew(arts.players[0], 'Arts District');
  arts.players[1].active = [0];
  arts.players[0].res.Purple = 1;
  arts.players[0].res.Green = 1;
  assert.equal(engine.tradeDistributors(arts, 0, 18, 0), null);
  assert.ok(arts.players[0].active.includes(0));
  assert.equal(engine.total(arts.players[0].res), 0);
  assert.match(engine.tradeDistributors(arts, 0, 19, 18), /once per turn/);

  const hills = engine.newState(() => 0.5);
  hills.phase = 'play';
  hills.players[0].active = [];
  complete_crew(hills.players[0], 'Hill Country');
  hills.players[0].res.Green = 2;
  assert.equal(engine.tradeRate(hills.players[0]), 2);
  assert.equal(engine.tradeResources(hills, 0, 'Green', 'Blue'), null);
  assert.equal(hills.players[0].res.Blue, 1);
});

test('the forced legit cash decision renders the normal illustrated card treatment', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(html, /class="v-forced-legit-grid"/);
  assert.match(html, /choices\.map\(forcedLegitCardView\)/);
  assert.match(html, /function forcedLegitCardView\(id\)[\s\S]*portrait\(c\)[\s\S]*class="v-protected"/);
  assert.ok(html.includes('aria-label="Cash \'+escapeHTML(c.name)+\' for 1 '));
});

test('elimination outcomes use concise results with the standard outcome artwork', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.ok(html.includes("won?'Brutal Victory':'Brutal Defeat'"));
  assert.doesNotMatch(html, /Hostile Takeover|you got lucky|bad luck/);
  assert.ok(html.includes("LOBBY_ART[over?(won?'win':'lose'):'menu']"));
  assert.doesNotMatch(html, /is-violent|violentCrewArt|VIOLENT END/);
});

test('victory achievements cover brutal wins, streaks, crews, and color monopolies', () => {
  const state = engine.newState(() => 0.5);
  state.winner = 0;
  state.winReason = 'elimination';
  const crew = engine.CREWS[0][0];
  const crew_ids = engine.CARDS.filter((card) => card.type === 'illegal' && card.crew === crew).map((card) => card.id);
  const color = engine.COLORS[0];
  const color_ids = engine.CARDS.filter((card) => card.type !== 'operator' && card.color === color).map((card) => card.id);
  state.players[0].active = [...new Set([...crew_ids, ...color_ids])];

  const earned = engine.earnedVictoryAchievements(state, 10);
  assert.ok(earned.includes('brutal'));
  assert.ok(earned.includes('streak-10'));
  assert.ok(earned.includes(`crew-${crew}`));
  assert.ok(earned.includes(`monopoly-${color}`));
});

test('defeats never earn victory achievements', () => {
  const state = engine.newState(() => 0.5);
  state.winner = 1;
  state.winReason = 'elimination';
  state.players[0].active = engine.CARDS.map((card) => card.id);

  assert.deepEqual(engine.earnedVictoryAchievements(state, 10), []);
});

test('the menu exposes resume and achievement controls backed by separate saves', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.ok(html.includes('data-action="resume">Resume game'));
  assert.ok(html.includes('data-action="show-achievements">Achievements'));
  assert.ok(html.includes("const ACHIEVEMENT_KEY='city-of-vice-achievements-v1'"));
  assert.match(html, /loadAchievements\(\);loadSaved\(\);render\(\);/);
});

test('operator results use quick, distinct eliminate, bounce, and acquire effects', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(html, /\.v-fx-kill \.v-fx-image\{animation:v-eliminate 1\.15s/);
  assert.match(html, /\.v-fx-coerce \.v-fx-image\{animation:v-bounce 1\.15s/);
  assert.match(html, /\.v-fx-buy \.v-fx-image\{animation:v-acquire 1\.15s/);
  assert.ok(html.includes("'Hitman · Eliminate'"));
  assert.ok(html.includes("'Ruffian · Bounce crew'"));
  assert.ok(html.includes("'Fixer · Acquire'"));
  assert.match(html, /reduced\?100:1450\+fx\.targets\.length\*80/);
});

test('business totals stay visible at the top while the board scrolls', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(html, /#vice-smart\{[^}]*overflow:clip/);
  assert.match(html, /\.v-race\{position:sticky;top:0;z-index:10;/);
  assert.match(html, /\.v-race\{[^}]*background:#17271ff2;[^}]*backdrop-filter:blur\(6px\)/);
});

test('the player resource bank is a compact, subtle bottom bar at every screen width', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(html, /<div class="v-player-content">[\s\S]*<aside class="v-bank v-player-bank" aria-label="Your resources">/);
  assert.match(html, /\.v-player-layout\{display:flex;flex-direction:column;gap:24px\}/);
  assert.match(html, /\.v-player-bank\{position:fixed;bottom:0;left:50%;transform:translateX\(-50%\);z-index:11;display:grid;/);
  assert.match(html, /\.v-player-bank \.v-resource\{padding:3px 5px;background:#21352a;border-top-width:1px\}/);
  assert.match(html, /\.v-player-bank \.v-resource strong\{font-size:18px;line-height:1\.15\}/);
  assert.match(html, /\.v-player-bank \.v-resource \.v-secondary\{display:none\}/);
  assert.match(html, /@media\(max-width:740px\)\{\s*#vice-smart \.v-player-layout\{display:flex;gap:16px\}/);
  assert.match(html, /#vice-smart \.v-player-bank\{position:fixed;bottom:0;grid-template-columns:minmax\(0,1fr\) auto;width:100%;padding:6px 8px\}/);
  assert.match(html, /#vice-smart \.v-player-bank \.v-resources\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\);gap:3px\}/);
  assert.match(html, /@media\(max-width:420px\)\{[\s\S]*#vice-smart \.v-player-bank\{grid-template-columns:1fr\}/);
});

test('the draw action sits beside the turn action', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(
    html,
    /<div class="v-turn-actions">\s*<div class="v-action-cell"><button[^>]*id="v-draw"[\s\S]*?<button[^>]*id="v-end"/,
  );
  assert.doesNotMatch(html, /<div class="v-toolbar">\s*<div class="v-action-cell"><button[^>]*id="v-draw"/);
  assert.match(html, /\.v-turn-actions\{display:flex;align-items:flex-start;gap:8px;flex-shrink:0\}/);
});

test('the draw action clearly distinguishes affordable and unavailable states', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.ok(html.includes('>Draw 1 (Cost 1)</button>'));
  assert.ok(html.includes("setAction('v-draw','Draw 1 (Cost '+p.drawPrice+')'"));
  assert.match(html, /#v-draw:not\(:disabled\)\{background:linear-gradient\(180deg,#fff3a8 0%,#f4c94f 100%\);[^}]*box-shadow:[^}]+\}/);
  assert.match(html, /#v-draw:hover:not\(:disabled\)\{background:linear-gradient\(180deg,#fff9cf 0%,#ffda63 100%\);/);
  assert.match(html, /#v-draw:disabled\{background:#777d78;color:#d2d5d2;border-color:#949a95;box-shadow:none;text-shadow:none\}/);
});

test('the complete browser script initializes without a runtime exception', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
  const source = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
  const target = {hidden: false, innerHTML: '', textContent: '', className: '', disabled: false, dataset: {}, style: {}};
  let element;
  element = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      if (property === 'querySelector') return () => element;
      if (property === 'querySelectorAll') return () => [];
      if (property === 'closest') return () => null;
      if (['insertBefore', 'appendChild', 'before', 'after', 'addEventListener', 'setAttribute', 'scrollIntoView'].includes(property)) return () => {};
      return undefined;
    },
  });
  target.parentElement = element;
  const document_stub = {getElementById: () => element, createElement: () => element};
  const prior_storage = global.localStorage;
  const prior_match_media = global.matchMedia;
  global.localStorage = {getItem: () => null, setItem: () => {}};
  global.matchMedia = () => ({matches: true, addEventListener: () => {}});
  try {
    Function('document', source)(document_stub);
  } finally {
    global.localStorage = prior_storage;
    global.matchMedia = prior_match_media;
  }
});

test('opening partners are grouped three per crew with one bonus description', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.match(html, /\.v-opening-members\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html, /CREWS\.map\(\(\[crew\]\)=>'<section class="v-opening-crew">/);
  assert.match(html, /class="v-opening-crew-head"[\s\S]*Bonus unlocked by completing this crew[\s\S]*class="v-opening-members"/);
  assert.match(html, /CARDS\.filter\(c=>c\.type==='illegal'&&c\.crew===crew\)/);
  assert.ok(!html.includes('class="v-opening-bonus"'));
});

test('opening crew bonuses use the revised plain-language text', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.ok(html.includes('Bonus unlocked by completing this crew'));
  assert.ok(html.includes('draw 2 cards instead of 1'));
  assert.ok(html.includes('full ability cost for each target'));
  assert.ok(html.includes('return it to your hand instead'));
  assert.ok(html.includes('Draw 1 free card each time you collect income'));
  assert.ok(html.includes('cancel the attack and take control of it'));
  assert.ok(html.includes('hold up to 12 resources instead of 10'));
  assert.ok(html.includes('Pay both Distributors’ activation costs'));
  assert.ok(html.includes('instead of paying 4'));
  assert.match(html, /<h2>Crew bonuses<\/h2>/);
  assert.match(html, /crewBonusReference\(\)/);
});

test('crew bonus changes do not leave duplicate or stale implementations', () => {
  const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

  assert.equal((html.match(/^const CREW_BONUSES=/gm) || []).length, 1);
  assert.equal((html.match(/^function tradeDistributors\(/gm) || []).length, 1);
  assert.equal(
    (html.match(/^  lobby\.innerHTML='<div class="v-lobby-copy"><h1>Choose your first business partner/gm) || []).length,
    1,
  );
  assert.doesNotMatch(html, /Whenever you pay to draw/);
  assert.doesNotMatch(html, /target and gift costs/);
  assert.doesNotMatch(html, /<strong>Complete crew bonus:/);
  assert.doesNotMatch(html, /^(<<<<<<<|=======|>>>>>>>)/m);
});
