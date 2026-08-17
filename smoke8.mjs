import { chromium } from "playwright-core";
import path from "node:path";

const executablePath = path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1234", "chrome-win64", "chrome.exe");
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("[console] " + msg.text()); });
page.on("dialog", (d) => d.accept());

const state = { gistId: "mockgistDESC", files: {}, updatedAt: new Date().toISOString(), descriptions: [] };
function entry(e) { return e === null ? null : { content: e.content }; }

await page.route("https://api.github.com/gists", async (route) => {
  if (route.request().method() !== "POST") return route.fallback();
  const body = JSON.parse(route.request().postData());
  state.files = {};
  for (const [name, e] of Object.entries(body.files)) state.files[name] = entry(e);
  state.updatedAt = new Date().toISOString();
  state.descriptions.push({ op: "create", description: body.description });
  await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: state.gistId, updated_at: state.updatedAt }) });
});
await page.route(`https://api.github.com/gists/${state.gistId}`, async (route) => {
  const method = route.request().method();
  if (method === "GET") {
    const files = {};
    for (const [name, f] of Object.entries(state.files)) files[name] = { filename: name, content: f.content, truncated: false };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: state.gistId, files, updated_at: state.updatedAt }) });
    return;
  }
  if (method === "PATCH") {
    const body = JSON.parse(route.request().postData());
    for (const [name, e] of Object.entries(body.files)) {
      if (e === null) delete state.files[name];
      else state.files[name] = entry(e);
    }
    state.updatedAt = new Date().toISOString();
    state.descriptions.push({ op: "patch", description: body.description, hasDescriptionKey: Object.prototype.hasOwnProperty.call(body, "description") });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: state.gistId, updated_at: state.updatedAt }) });
    return;
  }
  return route.fallback();
});

await page.goto("http://localhost:8796/index.html", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.click("#loadSampleBtn");
await page.waitForTimeout(300);

await page.click("#syncMenuBtn");
await page.waitForTimeout(150);
await page.click("#syncMenuSetupBtn");
await page.waitForTimeout(150);
await page.fill(".modal-host input.form-control", "fake-token");
await page.click(".modal-host button:has-text('Next')");
await page.waitForTimeout(150);
await page.click(".modal-host a:has-text(\"Don't have one yet?\")");
await page.waitForTimeout(150);
await page.click(".modal-host button:has-text('Create Sync Gist')");
await page.waitForTimeout(400);

console.log("After CREATE:", JSON.stringify(state.descriptions));

// Make a genuine, non-blocked edit (toggle Edit Mode off/on doesn't count as data; use Reset Progress
// which does change rawData) so the next push is a REAL push, not a skip.
await page.click("#resetProgressBtn");
await page.waitForTimeout(200);

await page.click("#syncMenuBtn");
await page.waitForTimeout(150);
await page.click("#manualPushBtn");
await page.waitForTimeout(400);

console.log("After PUSH:", JSON.stringify(state.descriptions));

const toasts = await page.$$eval("[class*='toast']", (els) => [...new Set(els.map((e) => e.textContent))]);
console.log("toasts:", JSON.stringify(toasts));

console.log("PAGE ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
