import { mkdirSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({
  permissions: ["camera", "microphone"],
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.getByRole("button", { name: "Play C chord", exact: true }).click();
await page
  .getByRole("button", { name: "Record instruments", exact: true })
  .click();
await page.getByRole("button", { name: "Play Am chord", exact: true }).click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Stop ·/ }).click();
await page.getByRole("status").filter({ hasText: "Take saved" }).waitFor();
assert.equal(await page.locator(".takeCard").count(), 1);
const result = await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("voxmio-studio");
    r.onsuccess = () => resolve(r.result);
    r.onerror = reject;
  });
  const takes = await new Promise((resolve) => {
    const r = db.transaction("takes").objectStore("takes").getAll();
    r.onsuccess = () => resolve(r.result);
  });
  const b = takes[0].blob;
  const ctx = new AudioContext();
  const data = await ctx.decodeAudioData(await b.arrayBuffer());
  const samples = data.getChannelData(0);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  await ctx.close();
  db.close();
  return { bytes: b.size, peak };
});
assert.ok(
  result.peak > 0.01,
  `Recorded instrument silent: ${JSON.stringify(result)}`,
);
await page.reload();
await page.locator(".takeCard").waitFor();
await page
  .getByRole("button", { name: "Use microphone only", exact: true })
  .click();
await page.getByText("Mic connected", { exact: true }).waitFor();
await page.getByRole("checkbox", { name: /Vocal harmony/ }).check();
await page
  .getByRole("button", { name: "Record performance", exact: true })
  .click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Stop ·/ }).click();
await page.getByRole("status").filter({ hasText: "Take saved" }).waitFor();
assert.equal(await page.locator(".takeCard").count(), 2);
await page
  .getByRole("button", { name: "Turn camera & mic off", exact: true })
  .click();
await page
  .getByRole("button", { name: /Delete Take/ })
  .first()
  .click();
await page.waitForTimeout(200);
assert.equal(await page.locator(".takeCard").count(), 1);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({
  path: "test-results/studio-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({
  path: "test-results/studio-mobile.png",
  fullPage: true,
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  "Mobile overflow",
);
assert.ok(
  await page
    .locator(".camera")
    .evaluate((el) => el.getBoundingClientRect().width <= innerWidth),
  "Camera clipped on mobile",
);
await page.route("**/hand_landmarker.task", (r) => r.abort());
await page
  .getByRole("button", { name: "Enable camera + mic", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Hand tracking could not load" })
  .waitFor();
await page
  .getByRole("button", { name: "Record performance", exact: true })
  .click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Stop ·/ }).click();
await page.getByRole("status").filter({ hasText: "Take saved" }).waitFor();
assert.equal(await page.locator(".takeCard").count(), 2);
await page
  .getByRole("button", { name: "Turn camera & mic off", exact: true })
  .click();
await page.evaluate(() => {
  navigator.mediaDevices.getUserMedia = () =>
    Promise.reject(new DOMException("Denied", "NotAllowedError"));
});
await page
  .getByRole("button", { name: "Use microphone only", exact: true })
  .click();
await page
  .getByRole("status")
  .filter({ hasText: "Permission denied" })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  JSON.stringify({
    passed: [
      "pad audio exported with non-silent signal",
      "record and save",
      "reload persistence",
      "microphone with harmony",
      "delete take",
      "mobile width",
      "no uncaught errors",
    ],
    recording: result,
  }),
);
await browser.close();
