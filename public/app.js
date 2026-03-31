const form = document.querySelector("#compare-form");
const resultsRoot = document.querySelector("#results");
const assumptionsRoot = document.querySelector("#assumptions");
const heroStats = document.querySelector("#hero-stats");
const workloadSelect = document.querySelector("#workload");
const regionSelect = document.querySelector("#region");
const billingSelect = document.querySelector("#billingModel");
const workloadHint = document.querySelector("#workload-hint");
const resultSummaryRoot = document.querySelector("#result-summary");
const fieldGroups = [...document.querySelectorAll("[data-workload-field]")];

let metadataCache = null;

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

function renderSummary(data) {
  if (!data.results.length) {
    resultSummaryRoot.innerHTML = "";
    resultSummaryRoot.hidden = true;
    return;
  }

  const [best, runnerUp] = data.results;
  const savings = runnerUp ? Math.max(runnerUp.estimatedMonthly - best.estimatedMonthly, 0) : 0;
  const savingsCopy = runnerUp
    ? `Compared with ${runnerUp.vendor}, this recommendation saves about ${money(savings)} per month.`
    : "Only one offer matches the current workload requirements.";

  resultSummaryRoot.hidden = false;
  resultSummaryRoot.innerHTML = `
    <div class="summary-card">
      <p class="summary-kicker">Best current match</p>
      <div class="summary-grid">
        <div>
          <h3>${best.vendor}</h3>
          <p class="summary-copy">${best.sku} in ${best.regionLabel}</p>
        </div>
        <div class="summary-metric">${money(best.estimatedMonthly)}/mo</div>
      </div>
      <p class="summary-copy">${savingsCopy}</p>
    </div>
  `;
}

function renderResults(data) {
  resultsRoot.innerHTML = "";
  renderSummary(data);

  if (!data.results.length) {
    setStatus("No matching offers were found for this filter set. Try relaxing the region, billing model, or resource requirements.", "neutral");
    return;
  }

  data.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = `result-card${index === 0 ? " best" : ""}`;
    const breakdown = Object.entries(result.breakdown)
      .map(([key, value]) => `<span class="pill">${key}: ${money(value)}</span>`)
      .join("");
    const highlights = result.highlights.map((item) => `<li>${item}</li>`).join("");
    const notes = result.notes.map((item) => `<li>${item}</li>`).join("");

    card.innerHTML = `
      <div class="result-topline">
        <div>
          <h3>${index === 0 ? "Best Match: " : ""}${result.vendor}</h3>
          <div class="result-sku">${result.sku} · ${result.regionLabel}</div>
        </div>
        <div class="price-badge">${money(result.estimatedMonthly)}/mo</div>
      </div>
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
    region: formData.get("region"),
    billingModel: formData.get("billingModel"),
    requirements: getRequirements(formData)
  };
}

function syncUrl(payload, replace = false) {
  const params = new URLSearchParams();
  params.set("workload", payload.workload);
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
  const knownRegions = new Set(metadataCache.regions.map((item) => item.id));
  const knownBillingModels = new Set(metadataCache.billingModels.map((item) => item.id));

  const workload = params.get("workload");
  const region = params.get("region");
  const billingModel = params.get("billingModel");

  workloadSelect.value = knownWorkloads.has(workload) ? workload : "general-compute";
  regionSelect.value = knownRegions.has(region) ? region : "eastus";
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
}

async function loadMetadata() {
  const response = await fetch("/api/metadata");

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}`);
  }

  metadataCache = await response.json();

  metadataCache.workloads.forEach((item) => createOption(workloadSelect, item));
  metadataCache.regions.forEach((item) => createOption(regionSelect, item));
  metadataCache.billingModels.forEach((item) => createOption(billingSelect, item));

  heroStats.innerHTML = `
    <span class="stat-chip">${metadataCache.vendorCount} vendors</span>
    <span class="stat-chip">${metadataCache.offerCount} normalized offers</span>
    <span class="stat-chip">${metadataCache.regions.length} regions</span>
    <span class="stat-chip">Shareable comparison URLs</span>
  `;

  hydrateFormFromUrl();
}

async function compare({ replaceHistory = false } = {}) {
  const payload = buildPayload();
  syncUrl(payload, replaceHistory);
  resultSummaryRoot.hidden = true;
  setStatus("Calculating the closest pricing matches for this workload...", "neutral");

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
      error instanceof Error
        ? `Pricing comparison failed: ${error.message}`
        : "Pricing comparison failed for an unknown reason.",
      "error"
    );
  }
}

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
    error instanceof Error
      ? `Unable to load application metadata: ${error.message}`
      : "Unable to load application metadata.",
    "error"
  );
}
