export interface KeyboardInput {
  isDown(code: string): boolean;
  dispose(): void;
}

export function createKeyboardInput(target: Window = window): KeyboardInput {
  const down = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => down.add(e.code);
  const onKeyUp = (e: KeyboardEvent) => down.delete(e.code);
  const onBlur = () => down.clear();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    isDown(code: string) {
      return down.has(code);
    },
    dispose() {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      down.clear();
    }
  };
}

