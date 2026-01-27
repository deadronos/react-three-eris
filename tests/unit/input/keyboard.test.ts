// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createKeyboardInput } from "../../../packages/eris/src/eris/input/keyboard";

describe("createKeyboardInput", () => {
  it("tracks keydown/keyup state by code", () => {
    const kb = createKeyboardInput(window);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    expect(kb.isDown("KeyW")).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    expect(kb.isDown("KeyW")).toBe(false);

    kb.dispose();
  });

  it("clears on blur", () => {
    const kb = createKeyboardInput(window);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    expect(kb.isDown("KeyA")).toBe(true);

    window.dispatchEvent(new FocusEvent("blur"));
    expect(kb.isDown("KeyA")).toBe(false);

    kb.dispose();
  });

  it("stops tracking after dispose()", () => {
    const kb = createKeyboardInput(window);
    kb.dispose();

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    expect(kb.isDown("KeyD")).toBe(false);
  });
});

