import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputFile = path.join(__dirname, "..", "src", "data", "generated", "azure-market-offers.json");

const marketTargets = [
  {
    id: "azure-global-b2ms-eastus",
    vendor: "Azure",
    operator: "Microsoft",
    market: "global",
    workload: "general-compute",
    region: "eastus",
    sourceRegion: "eastus",
    sku: "B2ms",
    armSkuName: "Standard_B2ms",
    vcpu: 2,
    memoryGb: 8,
    serviceFamily: "vm",
    sourceLabel: "Azure 全球零售价格 API"
  },
  {
    id: "azure-china-b2ms-china-east",
    vendor: "Azure",
    operator: "21Vianet",
    market: "china",
    workload: "general-compute",
    region: "china-east",
    sourceRegion: "chinaeast2",
    sku: "B2ms",
    armSkuName: "Standard_B2ms",
    vcpu: 2,
    memoryGb: 8,
    serviceFamily: "vm",
    sourceLabel: "Azure 中国零售价格 API"
  }
];

function normalizeHourlyPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid price value: ${value}`);
  }

  return Math.round(number * 1000000) / 1000000;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return response.json();
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += character;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseCsv(text) {
  const rows = csvRows(text);
  const [header, ...body] = rows;

  return body.map((row) => {
    return header.reduce((record, key, index) => {
      record[key] = row[index] || "";
      return record;
    }, {});
  });
}

function buildAzureOffer(target, row, billingModel, generatedAt, sourceUrl) {
  return {
    id: `${target.vendor.toLowerCase()}-${target.market}-${target.region}-${target.sku.toLowerCase()}-${billingModel}`,
    vendor: target.vendor,
    operator: target.operator,
    market: target.market,
    serviceFamily: target.serviceFamily,
    workload: target.workload,
    region: target.region,
    billingModel,
    currency: row.currencyCode,
    unit: "hour",
    sku: target.sku,
    vcpu: target.vcpu,
    memoryGb: target.memoryGb,
    storageGbIncluded: 0,
    hourlyPrice: normalizeHourlyPrice(row.retailPrice),
    source: "azure-live",
    sourceLabel: target.sourceLabel,
    sourceUrl,
    lastUpdatedAt: generatedAt,
    notes: [
      `${target.market === "china" ? "中国区" : "全球区"}实时零售价格`,
      billingModel === "reserved" ? "一年承诺按 1-year savings plan 小时价建模" : "按量零售价格"
    ]
  };
}

function isOneYearTerm(row) {
  return row.reservationTerm === "1 Year" || row.term === "1 Year";
}

async function fetchGlobalVmRows(target) {
  const filters = [
    "serviceName eq 'Virtual Machines'",
    `armRegionName eq '${target.sourceRegion}'`,
    `armSkuName eq '${target.armSkuName}'`
  ];
  const url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filters.join(" and "))}`;
  const data = await fetchJson(url);
  const generatedAt = new Date().toISOString();
  const rows = data.Items || [];

  const linuxRows = rows.filter((row) => {
    const productName = row.productName || "";
    return !productName.includes("Windows") && !productName.includes("Cloud Services");
  });

  const payg = linuxRows.find((row) => row.type === "Consumption");
  const committed = linuxRows.find((row) => row.type === "SavingsPlanConsumption" && isOneYearTerm(row));

  return {
    generatedAt,
    sourceUrl: url,
    offers: [
      payg ? buildAzureOffer(target, payg, "payg", generatedAt, url) : null,
      committed ? buildAzureOffer(target, committed, "reserved", generatedAt, url) : null
    ].filter(Boolean)
  };
}

async function fetchChinaVmRows(target) {
  const metadataUrl = "https://prices.azure.cn/api/retail/pricesheet/download?api-version=2023-06-01-preview";
  const metadata = await fetchJson(metadataUrl);
  const response = await fetch(metadata.DownloadUrl);

  if (!response.ok) {
    throw new Error(`Unable to download Azure China price sheet: ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const matches = rows.filter((row) => {
    const productName = row.productName || "";

    return (
      row.serviceName === "Virtual Machines" &&
      row.armRegionName === target.sourceRegion &&
      row.armSkuName === target.armSkuName &&
      !productName.includes("Windows")
    );
  });

  const payg = matches.find((row) => row.type === "Consumption");
  const committed = matches.find((row) => {
    return row.type === "SavingsPlanConsumption" && isOneYearTerm(row);
  });

  return {
    generatedAt: metadata.LastRefreshedAt || new Date().toISOString(),
    sourceUrl: metadata.DownloadUrl,
    offers: [
      payg ? buildAzureOffer(target, payg, "payg", metadata.LastRefreshedAt, metadata.DownloadUrl) : null,
      committed ? buildAzureOffer(target, committed, "reserved", metadata.LastRefreshedAt, metadata.DownloadUrl) : null
    ].filter(Boolean)
  };
}

async function refreshTarget(target) {
  if (target.market === "china") {
    return fetchChinaVmRows(target);
  }

  return fetchGlobalVmRows(target);
}

async function main() {
  const offers = [];
  const coverage = [];
  const generatedAtValues = [];

  for (const target of marketTargets) {
    const result = await refreshTarget(target);
    offers.push(...result.offers);
    generatedAtValues.push(result.generatedAt);
    coverage.push({
      vendor: target.vendor,
      market: target.market,
      workload: target.workload
    });
  }

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(
    outputFile,
    JSON.stringify(
      {
        generatedAt: generatedAtValues.filter(Boolean).sort().at(-1) || null,
        coverage,
        offers
      },
      null,
      2
    )
  );

  console.log(`Wrote ${offers.length} Azure market offers to ${outputFile}`);
}

await main();
