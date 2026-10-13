const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const harness_path = path.join(__dirname, 'characterization', 'harness.cjs');
const decision_fixture = () => Object.fromEntries([
  ['scenarios', 'scenarios.json'], ['decisions', 'rule_decisions.json'], ['manifest', 'manifest.json'],
].map(([key, name]) => [key, JSON.parse(fs.readFileSync(path.join(__dirname, 'characterization', name)))]));
const fixture_state = () => ({
  version: 7, turn: 1, current: 0, phase: 'play', winner: null,
  players: [0, 3].map(id => ({
    res: {Green: 0, Blue: 0, Black: 0, White: 0, Yellow: 0, Purple: 0},
    active: [id], hand: [], drawPrice: 1, suspended: [],
  })),
  deck: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
  discard: [], logs: [],
});

test('the corpus validator rejects duplicated or missing physical cards', () => {
  assert.ok(fs.existsSync(harness_path), 'S01 fixture validator is not implemented');
  const {validate_state} = require(harness_path);
  assert.doesNotThrow(() => validate_state(fixture_state()));
  const duplicate = fixture_state();
  duplicate.deck[0] = 0;
  assert.throws(() => validate_state(duplicate), /exactly once/);
  const missing = fixture_state();
  missing.deck.pop();
  assert.throws(() => validate_state(missing), /exactly once/);
});

test('invalid resources and stale suspension metadata cannot masquerade as valid fixtures', () => {
  const {validate_state} = require(harness_path);
  const bad_resource = fixture_state();
  bad_resource.players[0].res.Green = -1;
  assert.throws(() => validate_state(bad_resource), /non-negative integer/);
  const fractional = fixture_state();
  fractional.players[0].res.Green = 0.5;
  assert.throws(() => validate_state(fractional), /non-negative integer/);
  const stale = fixture_state();
  stale.players[0].suspended = [0];
  assert.throws(() => validate_state(stale), /suspended/);
});

test('invalid turn fields and missing mandatory-choice data cannot enter the corpus', () => {
  const {validate_state} = require(harness_path);
  const wrong_phase = fixture_state();
  wrong_phase.phase = 'anything';
  assert.throws(() => validate_state(wrong_phase), /phase/);
  const bad_price = fixture_state();
  bad_price.players[0].drawPrice = 0;
  assert.throws(() => validate_state(bad_price), /draw price/);
  const missing_choice = fixture_state();
  missing_choice.phase = 'draw_discard';
  assert.throws(() => validate_state(missing_choice), /pending draw/);
});

test('the validator reports phase-sensitive limits without hiding known prototype violations', () => {
  const {limit_violations} = require(harness_path);
  assert.equal(typeof limit_violations, 'function', 'Limit audit is not implemented');
  const state = fixture_state();
  state.players[0].hand = [1, 2, 4, 5, 6, 7, 8, 9];
  state.deck = state.deck.filter(id => !state.players[0].hand.includes(id));
  assert.deepEqual(limit_violations(state), ['hand_limit:0']);
  state.phase = 'draw_discard';
  state.pendingDrawDiscard = {who: 0, ids: [8, 9]};
  assert.deepEqual(limit_violations(state), []);
  state.players[1].res.Blue = 11;
  assert.deepEqual(limit_violations(state), ['resource_limit:1']);
});

test('transition checking catches unlisted mutation as well as the intended changes', () => {
  const {assert_transition} = require(harness_path);
  assert.equal(typeof assert_transition, 'function', 'Exact transition check is not implemented');
  const before = fixture_state();
  const after = structuredClone(before);
  after.players[0].res.Green = 1;
  const expected = {changes: {'players.0.res.Green': 1}, remove: [], logs: []};
  assert.doesNotThrow(() => assert_transition(before, after, expected));
  after.players[1].res.Blue = 1;
  assert.throws(() => assert_transition(before, after, expected), /deep-equal/);
});

test('the recorded reference executes the corpus without granting scenario approval', () => {
  const {verify_corpus} = require(harness_path);
  assert.equal(typeof verify_corpus, 'function', 'Candidate corpus runner is not implemented');
  const result = verify_corpus();
  assert.equal(result.inventory_count, 36);
  assert.equal(result.approved_baseline, '4ccb19703d4af1a1c202d922b514a58a17d0e537');
  assert.equal(result.scenario_count, 92);
});

test('corpus execution detects a missing payment and identifies the failing stable scenario', () => {
  const {load_prototype, run_scenario} = require(harness_path);
  const {engine, source} = load_prototype(path.resolve(__dirname, '..'));
  const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'characterization/scenarios.json')));
  const scenario = scenarios.find(value => value.id === 'S01-DRAW-001');
  const missing_payment = {...engine, drawCard: (state, who, payment, bonus) => {
    const result = engine.drawCard(state, who, payment, bonus);
    state.players[who].res.Green += 1;
    return result;
  }};
  assert.throws(() => run_scenario(missing_payment, source, scenario), /S01-DRAW-001 step 1/);
});

test('an unresolved decision cannot silently reference a missing scenario or omit its downstream gate', () => {
  const {validate_decisions} = require(harness_path);
  assert.equal(typeof validate_decisions, 'function', 'Decision traceability validation is not implemented');
  const {scenarios, decisions, manifest} = decision_fixture();
  assert.doesNotThrow(() => validate_decisions(scenarios, decisions, manifest));
  const missing = structuredClone(decisions);
  missing[2].scenario_ids = ['S01-MISSING-001'];
  assert.throws(() => validate_decisions(scenarios, missing, manifest), /Unknown scenario/);
  const ungated = structuredClone(decisions);
  ungated[2].blocked_slices = [];
  assert.throws(() => validate_decisions(scenarios, ungated, manifest), /downstream gate/);
});

test('AI target ranking wins over the defenders input order and fails when only the ranking is removed', () => {
  const {load_prototype, run_scenario} = require(harness_path);
  const {engine, source} = load_prototype(path.resolve(__dirname, '..'));
  const scenario = decision_fixture().scenarios.find(value => value.id === 'S01-AI-TARGET-001');
  assert.doesNotThrow(() => run_scenario(engine, source, scenario));
  const ranking = 'return value(b)-value(a);';
  assert.equal(source.split(ranking).length, 2, 'Target ranking mutation must have one exact source anchor');
  const context = vm.createContext({document: {getElementById: () => ({})}, module: {exports: {}}});
  vm.runInContext(source.replace(ranking, 'return 0;'), context, {timeout: 1000});
  assert.throws(() => run_scenario(context.module.exports, source, scenario), /S01-AI-TARGET-001 step 1/);
});

test('the actual browser turn controller returns ready without human income within two queued callbacks', () => {
  const {load_prototype, run_scenario} = require(harness_path);
  const {engine, source} = load_prototype(path.resolve(__dirname, '..'));
  const scenario = decision_fixture().scenarios.find(value => value.id === 'S01-TURN-002');
  assert.ok(scenario, 'Browser handoff fixture is not implemented');
  assert.doesNotThrow(() => run_scenario(engine, source, scenario));
  const too_few_callbacks = structuredClone(scenario);
  too_few_callbacks.timer_budget = 1;
  assert.throws(() => run_scenario(engine, source, too_few_callbacks), /timer budget/);
});

test('decision gates reject unsupported command and slice identifiers', () => {
  const {validate_decisions} = require(harness_path);
  for (const [field, value, message] of [
    ['affected_commands', ['typo_command'], /Unsupported command/],
    ['blocked_slices', ['S99'], /Unsupported slice/],
  ]) {
    const {scenarios, decisions, manifest} = decision_fixture();
    decisions[2][field] = value;
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), message);
  }
});

test('unapproved rules cannot be resolved by an unsupported status or an unverified record', () => {
  const {validate_decisions} = require(harness_path);
  for (const [field, value] of [['status', 'resolved'], ['status', 'accepted'], ['human_decision_record', 'assumed approval']]) {
    const {scenarios, decisions, manifest} = decision_fixture();
    decisions[2][field] = value;
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), /unresolved|human decision/i);
  }
  for (const [field, value] of [
    ['status', 'approved'], ['prototype_baseline', 'unverified'], ['human_decision_record', 'assumed approval'],
    ['approved_golden_scenarios', ['S01-DRAW-006']], ['schema_version', 99],
  ]) {
    const {scenarios, decisions, manifest} = decision_fixture();
    manifest[field] = value;
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), /baseline|approval|schema|golden/i);
  }
});

test('a recorded baseline cannot omit or substitute its human decision evidence', () => {
  const {validate_decisions} = require(harness_path);
  for (const value of [null, '', 'assumed approval', 'docs/missing-approval.md']) {
    const {scenarios, decisions, manifest} = decision_fixture();
    manifest.human_decision_record = value;
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), /baseline human decision record/i);
  }
  for (const value of [null, 'assumed approval']) {
    const {scenarios, decisions, manifest} = decision_fixture();
    decisions[0].human_decision_record = value;
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), /baseline human decision record/i);
  }
});

test('reference approval cannot move to another source commit or tree', () => {
  const {validate_decisions} = require(harness_path);
  for (const change of [
    manifest => {manifest.prototype_baseline = null;},
    manifest => {manifest.prototype_baseline = 'a0058a03950e23231507ff5487d528b85f7c7244';},
    manifest => {manifest.source.commit = 'a0058a03950e23231507ff5487d528b85f7c7244';},
    manifest => {manifest.source.tree = '0000000000000000000000000000000000000000';},
  ]) {
    const {scenarios, decisions, manifest} = decision_fixture();
    change(manifest);
    assert.throws(() => validate_decisions(scenarios, decisions, manifest), /approved baseline|approved source/i);
  }
});

test('partial crew direction preserves unresolved command gates and observational scenarios', () => {
  const {validate_decisions} = require(harness_path);
  for (const change of [
    ({decisions}) => {decisions[1].status = 'resolved';},
    ({decisions}) => {decisions[1].human_decision_record = decisions[0].human_decision_record;},
    ({decisions}) => {decisions[1].partial_decision_record = null;},
    ({decisions}) => {decisions[2].partial_decision_record = decisions[1].partial_decision_record;},
    ({scenarios}) => {scenarios[0].approval = 'approved';},
    ({manifest}) => {manifest.approved_golden_scenarios = ['S01-CREW-PIPELINE-001'];},
  ]) {
    const fixture = decision_fixture();
    change(fixture);
    assert.throws(() => validate_decisions(fixture.scenarios, fixture.decisions, fixture.manifest),
      /unresolved|human decision|scenario approval|golden/i);
  }
});

test('initial reference approval cannot lift the unresolved RD-007 setup gate', () => {
  const {validate_decisions} = require(harness_path);
  const {scenarios, decisions, manifest} = decision_fixture();
  const setup_gate = decisions.find(decision => decision.id === 'RD-007');
  setup_gate.blocked_slices = setup_gate.blocked_slices.filter(id => id !== 'S03');
  assert.throws(() => validate_decisions(scenarios, decisions, manifest), /RD-007 still gates S03/);
});

test('register-to-scenario links cannot disappear even when every forward link is removed', () => {
  const {validate_decisions} = require(harness_path);
  const {scenarios, decisions, manifest} = decision_fixture();
  for (const scenario of scenarios) scenario.decision_ids = scenario.decision_ids.filter(id => id !== 'RD-003');
  assert.throws(() => validate_decisions(scenarios, decisions, manifest), /reciprocal/);
});

test('manifest gates must exactly match the unique registered decisions', () => {
  const {validate_decisions} = require(harness_path);
  const removed = decision_fixture();
  removed.decisions = removed.decisions.filter(decision => decision.id !== 'RD-003');
  for (const scenario of removed.scenarios) scenario.decision_ids = scenario.decision_ids.filter(id => id !== 'RD-003');
  assert.throws(() => validate_decisions(removed.scenarios, removed.decisions, removed.manifest), /gate.*register|register.*gate/i);
  const duplicate = decision_fixture();
  duplicate.manifest.gates.push('RD-003');
  assert.throws(() => validate_decisions(duplicate.scenarios, duplicate.decisions, duplicate.manifest), /unique/);
});
