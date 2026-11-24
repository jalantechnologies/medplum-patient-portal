import { onTestFinished } from "vitest";

const ARRAY_METHODS_FIREFOX_114_LACKS = [
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
] as const;

export const removeArrayMethodsFirefox114Lacks = () => {
  const removedMethods = ARRAY_METHODS_FIREFOX_114_LACKS.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Array.prototype, name)] as const,
  );
  for (const [name] of removedMethods) {
    Reflect.deleteProperty(Array.prototype, name);
  }
  onTestFinished(() => {
    for (const [name, descriptor] of removedMethods) {
      if (descriptor) {
        Object.defineProperty(Array.prototype, name, descriptor);
      }
    }
  });
};
