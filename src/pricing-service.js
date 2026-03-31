import {
  billingModels,
  marketDefinitions,
  regionDefinitions,
  workloadDefinitions
} from "./data/catalog.js";
import { getOfferCatalog } from "./data/offer-registry.js";

const HOURS_PER_MONTH = 730;
const marketLabel = new Map(marketDefinitions.map((market) => [market.id, market.label]));
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

function normalizeRequirements(workload, requirements) {
  const normalized = {
    vcpu: 0,
    memoryGb: 0,
    storageGb: 0,
    requestCount10k: 0,
    transferGb: 0,
    gpuCount: 0
  };

  if (workload === "general-compute" || workload === "managed-postgres") {
    normalized.vcpu = Number(requirements.vcpu || 0);
    normalized.memoryGb = Number(requirements.memoryGb || 0);
    normalized.storageGb = Number(requirements.storageGb || 0);
    return normalized;
  }

  if (workload === "object-storage") {
    normalized.storageGb = Number(requirements.storageGb || 0);
    normalized.requestCount10k = Number(requirements.requestCount10k || 0);
    normalized.transferGb = Number(requirements.transferGb || 0);
    return normalized;
  }

  if (workload === "gpu-inference") {
    normalized.vcpu = Number(requirements.vcpu || 0);
    normalized.memoryGb = Number(requirements.memoryGb || 0);
    normalized.gpuCount = Number(requirements.gpuCount || 0);
    return normalized;
  }

  return normalized;
}

function buildHighlights(offer, cost, requirements) {
  const highlights = [];

  if (offer.workload === "general-compute") {
    highlights.push(`${offer.vcpu} vCPU / ${offer.memoryGb} GB RAM`);
    if (requirements.storageGb) {
      highlights.push(`${requirements.storageGb} GB 磁盘按独立存储估算`);
    }
  }

  if (offer.workload === "managed-postgres") {
    highlights.push(`${offer.engine} 托管服务`);
    highlights.push(`包含 ${offer.storageGbIncluded || 0} GB 存储`);
  }

  if (offer.workload === "object-storage") {
    highlights.push(`存储量 ${requirements.storageGb || 0} GB`);
    highlights.push(`公网流出 ${requirements.transferGb || 0} GB`);
  }

  if (offer.workload === "gpu-inference") {
    highlights.push(`${offer.gpuCount}x ${offer.gpuModel}`);
    highlights.push(`${offer.vcpu} vCPU / ${offer.memoryGb} GB RAM`);
  }

  highlights.push(`预估月成本：${offer.currency} ${cost.monthly}`);
  return highlights;
}

function getDefaultRegionForMarket(market) {
  return regionDefinitions.find((region) => region.markets.includes(market))?.id || "eastus";
}

function buildAssumptions({ market, workload, offers }) {
  const assumptions = [
    "月成本统一按 730 小时估算。",
    "税费、支持计划、备份超额费用和企业折扣未计入。",
    "对象存储在缺少一年承诺价格时会回退到按量价格。",
    "跨区域网络费用和高级许可需要单独建模。"
  ];

  if (market === "china") {
    assumptions.push("中国区市场与全球市场分开建模，如需跨币种直接比较，需要额外处理汇率。");
  }

  if (market === "china" && workload !== "general-compute") {
    assumptions.push("中国区市场当前是第一阶段覆盖，优先接入 Azure 计算，后续会补更多服务和 AWS 中国区运营方数据。");
  }

  if (!offers.some((offer) => offer.source !== "seed")) {
    assumptions.push("当前部分报价仍来自种子数据，实时市场连接器正在逐步扩展。");
  }

  if (workload === "managed-postgres") {
    assumptions.push("Azure PostgreSQL live 数据将计算价格与存储价格分开建模，默认不包含额外 IOPS、吞吐和备份超额。");
  }

  return assumptions;
}

export function getMetadata() {
  const { offers, generatedAt, coverage } = getOfferCatalog();

  return {
    workloads: workloadDefinitions,
    regions: regionDefinitions,
    markets: marketDefinitions,
    billingModels,
    vendorCount: [...new Set(offers.map((offer) => offer.vendor))].length,
    offerCount: offers.length,
    generatedAt,
    coverage
  };
}

export function compareOffers(input) {
  const { offers } = getOfferCatalog();
  const workload = input.workload || "general-compute";
  const market = input.market || "global";
  const region = input.region || getDefaultRegionForMarket(market);
  const billingModel = input.billingModel || "payg";
  const requirements = normalizeRequirements(workload, input.requirements || {});

  let scopedOffers = offers.filter((offer) => {
    return (
      offer.workload === workload &&
      offer.market === market &&
      offer.region === region &&
      offer.billingModel === billingModel &&
      matchesRequirements(offer, requirements)
    );
  });

  if (!scopedOffers.length && workload === "object-storage") {
    scopedOffers = offers.filter((offer) => {
      return (
        offer.workload === workload &&
        offer.market === market &&
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
        marketLabel: marketLabel.get(offer.market) || offer.market,
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
    query: { workload, market, region, billingModel, requirements },
    cheapestVendor: ranked[0]?.vendor || null,
    results: ranked,
    assumptions: buildAssumptions({ market, workload, offers: ranked })
  };
}
