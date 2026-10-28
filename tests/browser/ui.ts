import { mount_game } from "../../src/ui/app.ts";
import { create_controller } from "../../src/app/controller.ts";
import * as real from "@city-of-vice/engine";
import type { Engine_facade } from "../../src/engine/index.ts";
import "../../src/ui/styles.css";

// Test-only capability composition, never a source of engine/policy successes.
let ui: ReturnType<typeof mount_game> | undefined;
let tasks: { run: () => void; cancelled: boolean }[] = [];
const calls: { operation: string; args: string[]; output: string }[] = [];
const faults = {
  acquire: false,
  read: false,
  write: false,
  command_decode: false,
  publication_after_command: false,
};
const storage_calls: string[] = [];
let publication_fault = false;
const facade = Object.fromEntries(
  (Object.keys(real) as (keyof typeof real)[])
    .filter((key) => key !== "probe")
    .map((key) => [
      key,
      (...args: string[]) => {
        const output = (real[key] as (...values: string[]) => string)(...args);
        calls.push({ operation: key, args, output });
        if (key === "perform_command") {
          if (faults.command_decode) return "{";
          if (faults.publication_after_command) publication_fault = true;
        }
        if (
          key === "player_observation" &&
          args[1] === "0" &&
          publication_fault
        )
          throw Error("Test-only publication measurement fault");
        return output;
      },
    ]),
) as Engine_facade;
const acquire = () => {
  storage_calls.push("acquire");
  if (faults.acquire) throw Error("Test-only acquisition failure");
  return {
    getItem(key: string) {
      storage_calls.push("read");
      if (faults.read) throw Error("Test-only read failure");
      return localStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      storage_calls.push("write");
      if (faults.write) throw Error("Test-only write failure");
      localStorage.setItem(key, value);
    },
  };
};
const api = {
  faults,
  reset() {
    ui?.dispose();
    tasks = [];
    calls.length = 0;
    storage_calls.length = 0;
    publication_fault = false;
    const controller = create_controller({ storage: acquire, facade });
    ui = mount_game(document.querySelector<HTMLElement>("#game")!, {
      controller,
      seed_source: () => "00000001",
      schedule(task) {
        const entry = { run: task, cancelled: false };
        tasks.push(entry);
        return () => {
          entry.cancelled = true;
        };
      },
    });
  },
  flush(include_cancelled = false) {
    const task = tasks.shift();
    if (!task) return false;
    if (!task.cancelled || include_cancelled) task.run();
    return true;
  },
  queued() {
    return tasks.filter((task) => !task.cancelled).length;
  },
  stats() {
    return {
      engine: calls.map((call) => call.operation),
      storage: [...storage_calls],
    };
  },
  forwarded() {
    return structuredClone(calls);
  },
};
Object.assign(window, { ui_test: api });
api.reset();
declare global {
  interface Window {
    ui_test: typeof api;
  }
}
