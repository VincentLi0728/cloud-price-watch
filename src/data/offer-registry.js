import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marketDefinitions, seedOffers } from "./catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedFilePath = path.join(__dirname, "generated", "azure-market-offers.json");

function readGeneratedCatalog() {
  try {
    const raw = readFileSync(generatedFilePath, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      generatedAt: parsed.generatedAt || null,
      coverage: Array.isArray(parsed.coverage) ? parsed.coverage : [],
      offers: Array.isArray(parsed.offers) ? parsed.offers : []
    };
  } catch {
    return {
      generatedAt: null,
      coverage: [],
      offers: []
    };
  }
}

function toCoverageKey(item) {
  return [item.vendor, item.market, item.workload].join("::");
}

function mergeOffers() {
  const generated = readGeneratedCatalog();
  const coverageKeys = new Set(generated.coverage.map(toCoverageKey));
  const filteredSeedOffers = seedOffers.filter((offer) => {
    return !coverageKeys.has(toCoverageKey(offer));
  });
  const merged = new Map();

  [...filteredSeedOffers, ...generated.offers].forEach((offer) => {
    merged.set(offer.id, offer);
  });

  return {
    generatedAt: generated.generatedAt,
    offers: [...merged.values()],
    coverage: generated.coverage
  };
}

export function getOfferCatalog() {
  const catalog = mergeOffers();

  return {
    ...catalog,
    marketDefinitions
  };
}
