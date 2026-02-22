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

function collectPaginationUrls() {
  const current = new URL(window.location.href);
  const basePath = current.pathname.replace(/\/tabelle\/\d+\/?/, "/tabelle/");
  const currentSearch = current.search || "";

  let totalCount = null;
  const title = document.querySelector("#primary #filter-result-title h2");
  if (title && title.textContent) {
    const match = title.textContent.replace(/\s+/g, " ").match(/(\d+)/);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) totalCount = num;
    }
  }

  return {
    basePath,
    search: currentSearch,
    currentUrl: current.toString(),
    totalCount
  };
}

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "collect-testde-products") return;
  const keywords = collectProductKeywords();
  const pagination = collectPaginationUrls();
  sendResponse({ ok: true, keywords, pagination });
  return true;
});
