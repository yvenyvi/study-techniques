import { expect } from "@playwright/test";

/** Choose through the same custom UI used by mouse, touch, and keyboard users. */
export async function chooseOption(page, name, label) {
  const trigger = page.getByRole("combobox", { name, exact: true });
  await trigger.click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}
