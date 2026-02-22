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

function loadSettings() {
  storageGet(DEFAULT_SETTINGS).then((items) => {
    const settings = { ...DEFAULT_SETTINGS, ...(items || {}) };
    document.getElementById("temperature").value = settings.temperature ?? 100;
    document.getElementById("minPrice").value =
      settings.minPrice === null ? "" : settings.minPrice;
    document.getElementById("maxPrice").value =
      settings.maxPrice === null ? "" : settings.maxPrice;
    document.getElementById("sendEmail").checked = !!settings.sendEmail;
    document.getElementById("enableBrowserPushNotification").checked =
      !!settings.enableBrowserPushNotification;
    document.getElementById("isDailyDigest").checked = !!settings.isDailyDigest;
  });
}

function parseNullableNumber(value) {
  if (value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const settings = {
    temperature: Number(document.getElementById("temperature").value || 0),
    minPrice: parseNullableNumber(document.getElementById("minPrice").value),
    maxPrice: parseNullableNumber(document.getElementById("maxPrice").value),
    sendEmail: document.getElementById("sendEmail").checked,
    enableBrowserPushNotification: document.getElementById(
      "enableBrowserPushNotification"
    ).checked,
    isDailyDigest: document.getElementById("isDailyDigest").checked
  };

  storageSet(settings).then(() => {
    const status = document.getElementById("status");
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});

loadSettings();
