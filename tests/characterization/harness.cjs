const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const colors = ['Green', 'Blue', 'Black', 'White', 'Yellow', 'Purple'];
const clone_json = value => JSON.parse(JSON.stringify(value));
const read_json = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

function validate_state(state) {
  assert.equal(state.players.length, 2, 'Two players are required');
  assert.ok(['ready', 'play', 'trim', 'legit_cash', 'draw_discard', 'over'].includes(state.phase), 'Unknown fixture phase');
  assert.ok([0, 1].includes(state.current) && Number.isInteger(state.turn) && state.turn >= 1, 'Invalid turn fields');
  assert.ok([null, 0, 1].includes(state.winner), 'Invalid winner');
  const locations = [...state.deck, ...state.discard,
    ...state.players.flatMap(player => [...player.active, ...player.hand])];
  assert.deepEqual([...locations].sort((left, right) => left - right),
    Array.from({length: 36}, (_, id) => id), 'Each physical card must occur exactly once');
  for (const player of state.players) {
    assert.ok(Number.isInteger(player.drawPrice) && player.drawPrice >= 1, 'Invalid draw price');
    for (const color of colors) {
      assert.ok(Number.isInteger(player.res[color]) && player.res[color] >= 0,
        'Resources must be non-negative integers');
    }
    assert.ok(player.suspended.every(id => player.hand.includes(id)) &&
      new Set(player.suspended).size === player.suspended.length,
    'Every suspended card must be unique metadata for a card in hand');
  }
  if (state.phase === 'draw_discard') {
    const pending = state.pendingDrawDiscard;
    assert.ok(pending && pending.who === state.current && pending.ids.length === 2 &&
      new Set(pending.ids).size === 2 && pending.ids.every(id => state.players[state.current].hand.includes(id)),
    'Invalid pending draw choice');
  }
  if (state.phase === 'legit_cash') {
    const pending = state.pendingLegitCash;
    assert.ok(pending && pending.who === state.current && pending.drawnId >= 24 && pending.drawnId < 30 &&
      state.players[state.current].hand.includes(pending.drawnId), 'Invalid pending legit cash');
  }
}

// Independent integrity audit, not a replacement rules engine. Exceptions are
// compared with explicit fixture declarations; they never disable card accounting.
function limit_violations(state) {
  const violations = [];
  for (const [who, player] of state.players.entries()) {
    const distributors = player.active.filter(id => id < 24).length;
    const legits = player.active.filter(id => id >= 24 && id < 30).length;
    const possessed = [...player.active, ...player.hand].filter(id => id >= 24 && id < 30).length;
    const operators = player.active.filter(id => id >= 30).length;
    const deciding_draw = state.phase === 'draw_discard' && state.current === who;
    const deciding_legit = state.phase === 'legit_cash' && state.current === who;
    const resource_limit = [15, 16, 17].every(id => player.active.includes(id)) ? 12 : 10;
    if (player.hand.length > (deciding_draw ? 8 : 7)) violations.push(`hand_limit:${who}`);
    if (possessed > (deciding_draw ? 5 : deciding_legit ? 4 : 3)) violations.push(`legit_possession:${who}`);
    if (operators > 2) violations.push(`operator_limit:${who}`);
    if (distributors > 3 * (legits + 1)) violations.push(`distributor_capacity:${who}`);
    if (colors.reduce((sum, color) => sum + player.res[color], 0) > resource_limit &&
      !(state.phase === 'trim' && state.current === who)) violations.push(`resource_limit:${who}`);
  }
  return violations.sort();
}

// Materialize literal fixture data only; this does not execute a game command.
function expected_state(before, expected) {
  if (expected.state) return clone_json(expected.state);
  const wanted = clone_json(before);
  for (const [field, value] of Object.entries(expected.changes || {})) {
    const parts = field.split('.');
    const key = parts.pop();
    let object = wanted;
    for (const part of parts) object = object[part];
    object[key] = clone_json(value);
  }
  for (const field of expected.remove || []) {
    const parts = field.split('.');
    const key = parts.pop();
    let object = wanted;
    for (const part of parts) object = object[part];
    delete object[key];
  }
  // Fixture logs are literal completed observations in emission order.
  wanted.logs = [...(expected.logs || [])].reverse().concat(wanted.logs).slice(0, 45);
  return wanted;
}

function assert_transition(before, after, expected) {
  assert.deepEqual(clone_json(after), expected_state(before, expected));
}

function load_prototype(source_root) {
  const html = fs.readFileSync(path.join(source_root, 'index.html'), 'utf8');
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'Prototype script is missing');
  const context = vm.createContext({document: {getElementById: () => ({})}, module: {exports: {}}});
  vm.runInContext(match[1], context, {timeout: 1000});
  return {engine: context.module.exports, source: match[1]};
}

// A narrow closure probe runs the original handler/loader with an inert DOM and
// in-memory storage. It does not provide layout, browser navigation or timer proof.
function load_browser_probe(source, random_value, saved_payload, timer_budget = 0) {
  const listeners = {};
  const elements = new Map();
  const storage = new Map();
  const timer_queue = new Map();
  let timers_scheduled = 0;
  assert.ok(Number.isInteger(timer_budget) && timer_budget >= 0 && timer_budget <= 2, 'Unsupported timer budget');
  if (saved_payload !== undefined) storage.set('city-of-vice-current-v6', JSON.stringify(saved_payload));
  const element = id => {
    if (!elements.has(id)) {
      const value = {hidden: false, innerHTML: '', textContent: '', className: '', disabled: false,
        dataset: {}, style: {}, querySelector: selector => element(selector), querySelectorAll: () => [],
        insertBefore() {}, appendChild() {}, before() {}, after() {}, setAttribute() {},
        scrollIntoView() {}, addEventListener: (event, handler) => {listeners[event] = handler;}};
      value.parentElement = value;
      elements.set(id, value);
    }
    return elements.get(id);
  };
  const math = Object.create(Math);
  math.random = () => random_value;
  const context = vm.createContext({
    document: {getElementById: element, createElement: element}, Math: math,
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    matchMedia: () => ({matches: true, addEventListener() {}}),
    setTimeout: callback => {
      assert.ok(timers_scheduled < timer_budget, 'S01 source-probe timer budget exceeded');
      const id = ++timers_scheduled;
      timer_queue.set(id, callback);
      return id;
    },
    clearTimeout: id => timer_queue.delete(id),
  });
  const anchor = 'loadAchievements();loadSaved();render();';
  assert.equal(source.split(anchor).length, 2, 'Probe anchor must occur once');
  const exposed = `globalThis.prototype_probe = {
    get_state: () => state, set_state: value => {state = value;},
    load_saved: loadSaved, has_saved_game: hasSavedGame,
    begin_ai_turn: () => {screen = 'game'; return beginAI();},
    draw_reason: drawReason, operator_reason: (op_id, target_id) => operatorReason(card(op_id), card(target_id)),
    get_notice: () => notice,
    show_draw_discard: () => {panel = {type: 'draw_discard'}; renderPanel();},
    get_panel: () => panel,
    get_decision_html: () => el('v-decision').innerHTML,
    decision_controls: () => ({
      can_close: el('v-decision').innerHTML.includes('data-action="close"'),
      discard_choices: (el('v-decision').innerHTML.match(/data-action="draw-discard"/g) || []).length
    }),
    preview_outcome: (op_id, target_id, ids) => previewOutcome(card(op_id), card(target_id), ids)
  };`;
  vm.runInContext(source.replace(anchor, exposed), context, {timeout: 1000});
  return {probe: context.prototype_probe, storage, pending_timers: () => timer_queue.size,
    drain_timers: () => {
      let callbacks_run = 0;
      while (timer_queue.size) {
        assert.ok(callbacks_run < timer_budget, 'S01 source-probe timer budget exceeded');
        const [id, callback] = timer_queue.entries().next().value;
        timer_queue.delete(id);
        callback();
        callbacks_run++;
      }
      return callbacks_run;
    }, click: dataset => {
    const button = {disabled: false, dataset};
    listeners.click({target: {closest: () => button}});
  }};
}

const command_map = {
  collect_income: 'startTurn', draw_card: 'drawCard', activate_card: 'activateCard',
  cash_card: 'cashCard', cash_pending_legit: 'cashPendingLegit', trade_resources: 'tradeResources',
  trade_distributors: 'tradeDistributors', discard_draw_choice: 'discardDrawChoice',
  use_operator: 'useOperator', ai_step: 'actAI', run_ai_turn: 'runAI',
  check_win: 'checkWin', enforce_capacity: 'enforceCapacity', enforce_operator_limit: 'enforceOperatorLimit',
};

function run_scenario(engine, source, scenario) {
  let state = scenario.initial_state && clone_json(scenario.initial_state);
  const rng = () => scenario.random_source.value;
  if (state) {
    validate_state(state);
    assert.deepEqual(limit_violations(state), scenario.initial_limit_violations);
    state.rng = rng;
  }
  const browser = scenario.execution === 'instrumented_prototype'
    ? load_browser_probe(source, scenario.random_source.value, scenario.saved_payload, scenario.timer_budget) : null;
  if (browser) browser.probe.set_state(state);
  for (const [index, step] of scenario.steps.entries()) {
    const before = state && clone_json(state);
    let result;
    try {
      if (step.command === 'start_game') {
        state = engine.newState(rng, ...step.args);
        result = 'state_created';
      } else if (step.command === 'resolve_cost') {
        result = engine.resolveCost(state.players[step.args[0]], ...step.args.slice(1));
      } else if (step.command === 'click') {
        browser.click(step.args[0]);
        state = browser.probe.get_state();
      } else if (step.command === 'drain_timers') {
        result = browser.drain_timers();
        state = browser.probe.get_state();
      } else if (browser && typeof browser.probe[step.command] === 'function') {
        result = browser.probe[step.command](...step.args);
        state = browser.probe.get_state();
      } else {
        assert.ok(command_map[step.command], `Unknown command ${step.command}`);
        result = engine[command_map[step.command]](state, ...step.args);
      }
      assert.deepEqual(result === undefined ? {undefined: true} : clone_json(result), step.expected_result);
      assert_transition(before, state, step.expected);
      if (step.rejection) assert.deepEqual(clone_json(state), before, 'Rejected command mutated state');
      validate_state(state);
      assert.deepEqual(limit_violations(state), step.limit_violations || []);
    } catch (error) {
      error.message = `${scenario.id} step ${index + 1} (${step.command}): ${error.message}`;
      throw error;
    }
  }
  if (browser) assert.equal(browser.pending_timers(), 0, 'Source probe left pending callbacks');
}

// Readiness labels include planned public commands and controller/policy families;
// they are deliberately separate from executable prototype command_map aliases.
const supported_command_ids = new Set([
  'start_game', 'collect_income', 'choose_crew_bonus', 'trim_resource', 'activate_card',
  'cash_card', 'draw_card', 'trade_resources', 'trade_distributors', 'use_operator',
  'end_turn', 'ai_step', 'load_saved_state', 'resume_game', 'discard_draw_choice',
]);
const supported_slice_ids = new Set(Array.from({length: 15}, (_, index) => `S${String(index + 1).padStart(2, '0')}`));
const supported_gate_ids = new Set(Array.from({length: 12}, (_, index) => `RD-${String(index + 1).padStart(3, '0')}`));
// PD-001 approves this exact reference and only the high-level crew direction.
// These closed metadata rules encode that reviewed scope, not an approval service.
const approved_source_commit = '4ccb19703d4af1a1c202d922b514a58a17d0e537';
const approved_source_tree = '2ec9c3176abea9efcce93491a9ea0265dbb6db17';
const baseline_decision_record = 'docs/decisions/PD-001-reference-and-crews.md#initial-reference';
const crew_decision_record = 'docs/decisions/PD-001-reference-and-crews.md#crew-direction';
const public_command_decision_record = 'docs/decisions/PD-002-public-command-boundary.md#approved-rule';
const public_command_parity_file = 'public_command_parity.json';
const rd007_excluded_steps = {
  'S01-SETUP-002': [1],
  'S01-INCOME-004': [1, 2],
  'S01-DRAW-002': [1],
  'S01-CREW-NIGHT-001': [2],
  'S01-TURN-001': [1],
  'S01-TURN-002': [1, 2, 3],
};

// These are approved specifications, never sent to the legacy runner. Validate
// only PD-002's bounded constraints; leave output types/events/crew rules to the
// applicable implementation contracts and unresolved product decisions.
function validate_public_command_parity(scenarios, manifest, parity) {
  const ids = Object.keys(rd007_excluded_steps);
  assert.ok(parity && parity.schema_version === 1, 'Unsupported PD-002 golden schema');
  assert.equal(manifest.public_command_parity, public_command_parity_file, 'RD-007 golden fixture is required');
  assert.deepEqual(manifest.approved_golden_scenarios, ids, 'PD-002 golden IDs differ');
  assert.equal(parity.decision_id, 'RD-007', 'PD-002 golden decision differs');
  assert.equal(parity.human_decision_record, public_command_decision_record, 'PD-002 golden human decision differs');
  assert.equal(parity.provenance, 'approved_correction', 'PD-002 golden provenance differs');
  assert.equal(parity.execution, 'specification_only', 'PD-002 golden cases are not executed');
  assert.equal(parity.source_observation_commit, approved_source_commit, 'PD-002 golden observation reference differs');
  assert.ok(Array.isArray(parity.helper_exclusions), 'RD-007 helper exclusions are required');
  assert.deepEqual(parity.helper_exclusions.map(value => value.scenario_id), ids, 'RD-007 helper exclusion IDs differ');
  for (const exclusion of parity.helper_exclusions) {
    assert.deepEqual(exclusion.step_numbers, rd007_excluded_steps[exclusion.scenario_id], 'RD-007 helper exclusion steps differ');
    assert.ok(typeof exclusion.reason === 'string' && exclusion.reason.trim(), 'RD-007 helper exclusion needs a reason');
    const observation = scenarios.find(value => value.id === exclusion.scenario_id);
    assert.ok(observation && exclusion.step_numbers.every(number => observation.steps[number - 1]),
      'RD-007 helper exclusion references a missing observation step');
  }
  assert.ok(Array.isArray(parity.golden_scenarios), 'PD-002 golden scenarios are required');
  assert.deepEqual(parity.golden_scenarios.map(value => value.id), ids, 'PD-002 golden scenario IDs differ');
  const rejection = {result: 'typed_rejection', serialized_state: 'unchanged'};
  for (const golden of parity.golden_scenarios) {
    const observation = scenarios.find(value => value.id === golden.id);
    const after_step = golden.id === 'S01-CREW-NIGHT-001' ? 1 : 0;
    const changes = golden.id === 'S01-TURN-002' ? {current: 1} : {};
    assert.deepEqual(golden.initial_state_ref, {scenario_id: golden.id, after_step, changes}, 'PD-002 golden fixture differs');
    let initial = clone_json(observation.initial_state);
    if (after_step) initial = expected_state(initial, observation.steps[0].expected);
    if (initial) {
      initial = expected_state(initial, {changes});
      validate_state(initial);
      assert.equal(initial.phase, 'play', 'PD-002 golden fixture must be in play');
    }
    let steps;
    if (golden.id === 'S01-SETUP-002') {
      assert.equal(initial, null, 'PD-002 golden setup starts without a game');
      steps = [{command: 'start_game', args: [24], expected: rejection}];
    } else if (golden.id.startsWith('S01-TURN-')) {
      // Crew-free cases isolate automatic base income from still-open crew rules.
      assert.deepEqual(initial.players.map(player => player.active), [[0], [3]], 'PD-002 golden turn fixture must be crew-free');
      const next_player = 1 - initial.current;
      steps = [{command: 'end_turn', args: [initial.current], expected: {
        result: 'success', next_player,
        automatic_income: {player: next_player, occurrences: 1,
          resource_delta: {[next_player === 0 ? 'Green' : 'Yellow']: 1}},
        requires_collect_income: false,
      }}, {command: 'collect_income', args: [next_player], expected: rejection}];
    } else {
      const count = golden.id === 'S01-INCOME-004' ? 2 : 1;
      steps = Array.from({length: count}, () => ({command: 'collect_income', args: [initial.current], expected: rejection}));
    }
    assert.deepEqual(golden.steps, steps, `PD-002 golden command expectations differ: ${golden.id}`);
  }
}

function validate_decisions(scenarios, decisions, manifest, parity = read_json(public_command_parity_file)) {
  assert.ok(manifest && manifest.schema_version === 3, 'Unsupported baseline metadata schema');
  assert.equal(manifest.status, 'observational_baseline', 'Unsupported baseline approval status');
  assert.equal(manifest.prototype_baseline, approved_source_commit, 'Approved baseline differs');
  assert.ok(manifest.source && manifest.source.commit === approved_source_commit &&
    manifest.source.tree === approved_source_tree, 'Approved source identity differs');
  assert.equal(manifest.human_decision_record, baseline_decision_record, 'Baseline human decision record is required');
  assert.ok(Array.isArray(manifest.gates), 'Baseline gates must be an array');
  assert.equal(new Set(manifest.gates).size, manifest.gates.length, 'Manifest gates must be unique');
  assert.ok(manifest.gates.every(id => supported_gate_ids.has(id)), 'Unsupported gate identifier');
  assert.ok(Array.isArray(scenarios) && Array.isArray(decisions), 'Baseline metadata collections must be arrays');
  const scenario_ids = new Set(scenarios.map(scenario => scenario.id));
  const decision_ids = new Set(decisions.map(decision => decision.id));
  assert.equal(scenario_ids.size, scenarios.length, 'Scenario IDs must be unique');
  assert.equal(decision_ids.size, decisions.length, 'Decision IDs must be unique');
  assert.deepEqual([...decision_ids].sort(), [...manifest.gates].sort(), 'Manifest gates and decision register differ');
  assert.deepEqual([...decision_ids].sort(), [...supported_gate_ids].sort(), 'Baseline schema requires all twelve decision gates');
  for (const decision of decisions) {
    if (decision.id === 'RD-001') {
      assert.equal(decision.status, 'resolved', 'The recorded baseline decision is resolved');
      assert.equal(decision.human_decision_record, baseline_decision_record, 'Baseline human decision record is required');
      assert.deepEqual(decision.blocked_slices, [], 'Resolved baseline gate cannot block slices');
    } else if (decision.id === 'RD-007') {
      assert.equal(decision.status, 'resolved', 'PD-002 resolves RD-007 only');
      assert.equal(decision.human_decision_record, public_command_decision_record, 'RD-007 human decision record is required');
      assert.deepEqual(decision.blocked_slices, [], 'Resolved RD-007 cannot block slices');
      assert.deepEqual(decision.scenario_ids, Object.keys(rd007_excluded_steps), 'RD-007 golden observation links differ');
      assert.deepEqual(decision.affected_commands, ['start_game', 'collect_income', 'end_turn'], 'RD-007 approved command scope differs');
    } else {
      assert.equal(decision.status, 'unresolved', 'This decision remains unresolved');
      assert.equal(decision.human_decision_record, null, 'Unresolved human decision evidence is absent');
      assert.ok(Array.isArray(decision.blocked_slices) && decision.blocked_slices.length,
        'An unresolved decision needs a downstream gate');
    }
    assert.equal(decision.partial_decision_record, decision.id === 'RD-002' ? crew_decision_record : undefined,
      'Unsupported partial human decision record');
    assert.equal(decision.approved_expectations, decision.id === 'RD-007' ? public_command_parity_file : undefined,
      'Unsupported RD-007 golden expectation record');
    assert.ok(Array.isArray(decision.affected_commands) && decision.affected_commands.length, 'Decision needs affected commands');
    assert.equal(new Set(decision.affected_commands).size, decision.affected_commands.length, 'Command IDs must be unique');
    assert.equal(new Set(decision.blocked_slices).size, decision.blocked_slices.length, 'Slice IDs must be unique');
    assert.ok(decision.affected_commands.every(id => supported_command_ids.has(id)), 'Unsupported command identifier');
    assert.ok(decision.blocked_slices.every(id => supported_slice_ids.has(id)), 'Unsupported slice identifier');
    assert.ok(Array.isArray(decision.scenario_ids) && decision.scenario_ids.length, 'Decision needs affected scenarios');
    assert.equal(new Set(decision.scenario_ids).size, decision.scenario_ids.length, 'Affected scenario IDs must be unique');
    for (const id of decision.scenario_ids) assert.ok(id === '*' || scenario_ids.has(id), `Unknown scenario ${id}`);
    if (decision.scenario_ids.includes('*')) {
      assert.ok(decision.id === 'RD-001' && decision.scenario_ids.length === 1, 'Only the baseline gate can use the sole wildcard');
    }
  }
  for (const scenario of scenarios) {
    assert.match(scenario.id, /^S01-[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Unsupported scenario identifier');
    assert.equal(scenario.approval, 'unapproved_candidate', 'Unsupported scenario approval');
    assert.ok(Array.isArray(scenario.decision_ids) && scenario.decision_ids.length, 'Scenario needs decision links');
    assert.equal(new Set(scenario.decision_ids).size, scenario.decision_ids.length, 'Scenario decision IDs must be unique');
    for (const id of scenario.decision_ids) {
      assert.ok(decision_ids.has(id), `Unknown decision ${id}`);
      const decision = decisions.find(value => value.id === id);
      assert.ok(decision.scenario_ids.includes('*') || decision.scenario_ids.includes(scenario.id), 'Decision mapping is not reciprocal');
    }
  }
  for (const decision of decisions) {
    const affected = decision.scenario_ids.includes('*') ? scenarios : scenarios.filter(scenario => decision.scenario_ids.includes(scenario.id));
    for (const scenario of affected) assert.ok(scenario.decision_ids.includes(decision.id), 'Decision mapping is not reciprocal');
  }
  validate_public_command_parity(scenarios, manifest, parity);
}

function verify_corpus(options = {}) {
  const manifest = read_json('manifest.json');
  const source_root = options.source_root || process.env.S01_PROTOTYPE_ROOT || path.resolve(__dirname, '../..');
  for (const input of manifest.source.files) {
    const bytes = fs.readFileSync(path.join(source_root, input.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), input.sha256, `${input.path}: source hash differs`);
    assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), input.git_blob,
      `${input.path}: source Git object differs`);
  }
  const {engine, source} = load_prototype(source_root);
  const inventory = read_json('cards.json');
  const normalized = engine.CARDS.map(card => ({id: card.id, name: card.name, color: card.color,
    business: card.biz, type: card.type, crew: card.crew, activation_cost: card.cost,
    ...(card.ability ? {ability: card.ability, ability_cost: card.abilityCost} : {}), flavor: card.flavor}));
  assert.deepEqual(clone_json(normalized), inventory);
  assert.deepEqual(inventory.map(card => card.id), Array.from({length: 36}, (_, id) => id));
  const scenarios = read_json('scenarios.json');
  const parity = read_json(public_command_parity_file);
  validate_decisions(scenarios, read_json('rule_decisions.json'), manifest, parity);
  for (const record of [baseline_decision_record, public_command_decision_record]) {
    const decision_record_path = path.resolve(__dirname, '../..', record.split('#')[0]);
    assert.ok(fs.readFileSync(decision_record_path, 'utf8').trim().length, 'Human decision record is empty');
  }
  assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length, 'Scenario IDs must be unique');
  for (const area of manifest.required_areas) {
    assert.ok(scenarios.some(scenario => scenario.areas.includes(area)), `Missing area: ${area}`);
  }
  for (const scenario of scenarios) {
    assert.equal(scenario.provenance.kind, 'prototype_observation');
    assert.equal(scenario.provenance.source_commit, manifest.source.commit);
    assert.equal(scenario.approval, 'unapproved_candidate');
    assert.ok(scenario.preconditions.length && scenario.steps.length && scenario.provenance.symbols.length);
    run_scenario(engine, source, scenario);
  }
  return {inventory_count: inventory.length, scenario_count: scenarios.length,
    approved_baseline: manifest.prototype_baseline, source_commit: manifest.source.commit,
    approved_golden_count: parity.golden_scenarios.length, golden_execution: parity.execution};
}

module.exports = {validate_state, limit_violations, assert_transition, load_prototype, run_scenario, validate_decisions, verify_corpus};
if (require.main === module) console.log(JSON.stringify(verify_corpus(), null, 2));
