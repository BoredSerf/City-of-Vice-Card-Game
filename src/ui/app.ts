import {
  create_controller,
  type Controller_snapshot,
  type Controller_update,
  type New_game_intent,
} from "../app/controller.ts";
import type {
  Engine_command,
  Player_view,
  Crew,
  Win_reason,
} from "@city-of-vice/engine";
import {
  action_names,
  command_fields,
  matching_commands,
  next_choices,
} from "./choices.ts";
import {
  card_description,
  card_info,
  card_name,
  card_ids,
  crew_names,
  business_count,
  color_name,
  resource_colors,
} from "./catalog.ts";
import {
  crew_benefits,
  resource_aliases,
} from "../presentation/reference_text.ts";
import {
  completed_results,
  type Completed_result,
} from "../presentation/results.ts";
import {
  create_achievements,
  achievement_definitions,
} from "../app/achievements.ts";
import { artwork, portrait } from "./artwork.ts";
import { business_warning } from "../presentation/warnings.ts";
import {
  render_rules,
  render_gallery,
  render_card_inspection,
  render_crew_inspection,
} from "./rich_views.ts";
import {
  actor_name,
  decision_name,
  outcome_text,
  visible_facts,
} from "./narration.ts";

type Schedule = (task: () => void) => () => void;
type Confirmation = {
  kind: "abandon_new" | "abandon_resume" | "replace_new" | "replace_save";
};
type Source = "new" | "resume" | "human" | "rival" | "save";
type Detail =
  | { kind: "rules" | "achievements" }
  | { kind: "gallery"; page: number }
  | { kind: "card"; id: number }
  | { kind: "crew"; crew: Crew };
export type Ui_options = {
  controller?: ReturnType<typeof create_controller>;
  seed_source?: () => string;
  schedule?: Schedule;
  achievements?: ReturnType<typeof create_achievements>;
};
const random_seed = () => {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (value || 1).toString(16).padStart(8, "0");
};

/** Same composition in production and tests; injected capabilities never supply state. */
export function mount_game(root: HTMLElement, options: Ui_options = {}) {
  const controller = options.controller ?? create_controller();
  const achievements = options.achievements ?? create_achievements();
  let award_state = achievements.inspect();
  const seed_source = options.seed_source ?? random_seed;
  const schedule =
    options.schedule ??
    ((task) => {
      const timer = setTimeout(task, 120);
      return () => clearTimeout(timer);
    });
  let current = controller.inspect_save().snapshot;
  let has_live_game = current.human !== null;
  let screen: "menu" | "game" = "menu";
  let confirmation: Confirmation | null = null;
  let family: Engine_command["command"] | null = null;
  let selected: string[] = [];
  let log: string[] = [],
    recap: string[] = [];
  let detail: Detail | null = null,
    log_marker: string | null = null,
    history_unavailable = false;
  let warning: string | null = null,
    results: Completed_result[] = [],
    animate_results = false,
    animate_outcome = false;
  let finish_seen = false,
    finish_context: { winner: 0 | 1; reason: Win_reason } | null = null,
    new_awards: string[] = [];
  let needs_ack = false,
    halted = false,
    display_fault = false,
    disposed = false;
  let cancel_task: (() => void) | null = null,
    epoch = 0;
  let notice = "";
  let previous_focus_context = "";
  const content = document.createElement("div");
  const live = document.createElement("p");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  live.className = "live_status";
  root.className = "game_shell";
  root.replaceChildren(content, live);

  function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
    parent: HTMLElement = content,
  ) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  }
  function button(
    label: string,
    action: () => void,
    parent: HTMLElement = content,
  ) {
    const node = element("button", label, parent);
    node.type = "button";
    node.id = `button_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    node.addEventListener("click", action);
    return node;
  }
  function acknowledgement(
    label: string,
    action: () => void,
    parent: HTMLElement = content,
  ) {
    // Presentation belongs to this rendered epoch. Gameplay candidates still use
    // current engine validation through the ordinary button path.
    const rendered_epoch = epoch;
    return button(
      label,
      () => {
        if (disposed || epoch !== rendered_epoch) return;
        action();
      },
      parent,
    );
  }
  function invalidate() {
    epoch++;
    cancel_task?.();
    cancel_task = null;
  }
  function message(text: string) {
    notice = text;
    if (text) live.textContent = text;
  }
  function clear_selection() {
    family = null;
    selected = [];
  }
  function refresh_history() {
    const history = controller.read_visible_history();
    history_unavailable = history.status === "integration_fault";
    log = history.entries.map(
      (entry) =>
        `${entry.turn_number === null ? "Turn not recorded" : "Turn " + entry.turn_number} · ${entry.text}`,
    );
  }
  function settle_current_finish() {
    const view = current.human?.view;
    if (
      !finish_context ||
      !view ||
      view.phase !== "over" ||
      view.winner !== finish_context.winner ||
      view.win_reason !== finish_context.reason
    )
      return;
    award_state = achievements.record_completion({
      ...finish_context,
      human_active_ids: [...view.players[0]!.active_card_ids],
    });
    finish_context = null;
    new_awards = [...award_state.newly_earned];
  }
  function open_detail(value: Detail) {
    invalidate();
    detail = value;
    if (value.kind === "achievements") award_state = achievements.inspect();
    render();
  }
  function minimal_problem(update: Controller_update): string {
    if (update.status === "rejected")
      return `Action rejected: ${update.rejection?.code.replaceAll("_", " ") ?? "invalid action"}. Choose an available option.`;
    if (
      update.status === "integration_fault" ||
      update.snapshot.integration_fault
    )
      return "Game display unavailable. Progress has not been replayed. Return to the menu to inspect or continue.";
    if (update.status === "unavailable")
      return "Saving is unavailable. Your current progress can continue in memory.";
    if (update.status === "replacement_required")
      return "Existing saved data is protected. Explicit replacement is required.";
    return "";
  }
  function consume(update: Controller_update, source: Source) {
    const previous = current.human?.view;
    current = update.snapshot;
    clear_selection();
    const applied = update.status === "applied";
    if (applied) has_live_game = true;
    if (applied && (source === "new" || source === "resume")) {
      log = [];
      log_marker = source === "resume" ? "Game resumed." : null;
      recap = [];
      detail = null;
      warning = null;
      results = [];
      animate_results = false;
      animate_outcome = false;
      finish_seen = false;
      finish_context = null;
      new_awards = [];
      needs_ack = false;
      display_fault = false;
      screen = "game";
      confirmation = null;
      if (source === "new")
        live.textContent = "New game ready. Choose an opening distributor.";
    }
    let facts: string[] = [];
    let fact_error = false;
    try {
      facts = update.trusted_events.flatMap(visible_facts);
    } catch {
      halted = true;
      display_fault = true;
      fact_error = true;
      message("Game event display unavailable. Rival actions are paused.");
    }
    if (facts.length) {
      const view = current.human?.view;
      if (
        source === "rival" ||
        recap.length > 0 ||
        (source === "human" &&
          view &&
          (view.decision_owner === 1 || view.active_player === 1))
      ) {
        recap.push(...facts);
        needs_ack = true;
      }
      live.textContent = facts.join(" ");
    } else if (applied && source === "resume")
      live.textContent = "Game resumed. No prior actions replayed.";
    if (applied) {
      refresh_history();
      if (!fact_error && source !== "resume" && source !== "new") {
        const current_results = completed_results(update.trusted_events);
        if (current_results.length) {
          results = current_results;
          animate_results = true;
        }
        const view = current.human?.view;
        if (previous && view) {
          const entered = business_warning(
            previous.players.map((player) => player.active_card_ids),
            view.players.map((player) => player.active_card_ids),
          );
          if (entered) {
            warning = entered;
            live.textContent = [
              ...facts,
              warning + " · 11 / 12 businesses.",
            ].join(" ");
          }
        }
        const finish = update.trusted_events.find(
          (event) => event.event === "game_finished",
        );
        if (
          finish &&
          !finish_seen &&
          (finish.winner === 0 || finish.winner === 1)
        ) {
          finish_seen = true;
          animate_outcome = true;
          finish_context = { winner: finish.winner, reason: finish.reason };
          settle_current_finish();
        }
      }
    }
    const problem = minimal_problem(update);
    if (problem) {
      notice = problem;
      live.textContent = [...facts, problem].join(" ");
    } else if (!fact_error) notice = "";
    if (
      update.status === "integration_fault" ||
      update.status === "rejected" ||
      current.integration_fault ||
      (source === "rival" && update.status !== "applied")
    )
      halted = true;
    render();
  }
  function human_command(command: Engine_command) {
    invalidate();
    detail = null;
    halted = false;
    consume(controller.submit_human(command), "human");
    content.querySelector<HTMLElement>("#screen_heading")?.focus();
  }
  function try_new(intent: New_game_intent) {
    invalidate();
    halted = false;
    let seed: string;
    try {
      seed = seed_source();
    } catch {
      message("A game seed could not be prepared. Try again.");
      render();
      return;
    }
    const update = controller.new_game(seed, intent);
    if (
      update.status === "replacement_required" ||
      update.status === "unavailable"
    )
      confirmation = { kind: "replace_new" };
    consume(update, "new");
  }
  function try_resume() {
    invalidate();
    halted = false;
    consume(controller.resume(), "resume");
  }
  function request_new() {
    invalidate();
    if (current.human !== null && !current.save.saved) {
      confirmation = { kind: "abandon_new" };
      render();
    } else try_new("empty_only");
  }
  function request_resume() {
    invalidate();
    if (current.human !== null && !current.save.saved) {
      confirmation = { kind: "abandon_resume" };
      render();
    } else try_resume();
  }
  function enter_menu() {
    invalidate();
    screen = "menu";
    confirmation = null;
    detail = null;
    animate_results = false;
    clear_selection();
    const update = controller.inspect_save();
    current = update.snapshot;
    message(minimal_problem(update));
    render();
  }
  function continue_live() {
    invalidate();
    current = controller.snapshot();
    screen = "game";
    confirmation = null;
    halted = current.integration_fault;
    clear_selection();
    refresh_history();
    settle_current_finish();
    render();
  }
  function rival_needed(view: Player_view | undefined): boolean {
    if (!view || view.phase === "over" || view.phase === "awaiting_opening")
      return false;
    return (
      view.decision_owner === 1 ||
      (view.decision_owner === null && view.active_player === 1)
    );
  }
  function queue_rival() {
    if (
      disposed ||
      screen !== "game" ||
      confirmation ||
      halted ||
      display_fault ||
      current.integration_fault ||
      cancel_task ||
      (detail !== null && current.human?.view.decision_owner !== 1) ||
      !rival_needed(current.human?.view)
    )
      return;
    const scheduled_epoch = epoch;
    cancel_task = schedule(() => {
      cancel_task = null;
      if (
        disposed ||
        epoch !== scheduled_epoch ||
        screen !== "game" ||
        confirmation ||
        halted
      )
        return;
      consume(controller.step_rival(), "rival");
    });
  }
  function save_panel(parent: HTMLElement = content) {
    const panel = element("section", undefined, parent);
    panel.setAttribute("aria-label", "Save status");
    const slot = current.save.slot;
    element(
      "p",
      slot.admission === "valid"
        ? slot.resumable
          ? "An unfinished saved game is available."
          : "The saved game is completed."
        : slot.admission === "empty"
          ? "No saved game."
          : slot.admission === "rejected"
            ? "Saved data could not be accepted. It is protected."
            : slot.admission === "unreadable"
              ? "Saved data could not be read. It is not known to be empty."
              : "Saved data has not been inspected.",
      panel,
    );
    if (has_live_game)
      element(
        "p",
        current.save.saved
          ? "Current progress is saved."
          : "Current progress is unsaved. You can continue in memory.",
        panel,
      );
    if (current.save.write_authority === "protected")
      element(
        "p",
        "Existing saved data is protected from automatic saving.",
        panel,
      );
    if (current.save.write_authority === "suspended")
      element(
        "p",
        "Automatic saving is paused until access and ownership are checked.",
        panel,
      );
    if (current.save.failure)
      element(
        "p",
        `Storage ${current.save.failure === "acquire" ? "access" : current.save.failure} failed.`,
        panel,
      );
    if (has_live_game && !current.save.saved) {
      button(
        "Retry save",
        () => {
          invalidate();
          const result = controller.retry_save();
          if (result.status === "replacement_required")
            confirmation = { kind: "replace_save" };
          consume(result, "save");
        },
        panel,
      );
      button(
        "Replace saved data with current progress",
        () => {
          invalidate();
          confirmation = { kind: "replace_save" };
          render();
        },
        panel,
      );
    }
  }
  function render_confirmation() {
    const pending = confirmation!;
    const panel = element("section");
    panel.setAttribute("aria-labelledby", "confirmation_title");
    const heading = element(
      "h2",
      pending.kind.startsWith("abandon")
        ? "Leave unsaved progress?"
        : "Replace saved data?",
      panel,
    );
    heading.id = "confirmation_title";
    heading.tabIndex = -1;
    element(
      "p",
      pending.kind.startsWith("abandon")
        ? "This would discard your current unsaved progress. Cancel keeps it available."
        : "Existing or unreadable saved data will be replaced only if the write succeeds. Cancel preserves it.",
      panel,
    );
    if (pending.kind === "abandon_new")
      button(
        "Continue new game",
        () => {
          confirmation = null;
          try_new("empty_only");
        },
        panel,
      );
    if (pending.kind === "abandon_resume")
      button(
        "Resume saved game instead",
        () => {
          confirmation = null;
          try_resume();
        },
        panel,
      );
    if (pending.kind === "replace_new") {
      button("Replace saved game", () => try_new("replace"), panel);
      button("Play only in memory", () => try_new("memory_only"), panel);
    }
    if (pending.kind === "replace_save")
      button(
        "Replace saved game",
        () => {
          confirmation = null;
          consume(controller.retry_save("replace"), "save");
        },
        panel,
      );
    acknowledgement(
      "Cancel",
      () => {
        controller.cancel();
        confirmation = null;
        message("Cancelled. Your game and saved data are unchanged.");
        render();
      },
      panel,
    );
  }
  function render_board(view: Player_view) {
    const board = element("div");
    board.className = "board";
    for (const player of view.players) {
      const area = element("section", undefined, board);
      area.setAttribute(
        "aria-label",
        player.player_id === 0 ? "Your area" : "Rival area",
      );
      element("h3", player.player_id === 0 ? "Your area" : "Rival area", area);
      element(
        "p",
        `Hand: ${player.hand_count} cards · Active cards: ${player.active_card_ids.length} · Businesses: ${business_count(player.active_card_ids)} / 12`,
        area,
      );
      const bank = element("dl", undefined, area);
      bank.className = "resource_bank";
      for (const color of resource_colors) {
        const item = element("div", undefined, bank);
        item.className = `resource ${color}`;
        element(
          "dt",
          `${color_name(color)} · ${resource_aliases[color]}`,
          item,
        );
        element("dd", String(player.resources[color]), item);
      }
      const cards = element("ul", undefined, area);
      cards.className = "cards";
      for (const id of player.active_card_ids) render_card(cards, id, false);
    }
    const hand = element("section");
    hand.setAttribute("aria-label", "Your hand");
    element("h3", "Your hand", hand);
    const cards = element("ul", undefined, hand);
    cards.className = "cards";
    for (const id of view.hand)
      render_card(cards, id, view.suspended_card_ids.includes(id));
    if (view.hand.length === 0) element("p", "Your hand is empty.", hand);
    element(
      "p",
      `Draw price: ${view.draw_price} · Your resource limit: ${view.resource_limit} · Trade rate: ${view.trade_rate} to 1 · Distributor capacity: ${view.distributor_capacity}. Draw pile: ${view.draw_pile_count}; discard: ${view.discard_count}.`,
    );
  }
  function render_card(parent: HTMLElement, id: number, suspended: boolean) {
    const item = element("li", undefined, parent);
    item.className = "rich_card";
    const inspect = button(
      `Inspect ${card_name(id)}`,
      () => open_detail({ kind: "card", id }),
      item,
    );
    inspect.className = "card_inspect";
    inspect.setAttribute("aria-label", `Inspect ${card_name(id)}`);
    inspect.replaceChildren(portrait(id));
    element("strong", card_name(id), inspect);
    element("p", card_description(id), item);
    if (suspended)
      element("p", "Suspended · activate normally when offered.", item);
    const card = card_info(id);
    if (card.type === "legit")
      element(
        "p",
        "Protected from all operators · +3 distributor slots while active.",
        item,
      );
    if (card.type === "illegal")
      button(
        `Inspect ${card.crew} crew`,
        () => open_detail({ kind: "crew", crew: card.crew as Crew }),
        item,
      );
  }
  function hero(kind: "menu" | "win" | "lose") {
    const image = element("img");
    image.className = `hero_image hero_${kind}`;
    image.src = artwork[kind];
    if (kind !== "menu" && animate_outcome) {
      image.classList.add("current_outcome");
      animate_outcome = false;
    }
    image.alt =
      kind === "menu"
        ? "A panoramic city at dusk with the docks, clubs, trailer park, suburbs, industrial yards, music venues, arts district and rural hills. Six legit businesses line the streets, with tiny figures hinting at the characters."
        : kind === "win"
          ? "A victorious crew celebrates above the city."
          : "The defeated crew waits outside a shuttered business as a car is repossessed.";
  }
  function rich_toolbar() {
    const nav = element("nav");
    nav.setAttribute("aria-label", "Game information");
    button("Rules", () => open_detail({ kind: "rules" }), nav);
    button(
      "Card gallery",
      () => open_detail({ kind: "gallery", page: 0 }),
      nav,
    );
    button("Achievements", () => open_detail({ kind: "achievements" }), nav);
  }
  function render_information() {
    if (!detail) return;
    const panel = element("section");
    panel.className = "information_panel";
    panel.setAttribute("aria-label", "Information");
    acknowledgement(
      current.human?.view.decision_owner === 0
        ? "Return to required choice"
        : "Close information",
      () => {
        invalidate();
        detail = null;
        render();
        content.querySelector<HTMLElement>("#screen_heading")?.focus();
      },
      panel,
    );
    if (detail.kind === "rules") render_rules(panel);
    else if (detail.kind === "gallery")
      render_gallery(
        panel,
        detail.page,
        (id) => open_detail({ kind: "card", id }),
        (page) => open_detail({ kind: "gallery", page }),
      );
    else if (detail.kind === "card")
      render_card_inspection(panel, detail.id, current.human?.view, (crew) =>
        open_detail({ kind: "crew", crew }),
      );
    else if (detail.kind === "crew")
      render_crew_inspection(panel, detail.crew, current.human?.view, (id) =>
        open_detail({ kind: "card", id }),
      );
    else {
      const section = element("section", undefined, panel);
      section.setAttribute("aria-label", "Achievements");
      element("h2", "Achievements", section);
      element(
        "p",
        award_state.record
          ? `${award_state.record.earned_ids.length} of 16 known earned · Current known win streak: ${award_state.record.win_streak} / 10`
          : "Earned count and win streak are unknown.",
        section,
      );
      element(
        "p",
        award_state.saved && !finish_context
          ? "Achievement progress is saved."
          : "Achievement progress is unavailable or pending in this browser. Reload can lose unsaved progress.",
        section,
      );
      if (finish_context)
        element(
          "p",
          "This current finish awaits a matching final public view before awards can be measured.",
          section,
        );
      if (award_state.newly_earned.length)
        element(
          "p",
          "Newly unlocked: " +
            award_state.newly_earned
              .map(
                (id) =>
                  achievement_definitions.find((award) => award.id === id)!
                    .name,
              )
              .join(", "),
          section,
        );
      if (award_state.failure)
        element(
          "p",
          `Achievement ${award_state.failure} status. Stored data remains protected; retry does not replay a game.`,
          section,
        );
      if (award_state.pending || award_state.failure)
        button(
          "Retry achievements",
          () => {
            award_state = achievements.retry();
            render();
          },
          section,
        );
      const grid = element("div", undefined, section);
      grid.className = "achievement_grid";
      for (const award of achievement_definitions) {
        const item = element("article", undefined, grid),
          earned = award_state.record?.earned_ids.includes(award.id);
        item.className = earned ? "award earned" : "award";
        element("h3", award.name, item);
        element(
          "p",
          earned
            ? "Earned"
            : award_state.record && !award_state.failure
              ? "Locked"
              : "Status unknown",
          item,
        );
        element("p", award.description, item);
      }
    }
    const heading = panel.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.id = "detail_heading";
      heading.tabIndex = -1;
    }
  }
  function render_current_results() {
    if (warning) {
      const panel = element("section");
      panel.setAttribute("aria-label", "Business warning");
      panel.className = "business_warning";
      element("h3", warning, panel);
      element(
        "p",
        "11 / 12 businesses. The engine still determines the outcome.",
        panel,
      );
      acknowledgement(
        "OK",
        () => {
          warning = null;
          render();
        },
        panel,
      );
    }
    if (!results.length) return;
    const panel = element("section");
    panel.setAttribute("aria-label", "Completed results");
    panel.className = animate_results
      ? "completed_results current_effect"
      : "completed_results settled_effect";
    for (const result of results) {
      element("h3", result.title, panel);
      const pictures = element("div", undefined, panel);
      pictures.className = "result_portraits";
      for (const card of result.cards) {
        const item = element("figure", undefined, pictures);
        item.append(portrait(card.card_id));
        element(
          "figcaption",
          `${card_name(card.card_id)} · ${card.stamp}`,
          item,
        );
      }
      for (const fact of result.facts) element("p", fact, panel);
    }
    acknowledgement(
      "OK",
      () => {
        results = [];
        animate_results = false;
        render();
      },
      panel,
    );
    animate_results = false;
  }
  function render_openings(offered: Engine_command[]) {
    const openings = offered.filter(
      (
        command,
      ): command is Extract<Engine_command, { command: "start_game" }> =>
        command.command === "start_game",
    );
    const grid = element("section");
    grid.setAttribute("aria-label", "Opening distributors");
    grid.className = "opening_grid";
    for (const crew of crew_names) {
      const section = element("section", undefined, grid);
      section.className = "opening_crew";
      element("h3", crew, section);
      element("p", crew_benefits[crew], section);
      const members = element("div", undefined, section);
      members.className = "opening_members";
      for (const command of openings.filter(
        (command) => card_info(command.opening_distributor).crew === crew,
      )) {
        const pick = button(
          `Start with ${card_name(command.opening_distributor)}`,
          () => human_command(command),
          members,
        );
        pick.setAttribute(
          "aria-label",
          `Start with ${card_name(command.opening_distributor)}`,
        );
        pick.replaceChildren(portrait(command.opening_distributor));
        element("strong", card_name(command.opening_distributor), pick);
      }
    }
  }
  function render_actions(view: Player_view) {
    const observation = current.human!;
    const required = view.decision_owner === 0;
    const region = element("section");
    region.setAttribute("aria-label", "Available actions");
    if (needs_ack && !required) {
      element(
        "p",
        "Review Rival actions and Continue before your next ordinary action.",
        region,
      );
      return;
    }
    const offered = observation.legal_commands;
    if (view.phase === "awaiting_opening") render_openings(offered);
    if (offered.length === 0) {
      element(
        "p",
        view.phase === "over"
          ? "This game is complete."
          : "Waiting for the rival.",
        region,
      );
      return;
    }
    const families = [...new Set(offered.map((command) => command.command))];
    if (family === null && families.length === 1) family = families[0]!;
    const buttons = element("div", undefined, region);
    buttons.className = "action_buttons";
    for (const item of families)
      button(
        `Choose action: ${action_names[item]}`,
        () => {
          family = item;
          selected = [];
          render();
          content
            .querySelector<HTMLElement>("fieldset select, fieldset button")
            ?.focus();
        },
        buttons,
      );
    if (family === null) return;
    const fieldset = element("fieldset", undefined, region);
    element("legend", action_names[family], fieldset);
    for (let index = 0; index <= selected.length; index++) {
      const choices = next_choices(offered, family, selected.slice(0, index));
      if (choices.length === 0) break;
      const label = element("label", choices[0]!.label, fieldset);
      label.htmlFor = `action_choice_${index}`;
      const input = element("select", undefined, fieldset);
      input.id = `action_choice_${index}`;
      const placeholder = element("option", "Choose…", input);
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = selected[index] === undefined;
      choices.forEach((choice, option_index) => {
        const option = element("option", choice.text, input);
        option.value = String(option_index);
        option.selected = selected[index] === choice.value;
      });
      input.addEventListener("change", () => {
        selected = [
          ...selected.slice(0, index),
          choices[Number(input.value)]!.value,
        ];
        render();
      });
    }
    const remaining = matching_commands(offered, family, selected);
    const complete = remaining.find(
      (command) => command_fields(command).length === selected.length,
    );
    const summary = element("section", undefined, fieldset);
    summary.setAttribute("aria-label", "Selected action summary");
    for (const field of (remaining[0]
      ? command_fields(remaining[0])
      : []
    ).slice(0, selected.length))
      element("p", `${field.label}: ${field.text}`, summary);
    if (complete) {
      const ids =
        complete.command === "start_game"
          ? [complete.opening_distributor]
          : "card_id" in complete
            ? [complete.card_id]
            : complete.command === "use_operator"
              ? [complete.operator_id, ...complete.target_ids]
              : complete.command === "trade_distributors"
                ? [complete.own_card_id, complete.rival_card_id]
                : [];
      for (const id of ids) {
        const preview = element("div", undefined, summary);
        preview.className = "selection_portrait";
        preview.append(portrait(id));
        element("span", card_name(id), preview);
      }
    }
    element(
      "p",
      "These are selected complete offered values, not a forecast. Whole payments, ordered targets, protection and optional Pipeline consent remain engine-controlled.",
      summary,
    );
    const confirm = button(
      action_names[family],
      () => {
        if (complete) human_command(complete);
      },
      fieldset,
    );
    confirm.disabled = complete === undefined;
  }
  function render_recap(view: Player_view) {
    if (!recap.length) return;
    const panel = element("section");
    panel.setAttribute("aria-label", "Rival actions");
    element("h3", "Rival actions", panel);
    const list = element("ol", undefined, panel);
    for (const fact of recap) element("li", fact, list);
    const can_ack =
      view.phase === "over" ||
      (view.decision_owner === null && view.active_player === 0);
    if (can_ack)
      acknowledgement(
        "Continue",
        () => {
          needs_ack = false;
          recap = [];
          notice = "";
          render();
          (
            content.querySelector<HTMLElement>(
              '[aria-label="Available actions"] button',
            ) ?? content.querySelector<HTMLElement>("#screen_heading")
          )?.focus();
        },
        panel,
      );
    else
      element(
        "p",
        view.decision_owner === 0
          ? "Complete your required choice; rival actions will continue only when needed."
          : "Rival actions are in progress.",
        panel,
      );
  }
  function render() {
    if (disposed) return;
    const active_id =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.id
        : "";
    content.replaceChildren();
    element("h1", "City of Vice");
    rich_toolbar();
    if (notice) element("p", notice).className = "notice";
    if (confirmation) render_confirmation();
    else if (screen === "menu") {
      hero("menu");
      const heading = element("h2", "Main menu");
      heading.tabIndex = -1;
      heading.id = "screen_heading";
      element(
        "p",
        "Build your businesses against the heuristic rival. One local human, one rival.",
      );
      save_panel();
      if (has_live_game)
        button(
          current.human?.view.phase === "over"
            ? "View current result"
            : "Continue current game",
          continue_live,
        );
      if (
        current.save.slot.admission === "valid" &&
        current.save.slot.resumable
      )
        button("Resume saved game", request_resume);
      button("New game", request_new);
    } else {
      button("Main menu", enter_menu);
      const view = current.human?.view;
      const ending =
        view?.phase === "over"
          ? { winner: view.winner!, reason: view.win_reason! }
          : view
            ? null
            : finish_context;
      if (ending) hero(ending.winner === 0 ? "win" : "lose");
      const title = ending
        ? outcome_text(ending.winner, ending.reason)
        : !view
          ? "Game view unavailable"
          : view.phase === "over"
            ? outcome_text(view.winner!, view.win_reason!)
            : view.phase === "awaiting_opening"
              ? "Choose your opening distributor"
              : view.decision_owner === 0
                ? `Required choice: ${decision_name(view.own_pending_decision!.decision)}`
                : view.decision_owner === 1
                  ? "Waiting for a rival choice"
                  : `Turn ${view.turn_number} · ${view.active_player === 0 ? "Your turn" : "Rival's turn"}`;
      const heading = element("h2", title);
      heading.id = "screen_heading";
      heading.tabIndex = -1;
      if (ending) {
        element(
          "h3",
          ending.reason === "elimination"
            ? ending.winner === 0
              ? "Brutal Victory"
              : "Brutal Defeat"
            : ending.winner === 0
              ? "VICTORY"
              : "EMPIRE LOST",
        );
        element(
          "p",
          ending.reason === "elimination"
            ? ending.winner === 0
              ? "Your rival has no active distributors remaining."
              : "You have no active distributors remaining."
            : ending.winner === 0
              ? "The city is yours. You reached 12 active businesses."
              : "Your rival rules the city with 12 active businesses.",
        );
        if (new_awards.length)
          element(
            "p",
            "Achievements unlocked: " +
              new_awards
                .map(
                  (id) =>
                    achievement_definitions.find((award) => award.id === id)!
                      .name,
                )
                .join(", ") +
              (award_state.saved ? "." : " (pending storage)."),
          );
        if (finish_context)
          element(
            "p",
            "Achievement progress awaits this game's matching final public view.",
          );
        button(ending.winner === 0 ? "Play again" : "Try again", request_new);
      }
      save_panel();
      if (view) {
        element(
          "p",
          `Phase: ${view.phase.replaceAll("_", " ")}${view.decision_owner === null ? "" : ` · Decision owner: ${actor_name(view.decision_owner)}`}`,
        );
        const near = view.players
          .filter((player) => business_count(player.active_card_ids) === 11)
          .map((player) => actor_name(player.player_id));
        if (near.length)
          element(
            "p",
            `Current near-win status: ${near.join(" and ")} · 11 / 12 businesses.`,
          );
        render_current_results();
        render_board(view);
        render_recap(view);
        if (!current.integration_fault && !display_fault) render_actions(view);
        else
          element(
            "p",
            "Actions are paused. Return to the menu to inspect current progress.",
          );
      }
      if (!view) render_current_results();
      const history = element("section");
      history.setAttribute("aria-label", "Recent game history");
      element("h3", "Recent game history", history);
      element(
        "p",
        "The newest 30 safe facts from this adopted game. Restoring history does not replay actions, announcements or awards.",
        history,
      );
      const list = element("ol", undefined, history);
      if (log_marker) element("li", log_marker, list);
      if (history_unavailable)
        element(
          "p",
          "Recent history is unavailable. Game progress is unchanged.",
          history,
        );
      for (const fact of log) element("li", fact, list);
    }
    render_information();
    const focus_context = confirmation
      ? `confirm:${confirmation.kind}`
      : `${screen}:${current.human?.view.phase}:${current.human?.view.decision_owner}:${detail?.kind}:${detail?.kind === "gallery" ? detail.page : detail?.kind === "card" ? detail.id : detail?.kind === "crew" ? detail.crew : ""}`;
    if (focus_context !== previous_focus_context) {
      (
        content.querySelector<HTMLElement>("#confirmation_title") ??
        (current.human?.view.decision_owner === 0
          ? content.querySelector<HTMLElement>("#screen_heading")
          : content.querySelector<HTMLElement>("#detail_heading")) ??
        content.querySelector<HTMLElement>("#screen_heading")
      )?.focus();
      previous_focus_context = focus_context;
    } else if (active_id)
      content.querySelector<HTMLElement>(`#${active_id}`)?.focus();
    queue_rival();
  }
  if (has_live_game) refresh_history();
  render();
  return {
    dispose() {
      disposed = true;
      invalidate();
      root.replaceChildren();
    },
  };
}
