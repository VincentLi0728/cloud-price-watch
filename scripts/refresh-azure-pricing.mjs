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
    id: "azure-global-postgres-d2dsv5-westeurope",
    vendor: "Azure",
    operator: "Microsoft",
    market: "global",
    workload: "managed-postgres",
    region: "westeurope",
    sourceRegion: "westeurope",
    sku: "Flexible Server D2ds v5",
    armSkuName: "Standard_D2ds_v5",
    computeProductName: "Azure Database for PostgreSQL Flexible Server General Purpose - Ddsv5 Series Compute",
    computeGenericArmSkuName: "AzureDB_PostgreSQL_Flexible_Server_General_Purpose_Ddsv5Series_Compute_vCore",
    storageProductName: "Az DB for PostgreSQL Flexible Server Storage",
    storageSkuName: "Storage",
    vcpu: 2,
    memoryGb: 8,
    engine: "PostgreSQL",
    serviceFamily: "database",
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
  },
  {
    id: "azure-china-postgres-d2dsv5-china-east",
    vendor: "Azure",
    operator: "21Vianet",
    market: "china",
    workload: "managed-postgres",
    region: "china-east",
    sourceRegion: "chinaeast2",
    sku: "Flexible Server D2ds v5",
    armSkuName: "Standard_D2ds_v5",
    computeProductName: "Azure Database for PostgreSQL Flexible Server General Purpose - Ddsv5 Series Compute",
    computeGenericArmSkuName: "AzureDB_PostgreSQL_Flexible_Server_General_Purpose_Ddsv5Series_Compute_vCore",
    storageProductName: "Az DB for PostgreSQL Flexible Server Storage",
    storageSkuName: "Storage",
    vcpu: 2,
    memoryGb: 8,
    engine: "PostgreSQL",
    serviceFamily: "database",
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

function normalizeMonthlyPrice(value) {
  return normalizeHourlyPrice(value);
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

function buildAzurePostgresOffer({
  target,
  billingModel,
  generatedAt,
  sourceUrl,
  currency,
  hourlyPrice,
  storagePricePerGbMonth,
  notes
}) {
  return {
    id: `${target.vendor.toLowerCase()}-${target.market}-${target.region}-postgres-${billingModel}`,
    vendor: target.vendor,
    operator: target.operator,
    market: target.market,
    serviceFamily: target.serviceFamily,
    workload: target.workload,
    region: target.region,
    billingModel,
    currency,
    unit: "hour",
    sku: target.sku,
    vcpu: target.vcpu,
    memoryGb: target.memoryGb,
    storageGbIncluded: 0,
    storagePricePerGbMonth,
    engine: target.engine,
    hourlyPrice,
    source: "azure-live",
    sourceLabel: target.sourceLabel,
    sourceUrl,
    lastUpdatedAt: generatedAt,
    notes
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

function pickStorageRow(rows, target) {
  return rows.find((row) => {
    return (
      row.productName === target.storageProductName &&
      row.skuName === target.storageSkuName &&
      row.type === "Consumption"
    );
  });
}

function annualReservationToHourly(totalPerVcoreYear, vcpu) {
  return normalizeHourlyPrice((Number(totalPerVcoreYear) * vcpu) / (24 * 365));
}

async function fetchGlobalPostgresRows(target) {
  const filters = [
    "serviceName eq 'Azure Database for PostgreSQL'",
    `armRegionName eq '${target.sourceRegion}'`
  ];
  const url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filters.join(" and "))}`;
  const data = await fetchJson(url);
  const generatedAt = new Date().toISOString();
  const rows = data.Items || [];
  const computeRows = rows.filter((row) => row.productName === target.computeProductName);
  const storageRow = pickStorageRow(rows, target);
  const payg = computeRows.find((row) => row.armSkuName === target.armSkuName && row.type === "Consumption");
  const reservation = computeRows.find((row) => {
    return (
      row.armSkuName === target.computeGenericArmSkuName &&
      row.type === "Reservation" &&
      row.reservationTerm === "1 Year"
    );
  });

  if (!payg || !storageRow) {
    return {
      generatedAt,
      sourceUrl: url,
      offers: []
    };
  }

  const offers = [
    buildAzurePostgresOffer({
      target,
      billingModel: "payg",
      generatedAt,
      sourceUrl: url,
      currency: payg.currencyCode,
      hourlyPrice: normalizeHourlyPrice(payg.retailPrice),
      storagePricePerGbMonth: normalizeMonthlyPrice(storageRow.retailPrice),
      notes: [
        "全球区实时 PostgreSQL 零售价格",
        "按量零售价格",
        "存储按官方 Flexible Server Storage 单独计费"
      ]
    })
  ];

  if (reservation) {
    offers.push(
      buildAzurePostgresOffer({
        target,
        billingModel: "reserved",
        generatedAt,
        sourceUrl: url,
        currency: reservation.currencyCode,
        hourlyPrice: annualReservationToHourly(reservation.retailPrice, target.vcpu),
        storagePricePerGbMonth: normalizeMonthlyPrice(storageRow.retailPrice),
        notes: [
          "全球区实时 PostgreSQL 零售价格",
          "一年承诺按官方 Reservation vCore 年价折算为小时价",
          "存储按官方 Flexible Server Storage 单独计费"
        ]
      })
    );
  }

  return {
    generatedAt,
    sourceUrl: url,
    offers
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

async function fetchChinaPostgresRows(target) {
  const metadataUrl = "https://prices.azure.cn/api/retail/pricesheet/download?api-version=2023-06-01-preview";
  const metadata = await fetchJson(metadataUrl);
  const response = await fetch(metadata.DownloadUrl);

  if (!response.ok) {
    throw new Error(`Unable to download Azure China price sheet: ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const scopedRows = rows.filter((row) => {
    return row.serviceName === "Azure Database for PostgreSQL" && row.armRegionName === target.sourceRegion;
  });
  const computeRows = scopedRows.filter((row) => row.productName === target.computeProductName);
  const storageRow = pickStorageRow(scopedRows, target);
  const payg = computeRows.find((row) => row.armSkuName === target.armSkuName && row.type === "Consumption");
  const committed = computeRows.find((row) => row.armSkuName === target.armSkuName && row.type === "SavingsPlanConsumption" && isOneYearTerm(row));

  if (!payg || !storageRow) {
    return {
      generatedAt: metadata.LastRefreshedAt || new Date().toISOString(),
      sourceUrl: metadata.DownloadUrl,
      offers: []
    };
  }

  const offers = [
    buildAzurePostgresOffer({
      target,
      billingModel: "payg",
      generatedAt: metadata.LastRefreshedAt,
      sourceUrl: metadata.DownloadUrl,
      currency: payg.currencyCode,
      hourlyPrice: normalizeHourlyPrice(payg.retailPrice),
      storagePricePerGbMonth: normalizeMonthlyPrice(storageRow.retailPrice),
      notes: [
        "中国区实时 PostgreSQL 零售价格",
        "按量零售价格",
        "存储按官方 Flexible Server Storage 单独计费"
      ]
    })
  ];

  if (committed) {
    offers.push(
      buildAzurePostgresOffer({
        target,
        billingModel: "reserved",
        generatedAt: metadata.LastRefreshedAt,
        sourceUrl: metadata.DownloadUrl,
        currency: committed.currencyCode,
        hourlyPrice: normalizeHourlyPrice(committed.retailPrice),
        storagePricePerGbMonth: normalizeMonthlyPrice(storageRow.retailPrice),
        notes: [
          "中国区实时 PostgreSQL 零售价格",
          "一年承诺按官方 1-year savings plan 小时价建模",
          "存储按官方 Flexible Server Storage 单独计费"
        ]
      })
    );
  }

  return {
    generatedAt: metadata.LastRefreshedAt || new Date().toISOString(),
    sourceUrl: metadata.DownloadUrl,
    offers
  };
}

async function refreshTarget(target) {
  if (target.workload === "managed-postgres" && target.market === "china") {
    return fetchChinaPostgresRows(target);
  }

  if (target.workload === "managed-postgres") {
    return fetchGlobalPostgresRows(target);
  }

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
    result.offers.forEach((offer) => {
      coverage.push({
        vendor: offer.vendor,
        market: offer.market,
        workload: offer.workload,
        billingModel: offer.billingModel
      });
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
