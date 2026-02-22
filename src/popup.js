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

function getTargetTabIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    const tabId = url.searchParams.get("tabId");
    if (!tabId) return null;
    const num = Number(tabId);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

async function getTargetTab() {
  const tabId = getTargetTabIdFromUrl();
  if (tabId !== null) {
    try {
      const tab = await api.tabs.get(tabId);
      return tab || null;
    } catch {
      // fall back to active tab
    }
  }
  return getActiveTab();
}

async function scanTestde() {
  const tab = await getTargetTab();
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
  let allKeywords = keywords;

  const includePages = document.getElementById("include-pages").checked;
  if (includePages) {
    const pagination = response.pagination || null;
    let otherUrls = [];
    if (pagination && pagination.basePath) {
      const totalCount = Number(pagination.totalCount || 0);
      const pageCount = totalCount > 0 ? Math.ceil(totalCount / 15) : 1;
      const basePath = pagination.basePath;
      const search = pagination.search || "";
      for (let i = 2; i <= pageCount; i += 1) {
        const url = new URL(tab.url);
        url.pathname = `${basePath}${i}/`;
        url.search = search;
        otherUrls.push(url.toString());
      }
    }
    otherUrls = normalizeList(otherUrls).filter((u) => u !== tab.url);
    if (otherUrls.length) {
      setStatus(`Fetching ${otherUrls.length} additional pages...`);
      const fetchRes = await api.runtime.sendMessage({
        type: "fetch-testde-pages",
        urls: otherUrls
      });

      if (!fetchRes || !fetchRes.ok) {
        setStatus("Failed to fetch additional pages.");
      } else {
        const fetched = [];
        for (const item of fetchRes.results || []) {
          if (item && item.ok && Array.isArray(item.keywords)) {
            fetched.push(...item.keywords);
          }
        }
        allKeywords = normalizeList([...keywords, ...fetched]);
      }
    }
  }

  await storageSet({ [STORAGE_KEYS.lastScan]: allKeywords });
  await refreshUI();
  setStatus(`Scanned ${allKeywords.length} products.`);
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
