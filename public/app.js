const form = document.querySelector("#compare-form");
const resultsRoot = document.querySelector("#results");
const assumptionsRoot = document.querySelector("#assumptions");
const heroStats = document.querySelector("#hero-stats");
const workloadSelect = document.querySelector("#workload");
const marketSelect = document.querySelector("#market");
const regionSelect = document.querySelector("#region");
const billingSelect = document.querySelector("#billingModel");
const workloadHint = document.querySelector("#workload-hint");
const marketHint = document.querySelector("#market-hint");
const resultSummaryRoot = document.querySelector("#result-summary");
const fieldGroups = [...document.querySelectorAll("[data-workload-field]")];

let metadataCache = null;

function money(value, currency = "USD") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function createOption(select, item) {
  const option = document.createElement("option");
  option.value = item.id;
  option.textContent = item.label;
  select.append(option);
}

function setStatus(message, tone = "neutral") {
  resultsRoot.innerHTML = `<div class="empty-state ${tone}">${message}</div>`;
}

function syncVisibleFields(workload) {
  for (const field of fieldGroups) {
    const visibleWorkloads = field.dataset.workloadField.split(" ");
    field.hidden = !visibleWorkloads.includes(workload);
  }

  const currentWorkload = metadataCache?.workloads.find((item) => item.id === workload);
  workloadHint.textContent = currentWorkload?.description || "";
}

function syncMarketHint(market) {
  const currentMarket = metadataCache?.markets.find((item) => item.id === market);
  marketHint.textContent = currentMarket?.description || "";
}

function populateRegionOptions(market, preferredRegion) {
  const regions = metadataCache.regions.filter((region) => region.markets.includes(market));
  regionSelect.innerHTML = "";
  regions.forEach((item) => createOption(regionSelect, item));

  const selected = regions.some((region) => region.id === preferredRegion) ? preferredRegion : regions[0]?.id;

  if (selected) {
    regionSelect.value = selected;
  }
}

function formatUpdatedAt(value) {
  if (!value) {
    return "待刷新";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderSummary(data) {
  if (!data.results.length) {
    resultSummaryRoot.innerHTML = "";
    resultSummaryRoot.hidden = true;
    return;
  }

  const [best, runnerUp] = data.results;
  const sameCurrency = !runnerUp || runnerUp.currency === best.currency;
  const savings = runnerUp ? Math.max(runnerUp.estimatedMonthly - best.estimatedMonthly, 0) : 0;
  let savingsCopy = "当前筛选条件下仅有一个报价匹配。";

  if (runnerUp && sameCurrency) {
    savingsCopy = `相较于 ${runnerUp.vendor}，当前推荐每月约节省 ${money(savings, best.currency)}。`;
  } else if (runnerUp) {
    savingsCopy = "当前结果包含多币种市场数据，因此不直接展示节省金额。";
  }

  resultSummaryRoot.hidden = false;
  resultSummaryRoot.innerHTML = `
    <div class="summary-card">
      <p class="summary-kicker">当前最优组合</p>
      <div class="summary-grid">
        <div>
          <h3>${best.vendor}</h3>
          <p class="summary-copy">${best.sku} · ${best.regionLabel} · ${best.marketLabel}</p>
        </div>
        <div class="summary-metric">${money(best.estimatedMonthly, best.currency)}/月</div>
      </div>
      <p class="summary-copy">${savingsCopy}</p>
    </div>
  `;
}

function renderResults(data) {
  resultsRoot.innerHTML = "";
  renderSummary(data);

  if (!data.results.length) {
    setStatus("当前条件下还没有匹配报价。你可以切换市场、区域、计费方式，或者放宽资源规格后再试一次。", "neutral");
    return;
  }

  data.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = `result-card${index === 0 ? " best" : ""}`;
    const breakdown = Object.entries(result.breakdown)
      .map(([key, value]) => `<span class="pill">${key}: ${money(value, result.currency)}</span>`)
      .join("");
    const highlights = result.highlights.map((item) => `<li>${item}</li>`).join("");
    const notes = result.notes.map((item) => `<li>${item}</li>`).join("");
    const metaPills = [
      `市场 ${result.marketLabel}`,
      `运营方 ${result.operator}`,
      `来源 ${result.sourceLabel}`,
      `币种 ${result.currency}`,
      `更新时间 ${formatUpdatedAt(result.lastUpdatedAt)}`
    ]
      .map((item) => `<span class="pill">${item}</span>`)
      .join("");

    card.innerHTML = `
      <div class="result-topline">
        <div>
          <h3>${index === 0 ? "最佳匹配 " : ""}${result.vendor}</h3>
          <div class="result-sku">${result.sku} · ${result.regionLabel}</div>
        </div>
        <div class="price-badge">${money(result.estimatedMonthly, result.currency)}/月</div>
      </div>
      <div class="result-meta">${metaPills}</div>
      <div class="breakdown">${breakdown}</div>
      <ul class="highlight-list">${highlights}</ul>
      <ul class="highlight-list">${notes}</ul>
    `;
    resultsRoot.append(card);
  });
}

function renderAssumptions(assumptions) {
  assumptionsRoot.innerHTML = assumptions.map((item) => `<li>${item}</li>`).join("");
}

function getNumericField(formData, key) {
  return Number(formData.get(key)) || 0;
}

function getRequirements(formData) {
  return {
    vcpu: getNumericField(formData, "vcpu"),
    memoryGb: getNumericField(formData, "memoryGb"),
    storageGb: getNumericField(formData, "storageGb"),
    requestCount10k: getNumericField(formData, "requestCount10k"),
    transferGb: getNumericField(formData, "transferGb"),
    gpuCount: getNumericField(formData, "gpuCount")
  };
}

function buildPayload() {
  const formData = new FormData(form);
  return {
    workload: formData.get("workload"),
    market: formData.get("market"),
    region: formData.get("region"),
    billingModel: formData.get("billingModel"),
    requirements: getRequirements(formData)
  };
}

function syncUrl(payload, replace = false) {
  const params = new URLSearchParams();
  params.set("workload", payload.workload);
  params.set("market", payload.market);
  params.set("region", payload.region);
  params.set("billingModel", payload.billingModel);

  Object.entries(payload.requirements).forEach(([key, value]) => {
    if (value > 0) {
      params.set(key, String(value));
    }
  });

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  const state = { payload };

  if (replace) {
    window.history.replaceState(state, "", nextUrl);
    return;
  }

  window.history.pushState(state, "", nextUrl);
}

function hydrateFormFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const knownWorkloads = new Set(metadataCache.workloads.map((item) => item.id));
  const knownMarkets = new Set(metadataCache.markets.map((item) => item.id));
  const knownBillingModels = new Set(metadataCache.billingModels.map((item) => item.id));

  const workload = params.get("workload");
  const market = params.get("market");
  const region = params.get("region");
  const billingModel = params.get("billingModel");

  workloadSelect.value = knownWorkloads.has(workload) ? workload : "general-compute";
  marketSelect.value = knownMarkets.has(market) ? market : "global";
  populateRegionOptions(marketSelect.value, region);
  billingSelect.value = knownBillingModels.has(billingModel) ? billingModel : "payg";

  const numberFields = [
    ["vcpu", "2"],
    ["memoryGb", "8"],
    ["storageGb", "100"],
    ["requestCount10k", "50"],
    ["transferGb", "200"],
    ["gpuCount", "1"]
  ];

  numberFields.forEach(([key, fallback]) => {
    const field = form.elements.namedItem(key);

    if (!(field instanceof HTMLInputElement)) {
      return;
    }

    const value = params.get(key);
    field.value = value && !Number.isNaN(Number(value)) ? value : fallback;
  });

  syncVisibleFields(workloadSelect.value);
  syncMarketHint(marketSelect.value);
}

async function loadMetadata() {
  const response = await fetch("/api/metadata");

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}`);
  }

  metadataCache = await response.json();

  metadataCache.workloads.forEach((item) => createOption(workloadSelect, item));
  metadataCache.markets.forEach((item) => createOption(marketSelect, item));
  metadataCache.billingModels.forEach((item) => createOption(billingSelect, item));

  heroStats.innerHTML = `
    <span class="stat-chip">${metadataCache.vendorCount} 家云厂商</span>
    <span class="stat-chip">${metadataCache.offerCount} 条标准化报价</span>
    <span class="stat-chip">${metadataCache.markets.length} 个市场</span>
    <span class="stat-chip">${metadataCache.generatedAt ? `最新 Azure 刷新 ${formatUpdatedAt(metadataCache.generatedAt)}` : "支持可分享查询链接"}</span>
  `;

  hydrateFormFromUrl();
}

async function compare({ replaceHistory = false } = {}) {
  const payload = buildPayload();
  syncUrl(payload, replaceHistory);
  resultSummaryRoot.hidden = true;
  setStatus("正在计算当前市场下最接近的报价组合...", "neutral");

  try {
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Compare request failed with status ${response.status}`);
    }

    const data = await response.json();
    renderResults(data);
    renderAssumptions(data.assumptions);
  } catch (error) {
    resultSummaryRoot.hidden = true;
    assumptionsRoot.innerHTML = "";
    setStatus(
      error instanceof Error ? `报价比较失败：${error.message}` : "报价比较失败。",
      "error"
    );
  }
}

marketSelect.addEventListener("change", () => {
  populateRegionOptions(marketSelect.value);
  syncMarketHint(marketSelect.value);
});

workloadSelect.addEventListener("change", (event) => {
  syncVisibleFields(event.target.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await compare();
});

window.addEventListener("popstate", async () => {
  hydrateFormFromUrl();
  await compare({ replaceHistory: true });
});

try {
  await loadMetadata();
  await compare({ replaceHistory: true });
} catch (error) {
  setStatus(
    error instanceof Error ? `无法加载元数据：${error.message}` : "无法加载元数据。",
    "error"
  );
}
