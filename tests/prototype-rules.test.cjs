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
