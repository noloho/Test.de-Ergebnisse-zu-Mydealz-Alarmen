const api = typeof browser !== "undefined" ? browser : chrome;

function collectProductKeywords() {
  const items = Array.from(document.querySelectorAll("li.product-list-item"));
  const keywords = [];
  const seen = new Set();

  for (const item of items) {
    const brandEl = item.querySelector(".product-list-item__company-link");
    const modelEl = item.querySelector(".product-list-item__name-link");
    const brand = brandEl ? brandEl.textContent.trim() : "";
    const model = modelEl ? modelEl.textContent.trim() : "";

    if (!model) continue;

    let keyword = model;
    if (brand) {
      const lowerBrand = brand.toLowerCase();
      const lowerModel = model.toLowerCase();
      keyword = lowerModel.startsWith(lowerBrand) ? model : `${brand} ${model}`;
    }

    keyword = keyword.replace(/\s+/g, " ").trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    keywords.push(keyword);
  }

  return keywords;
}

function createFloatingButton() {
  const container = document.createElement("div");
  container.id = "mdwt-floating";
  container.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:99999;" +
    "font-family:system-ui,Segoe UI,Arial,sans-serif;";

  const button = document.createElement("button");
  button.textContent = "Create Mydealz Deal Alarms";
  button.style.cssText =
    "background:#ff6b00;color:#fff;border:none;border-radius:999px;" +
    "padding:12px 16px;font-size:14px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.2);";

  const status = document.createElement("div");
  status.textContent = "";
  status.style.cssText =
    "margin-top:8px;background:#fff;color:#111;padding:8px 10px;border-radius:8px;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.12);font-size:12px;display:none;max-width:260px;";

  container.appendChild(button);
  container.appendChild(status);
  document.body.appendChild(container);

  return { button, status };
}

function setStatus(statusEl, text, show = true) {
  statusEl.textContent = text;
  statusEl.style.display = show ? "block" : "none";
}

async function handleClick(button, status) {
  const keywords = collectProductKeywords();
  if (!keywords.length) {
    setStatus(status, "No products found on this page.", true);
    return;
  }

  const proceed = window.confirm(
    `Create ${keywords.length} deal alarms on mydealz.de?`
  );
  if (!proceed) return;

  button.disabled = true;
  button.style.opacity = "0.7";
  setStatus(status, "Creating deal alarms...", true);

  const response = await api.runtime.sendMessage({
    type: "create-alerts",
    keywords
  });

  if (!response || !response.ok) {
    setStatus(status, `Failed: ${response ? response.error : "unknown error"}`, true);
    button.disabled = false;
    button.style.opacity = "1";
    return;
  }

  const okCount = response.results.filter((r) => r.ok).length;
  const failCount = response.results.length - okCount;
  const failMsg = failCount
    ? ` (${failCount} failed)`
    : "";

  setStatus(
    status,
    `Done: ${okCount} alarms created${failMsg}.`,
    true
  );

  button.disabled = false;
  button.style.opacity = "1";
}

(() => {
  const { button, status } = createFloatingButton();
  button.addEventListener("click", () => handleClick(button, status));
})();
