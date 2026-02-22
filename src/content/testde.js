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

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "collect-testde-products") return;
  const keywords = collectProductKeywords();
  sendResponse({ ok: true, keywords });
  return true;
});
