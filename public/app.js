const form = document.querySelector("#compare-form");
const resultsRoot = document.querySelector("#results");
const assumptionsRoot = document.querySelector("#assumptions");
const heroStats = document.querySelector("#hero-stats");
const workloadSelect = document.querySelector("#workload");
const regionSelect = document.querySelector("#region");
const billingSelect = document.querySelector("#billingModel");
const fieldGroups = [...document.querySelectorAll("[data-workload-field]")];

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

function syncVisibleFields(workload) {
  for (const field of fieldGroups) {
    const visibleWorkloads = field.dataset.workloadField.split(" ");
    field.hidden = !visibleWorkloads.includes(workload);
  }
}

function renderResults(data) {
  resultsRoot.innerHTML = "";

  if (!data.results.length) {
    resultsRoot.innerHTML = `
      <div class="empty-state">
        当前筛选条件下没有找到匹配报价。可以放宽区域、购买方式或规格要求再试一次。
      </div>
    `;
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

async function loadMetadata() {
  const response = await fetch("/api/metadata");
  const metadata = await response.json();

  metadata.workloads.forEach((item) => createOption(workloadSelect, item));
  metadata.regions.forEach((item) => createOption(regionSelect, item));
  metadata.billingModels.forEach((item) => createOption(billingSelect, item));

  heroStats.innerHTML = `
    <span class="stat-chip">${metadata.vendorCount} vendors</span>
    <span class="stat-chip">${metadata.offerCount} normalized offers</span>
    <span class="stat-chip">${metadata.regions.length} regions</span>
    <span class="stat-chip">Responsive mobile + desktop UI</span>
  `;

  workloadSelect.value = "general-compute";
  regionSelect.value = "eastus";
  billingSelect.value = "payg";
  syncVisibleFields(workloadSelect.value);
}

function getRequirements(formData) {
  return {
    vcpu: Number(formData.get("vcpu")) || 0,
    memoryGb: Number(formData.get("memoryGb")) || 0,
    storageGb: Number(formData.get("storageGb")) || 0,
    requestCount10k: Number(formData.get("requestCount10k")) || 0,
    transferGb: Number(formData.get("transferGb")) || 0,
    gpuCount: Number(formData.get("gpuCount")) || 0
  };
}

async function compare() {
  const formData = new FormData(form);
  const payload = {
    workload: formData.get("workload"),
    region: formData.get("region"),
    billingModel: formData.get("billingModel"),
    requirements: getRequirements(formData)
  };

  resultsRoot.innerHTML = `<div class="empty-state">正在计算最接近的报价组合...</div>`;

  const response = await fetch("/api/compare", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  renderResults(data);
  renderAssumptions(data.assumptions);
}

workloadSelect.addEventListener("change", (event) => {
  syncVisibleFields(event.target.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await compare();
});

await loadMetadata();
await compare();
