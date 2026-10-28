import { create_controller } from "../../src/app/controller.ts";

// Test-only consumer. Vite's normal web entry never imports this module.
const controller = create_controller();
Object.assign(window, { controller_test: controller });
document.querySelector('[role="status"]')!.textContent = "Controller ready";
declare global {
  interface Window {
    controller_test: ReturnType<typeof create_controller>;
  }
}
