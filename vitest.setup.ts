import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test starts from a clean DOM.
afterEach(cleanup);

/**
 * jsdom 26 has no PointerEvent.
 *
 * Base UI's Switch and Checkbox forward a click on their visible button to the
 * hidden native input with `new window.PointerEvent("click")`. Every browser has
 * that constructor; jsdom does not, so the handler threw and the control never
 * changed under test — while working fine in the app. A MouseEvent subclass is
 * enough: the input only needs a click event to run its activation behaviour.
 *
 * Test environment only. Nothing in the app depends on it.
 */
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }

  Object.defineProperty(window, "PointerEvent", {
    value: PointerEventShim,
    configurable: true,
    writable: true,
  });
}
