import { test, expect } from "@playwright/test";

test("loads engine and accepts invite links", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://localhost:8787", { waitUntil: "networkidle" });
  await expect(page.locator("#choose-host")).toContainText("Start a new game");
  await expect(page.locator("#choose-join")).toContainText("Join a game");
  await expect(page.locator("#engine-status")).toContainText("Engine ready", {
    timeout: 60000
  });

  const room = await page.evaluate(async () => {
    const response = await fetch("/api/newroom");
    const body = await response.json();
    return body.room;
  });

  await page.click("#choose-join");
  await page.fill("#join-link", `http://localhost:8787/room/${room}`);
  await expect(page.locator("#join-game")).toBeEnabled();

  expect(errors.filter((error) => !error.includes("favicon"))).toEqual([]);
});
