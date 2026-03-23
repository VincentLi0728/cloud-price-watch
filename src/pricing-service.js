import {
  billingModels,
  offers,
  regionDefinitions,
  workloadDefinitions
} from "./data/catalog.js";

const HOURS_PER_MONTH = 730;
const regionLabel = new Map(regionDefinitions.map((region) => [region.id, region.label]));

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function getMonthlyInfraCost(offer, requirements) {
  if (offer.workload === "general-compute") {
    const compute = offer.hourlyPrice * HOURS_PER_MONTH;
    const extraStorage = Math.max((requirements.storageGb || 0) - (offer.storageGbIncluded || 0), 0);
    const storage = extraStorage * (requirements.storagePricePerGbMonth || 0.12);

    return {
      monthly: roundMoney(compute + storage),
      breakdown: {
        compute: roundMoney(compute),
        storage: roundMoney(storage)
      }
    };
  }

  if (offer.workload === "managed-postgres") {
    const compute = offer.hourlyPrice * HOURS_PER_MONTH;
    const extraStorage = Math.max((requirements.storageGb || 0) - (offer.storageGbIncluded || 0), 0);
    const storage = extraStorage * (offer.storagePricePerGbMonth || 0);

    return {
      monthly: roundMoney(compute + storage),
      breakdown: {
        compute: roundMoney(compute),
        storage: roundMoney(storage)
      }
    };
  }

  if (offer.workload === "object-storage") {
    const storage = (requirements.storageGb || 0) * (offer.storagePricePerGbMonth || 0);
    const requests = (requirements.requestCount10k || 0) * (offer.requestPricePer10k || 0);
    const transfer = (requirements.transferGb || 0) * (offer.transferPricePerGb || 0);

    return {
      monthly: roundMoney(storage + requests + transfer),
      breakdown: {
        storage: roundMoney(storage),
        requests: roundMoney(requests),
        transfer: roundMoney(transfer)
      }
    };
  }

  if (offer.workload === "gpu-inference") {
    const compute = offer.hourlyPrice * HOURS_PER_MONTH;

    return {
      monthly: roundMoney(compute),
      breakdown: {
        compute: roundMoney(compute)
      }
    };
  }

  return { monthly: 0, breakdown: {} };
}

function scoreFit(offer, requirements) {
  let score = 0;

  if (requirements.vcpu) {
    score += Math.max((offer.vcpu || 0) - requirements.vcpu, 0) * 8;
  }

  if (requirements.memoryGb) {
    score += Math.max((offer.memoryGb || 0) - requirements.memoryGb, 0) * 3;
  }

  if (requirements.gpuCount) {
    score += Math.max((offer.gpuCount || 0) - requirements.gpuCount, 0) * 20;
  }

  return score;
}

function matchesRequirements(offer, requirements) {
  if (requirements.vcpu && (offer.vcpu || 0) < requirements.vcpu) {
    return false;
  }

  if (requirements.memoryGb && (offer.memoryGb || 0) < requirements.memoryGb) {
    return false;
  }

  if (requirements.gpuCount && (offer.gpuCount || 0) < requirements.gpuCount) {
    return false;
  }

  return true;
}

function buildHighlights(offer, cost, requirements) {
  const highlights = [];

  if (offer.workload === "general-compute") {
    highlights.push(`${offer.vcpu} vCPU / ${offer.memoryGb} GB RAM`);
    if (requirements.storageGb) {
      highlights.push(`${requirements.storageGb} GB disk modeled separately`);
    }
  }

  if (offer.workload === "managed-postgres") {
    highlights.push(`${offer.engine} managed service`);
    highlights.push(`${offer.storageGbIncluded || 0} GB included storage`);
  }

  if (offer.workload === "object-storage") {
    highlights.push(`${requirements.storageGb || 0} GB stored`);
    highlights.push(`${requirements.transferGb || 0} GB egress`);
  }

  if (offer.workload === "gpu-inference") {
    highlights.push(`${offer.gpuCount}x ${offer.gpuModel}`);
    highlights.push(`${offer.vcpu} vCPU / ${offer.memoryGb} GB RAM`);
  }

  highlights.push(`Estimated monthly: $${cost.monthly}`);
  return highlights;
}

export function getMetadata() {
  return {
    workloads: workloadDefinitions,
    regions: regionDefinitions,
    billingModels,
    vendorCount: [...new Set(offers.map((offer) => offer.vendor))].length,
    offerCount: offers.length
  };
}

export function compareOffers(input) {
  const workload = input.workload || "general-compute";
  const region = input.region || "eastus";
  const billingModel = input.billingModel || "payg";
  const requirements = input.requirements || {};

  let scopedOffers = offers.filter((offer) => {
    return (
      offer.workload === workload &&
      offer.region === region &&
      offer.billingModel === billingModel &&
      matchesRequirements(offer, requirements)
    );
  });

  if (!scopedOffers.length && workload === "object-storage") {
    scopedOffers = offers.filter((offer) => {
      return (
        offer.workload === workload &&
        offer.region === region &&
        matchesRequirements(offer, requirements)
      );
    });
  }

  const ranked = scopedOffers
    .map((offer) => {
      const cost = getMonthlyInfraCost(offer, requirements);

      return {
        ...offer,
        regionLabel: regionLabel.get(offer.region) || offer.region,
        fitScore: scoreFit(offer, requirements),
        estimatedMonthly: cost.monthly,
        breakdown: cost.breakdown,
        highlights: buildHighlights(offer, cost, requirements)
      };
    })
    .sort((left, right) => {
      if (left.estimatedMonthly !== right.estimatedMonthly) {
        return left.estimatedMonthly - right.estimatedMonthly;
      }

      return left.fitScore - right.fitScore;
    });

  return {
    query: { workload, region, billingModel, requirements },
    cheapestVendor: ranked[0]?.vendor || null,
    results: ranked,
    assumptions: [
      "Monthly estimates use 730 hours.",
      "Taxes, support plans, backup overages, and enterprise discounts are not included.",
      "Object storage comparisons fall back to pay-as-you-go when a reserved model is unavailable.",
      "Cross-region networking and premium licenses must be modeled separately."
    ]
  };
}
