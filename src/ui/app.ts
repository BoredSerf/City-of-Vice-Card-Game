import {
  create_controller,
  type Controller_snapshot,
  type Controller_update,
  type New_game_intent,
} from "../app/controller.ts";
import type { Engine_command, Player_view } from "@city-of-vice/engine";
import {
  action_names,
  command_fields,
  matching_commands,
  next_choices,
} from "./choices.ts";
import { card_description, color_name, resource_colors } from "./catalog.ts";
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
export type Ui_options = {
  controller?: ReturnType<typeof create_controller>;
  seed_source?: () => string;
  schedule?: Schedule;
};
const random_seed = () => {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (value || 1).toString(16).padStart(8, "0");
};

/** Same composition in production and tests; injected capabilities never supply state. */
export function mount_game(root: HTMLElement, options: Ui_options = {}) {
  const controller = options.controller ?? create_controller();
  const seed_source = options.seed_source ?? random_seed;
  const schedule =
    options.schedule ??
    ((task) => {
      const timer = setTimeout(task, 120);
      return () => clearTimeout(timer);
    });
  let current = controller.inspect_save().snapshot;
  let screen: "menu" | "game" = "menu";
  let confirmation: Confirmation | null = null;
  let family: Engine_command["command"] | null = null;
  let selected: string[] = [];
  let log: string[] = [],
    recap: string[] = [];
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
    current = update.snapshot;
    clear_selection();
    const applied = update.status === "applied";
    if (applied && (source === "new" || source === "resume")) {
      log = source === "resume" ? ["Game resumed."] : [];
      recap = [];
      needs_ack = false;
      display_fault = false;
      screen = "game";
      confirmation = null;
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
      log.push(...facts);
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
    if (current.human)
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
    if (current.human && !current.save.saved) {
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
    button(
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
        `Hand: ${player.hand_count} cards · Active cards: ${player.active_card_ids.length}`,
        area,
      );
      const bank = element("dl", undefined, area);
      bank.className = "resource_bank";
      for (const color of resource_colors) {
        const item = element("div", undefined, bank);
        item.className = `resource ${color}`;
        element("dt", color_name(color), item);
        element("dd", String(player.resources[color]), item);
      }
      const cards = element("ul", undefined, area);
      cards.className = "cards";
      for (const id of player.active_card_ids)
        element("li", card_description(id), cards);
    }
    const hand = element("section");
    hand.setAttribute("aria-label", "Your hand");
    element("h3", "Your hand", hand);
    const cards = element("ul", undefined, hand);
    cards.className = "cards";
    for (const id of view.hand)
      element(
        "li",
        `${card_description(id)}${view.suspended_card_ids.includes(id) ? " Suspended." : ""}`,
        cards,
      );
    if (view.hand.length === 0) element("p", "Your hand is empty.", hand);
    element(
      "p",
      `Draw price: ${view.draw_price} · Your resource limit: ${view.resource_limit} · Trade rate: ${view.trade_rate} to 1 · Distributor capacity: ${view.distributor_capacity}. Draw pile: ${view.draw_pile_count}; discard: ${view.discard_count}.`,
    );
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
      button(
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
    if (notice) element("p", notice).className = "notice";
    if (confirmation) render_confirmation();
    else if (screen === "menu") {
      const heading = element("h2", "Main menu");
      heading.tabIndex = -1;
      heading.id = "screen_heading";
      element(
        "p",
        "Build your businesses against the heuristic rival. One local human, one rival.",
      );
      save_panel();
      if (current.human)
        button(
          current.human.view.phase === "over"
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
      const title = !view
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
      save_panel();
      if (view) {
        element(
          "p",
          `Phase: ${view.phase.replaceAll("_", " ")}${view.decision_owner === null ? "" : ` · Decision owner: ${actor_name(view.decision_owner)}`}`,
        );
        render_board(view);
        render_recap(view);
        if (!current.integration_fault && !display_fault) render_actions(view);
        else
          element(
            "p",
            "Actions are paused. Return to the menu to inspect current progress.",
          );
      }
      const history = element("section");
      history.setAttribute("aria-label", "This session's action log");
      element("h3", "This session's action log", history);
      element(
        "p",
        "Only completed actions from this UI session are shown. Resume does not replay earlier history.",
        history,
      );
      const list = element("ol", undefined, history);
      for (const fact of log) element("li", fact, list);
    }
    const focus_context = confirmation
      ? `confirm:${confirmation.kind}`
      : `${screen}:${current.human?.view.phase}:${current.human?.view.decision_owner}`;
    if (focus_context !== previous_focus_context) {
      (content.querySelector("#confirmation_title") ??
        content.querySelector("#screen_heading")) instanceof HTMLElement &&
        content
          .querySelector<HTMLElement>("#confirmation_title, #screen_heading")
          ?.focus();
      previous_focus_context = focus_context;
    } else if (active_id)
      content.querySelector<HTMLElement>(`#${active_id}`)?.focus();
    queue_rival();
  }
  render();
  return {
    dispose() {
      disposed = true;
      invalidate();
      root.replaceChildren();
    },
  };
}
