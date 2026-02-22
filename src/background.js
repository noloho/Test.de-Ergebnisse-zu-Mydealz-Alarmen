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
    return { ok: false, keyword, error: "Not logged in to mydealz.de" };
  }

  const xsrfToken = xsrfTokenRaw ? xsrfTokenRaw.replace(/^"|"$/g, "") : null;
  if (!xsrfToken) {
    return { ok: false, keyword, error: "Missing XSRF token cookie" };
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
    return { ok: false, keyword, error: json.errors[0].message || "GraphQL error" };
  }

  return { ok: true, keyword };
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
