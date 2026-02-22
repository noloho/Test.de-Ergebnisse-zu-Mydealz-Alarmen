const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_SETTINGS = {
  temperature: 100,
  sendEmail: false,
  enableBrowserPushNotification: false,
  isDailyDigest: false,
  minPrice: null,
  maxPrice: null
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

function getSettings() {
  return storageGet(DEFAULT_SETTINGS).then((items) => ({
    ...DEFAULT_SETTINGS,
    ...(items || {})
  }));
}

function getCookie(name) {
  return new Promise((resolve) => {
    api.cookies.get(
      { url: "https://www.mydealz.de/", name },
      (cookie) => resolve(cookie ? cookie.value : null)
    );
  });
}

function buildMutationPayload(keyword, settings) {
  return {
    query:
      "mutation SubscribeOrUpdateKeywordAlert($input: SubscribeOrUpdateKeywordAlertInput!) {" +
      " subscribeOrUpdateKeywordAlert(input: $input) {" +
      "  keyword { keyword }" +
      "  messages { title message type context identifier priority code iconName }" +
      " }" +
      "}",
    variables: {
      input: {
        keyword,
        temperature: settings.temperature,
        sendEmail: settings.sendEmail,
        enableBrowserPushNotification: settings.enableBrowserPushNotification,
        isDailyDigest: settings.isDailyDigest,
        requestParameters: {},
        minPrice: settings.minPrice,
        maxPrice: settings.maxPrice
      }
    }
  };
}

async function createAlert(keyword, settings) {
  const xsrfTokenRaw = await getCookie("xsrf_t");
  const pepperSession = await getCookie("pepper_session");
  if (!pepperSession) {
    return { ok: false, keyword, error: "Nicht bei mydealz.de eingeloggt." };
  }

  const xsrfToken = xsrfTokenRaw ? xsrfTokenRaw.replace(/^"|"$/g, "") : null;
  if (!xsrfToken) {
    return { ok: false, keyword, error: "XSRF-Token-Cookie fehlt." };
  }

  const payload = buildMutationPayload(keyword, settings);

  const res = await fetch("https://www.mydealz.de/graphql", {
    method: "POST",
    credentials: "include",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "X-Request-Type": "application/vnd.pepper.v1+json",
      "X-Requested-With": "XMLHttpRequest",
      "X-Pepper-Txn": "alerts.feed",
      "X-XSRF-TOKEN": xsrfToken
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    return { ok: false, keyword, error: `HTTP ${res.status}` };
  }

  const json = await res.json();
  if (json.errors && json.errors.length) {
    return { ok: false, keyword, error: json.errors[0].message || "GraphQL-Fehler" };
  }

  return { ok: true, keyword };
}

function normalizeTestDeKeyword(text) {
  return text.replace(/\s+/g, " ").trim();
}

function collectTestdeKeywordsFromDoc(doc) {
  const items = Array.from(doc.querySelectorAll("li.product-list-item"));
  const keywords = [];
  const seen = new Set();

  for (const item of items) {
    const brandEl = item.querySelector(".product-list-item__company-link");
    const modelEl = item.querySelector(".product-list-item__name-link");
    const brand = brandEl ? normalizeTestDeKeyword(brandEl.textContent || "") : "";
    const model = modelEl ? normalizeTestDeKeyword(modelEl.textContent || "") : "";

    if (!model) continue;

    let keyword = model;
    if (brand) {
      const lowerBrand = brand.toLowerCase();
      const lowerModel = model.toLowerCase();
      keyword = lowerModel.startsWith(lowerBrand) ? model : `${brand} ${model}`;
    }

    keyword = normalizeTestDeKeyword(keyword);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
  }

  return keywords;
}

async function fetchTestdePage(url) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!res.ok) {
    return { ok: false, url, error: `HTTP ${res.status}` };
  }

  const html = await res.text();
  if (typeof DOMParser === "undefined") {
    return { ok: false, url, error: "DOMParser unavailable" };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const keywords = collectTestdeKeywordsFromDoc(doc);
  return { ok: true, url, keywords };
}

async function createAlertsSequential(keywords, settings) {
  const results = [];
  for (const keyword of keywords) {
    // Avoid hammering the endpoint.
    // eslint-disable-next-line no-await-in-loop
    const res = await createAlert(keyword, settings);
    results.push(res);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 350));
  }
  return results;
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "create-alerts") return;

  (async () => {
    const settings = await getSettings();
    const keywords = Array.isArray(msg.keywords) ? msg.keywords : [];
    const results = await createAlertsSequential(keywords, settings);
    return results;
  })()
    .then((results) => sendResponse({ ok: true, results }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));

  return true;
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "fetch-testde-pages") return;

  (async () => {
    const urls = Array.isArray(msg.urls) ? msg.urls : [];
    const results = [];
    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetchTestdePage(url);
      results.push(res);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
    return results;
  })()
    .then((results) => sendResponse({ ok: true, results }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));

  return true;
});

// Auto-open popup removed; Firefox does not allow opening action popups programmatically.
