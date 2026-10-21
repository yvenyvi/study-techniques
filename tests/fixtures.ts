import { test as base, expect } from "@playwright/test";
import { disableGuidesForContext } from "./guides-flow.mjs";

// Existing study workflows run with introductions already seen. The guides
// suite separately exercises the real first-visit UI without this fixture.
export const test = base.extend({
  context: async ({ context }, use) => {
    await disableGuidesForContext(context);
    await use(context);
  },
});
export { expect };
