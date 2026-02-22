const api = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_KEYS = {
  lastScan: "lastScanKeywords"
};

function storageGet(keys) {
  try {
    const result = api.storage.sync.get(keys);
    if (result && typeof result.then === "function") return result;
  } catch {
    // ignore and fall back to callback style
  }
  return new Promise((resolve) => {
    api.storage.sync.get(keys, (items) => resolve(items));
  });
}

function storageSet(items) {
  try {
    const result = api.storage.sync.set(items);
    if (result && typeof result.then === "function") return result;
  } catch {
    // ignore and fall back to callback style
  }
  return new Promise((resolve) => {
    api.storage.sync.set(items, () => resolve());
  });
}

function normalizeList(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const text = String(item || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function updateCounts(found) {
  document.getElementById("found-count").textContent = String(found.length);
  document.getElementById("create-count").textContent = String(found.length);
}

function renderPreview(list) {
  const ul = document.getElementById("preview-list");
  ul.textContent = "";
  for (const item of list) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  }
}

async function getActiveTab() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function scanTestde() {
  const tab = await getActiveTab();
  if (!tab || !tab.id || !tab.url) {
    setStatus("No active tab.");
    return;
  }
  if (!/https?:\/\/(www\.)?test\.de\//i.test(tab.url)) {
    setStatus("Open a test.de results page first.");
    return;
  }

  const response = await api.tabs.sendMessage(tab.id, {
    type: "collect-testde-products"
  });

  if (!response || !response.ok) {
    setStatus("Failed to scan test.de page.");
    return;
  }

  const keywords = normalizeList(response.keywords || []);
  await storageSet({ [STORAGE_KEYS.lastScan]: keywords });
  await refreshUI();
  setStatus(`Scanned ${keywords.length} products.`);
}

async function createAlerts() {
  const { lastScanKeywords = [] } = await storageGet([STORAGE_KEYS.lastScan]);
  const found = normalizeList(lastScanKeywords);

  if (!found.length) {
    setStatus("No scanned products yet.");
    return;
  }

  if (document.getElementById("dry-run").checked) {
    updateCounts(found);
    renderPreview(found);
    setStatus(`Dry run: ${found.length} alerts would be created.`);
    return;
  }

  setStatus("Creating alerts...");
  const response = await api.runtime.sendMessage({
    type: "create-alerts",
    keywords: found
  });

  if (!response || !response.ok) {
    setStatus(`Failed: ${response ? response.error : "unknown error"}`);
    return;
  }

  const okResults = response.results.filter((r) => r.ok);
  const failed = response.results.length - okResults.length;
  await refreshUI();

  const failMsg = failed ? ` (${failed} failed)` : "";
  setStatus(`Created ${okResults.length} alerts${failMsg}.`);
}

async function refreshUI() {
  const { lastScanKeywords = [] } = await storageGet([STORAGE_KEYS.lastScan]);

  const found = normalizeList(lastScanKeywords);

  updateCounts(found);
  renderPreview(found);
}

document.getElementById("scan-testde").addEventListener("click", async () => {
  try {
    await scanTestde();
  } catch (err) {
    setStatus(`Error: ${err.message || String(err)}`);
  }
});
document.getElementById("create-alerts").addEventListener("click", async () => {
  try {
    await createAlerts();
  } catch (err) {
    setStatus(`Error: ${err.message || String(err)}`);
  }
});

refreshUI();
