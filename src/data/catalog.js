export const workloadDefinitions = [
  {
    id: "general-compute",
    label: "通用计算 General Compute",
    description: "适合 Web 应用、API 和后台任务的 Linux 虚拟机。"
  },
  {
    id: "managed-postgres",
    label: "托管 PostgreSQL Managed PostgreSQL",
    description: "按 vCPU、内存和存储规格进行比较的托管数据库。"
  },
  {
    id: "object-storage",
    label: "对象存储 Object Storage",
    description: "包含请求费用和公网流出的对象存储服务。"
  },
  {
    id: "gpu-inference",
    label: "GPU 推理 GPU Inference",
    description: "面向 AI API 与批处理任务的推理型 GPU 实例。"
  }
];

export const marketDefinitions = [
  {
    id: "global",
    label: "全球 Global",
    description: "由全球公有云市场提供的标准区域与报价。"
  },
  {
    id: "china",
    label: "中国 Mainland China",
    description: "由本地运营方提供的中国区市场，例如 21Vianet、Sinnet、NWCD。"
  }
];

export const regionDefinitions = [
  { id: "eastus", label: "美国东部 East US", markets: ["global"] },
  { id: "westeurope", label: "西欧 West Europe", markets: ["global"] },
  { id: "southeastasia", label: "东南亚 Southeast Asia", markets: ["global"] },
  { id: "china-east", label: "中国东部 China East", markets: ["china"] },
  { id: "china-north", label: "中国北部 China North", markets: ["china"] }
];

export const billingModels = [
  { id: "payg", label: "按量计费 Pay as you go" },
  { id: "reserved", label: "一年承诺 1-year commit" }
];

const defaultOperatorByVendor = {
  AWS: "Amazon Web Services",
  Azure: "Microsoft",
  GCP: "Google Cloud",
  "Alibaba Cloud": "Alibaba Cloud"
};

const seedSource = {
  source: "seed",
  sourceLabel: "种子数据 Seed dataset",
  sourceUrl: null,
  lastUpdatedAt: null
};

const baseOffers = [
  {
    id: "aws-eastus-gc-2x8-payg",
    vendor: "AWS",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "m7g.large",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.077,
    notes: ["ARM instance profile", "Storage charged separately", "Linux only"]
  },
  {
    id: "aws-eastus-gc-2x8-reserved",
    vendor: "AWS",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "reserved",
    currency: "USD",
    unit: "hour",
    sku: "m7g.large",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.054,
    notes: ["ARM instance profile", "1-year reservation equivalent"]
  },
  {
    id: "azure-eastus-gc-2x8-payg",
    vendor: "Azure",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "B2ms",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.083,
    notes: ["Burstable compute", "Premium SSD not included"]
  },
  {
    id: "azure-eastus-gc-2x8-reserved",
    vendor: "Azure",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "reserved",
    currency: "USD",
    unit: "hour",
    sku: "B2ms",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.058,
    notes: ["1-year reservation equivalent", "Burstable family"]
  },
  {
    id: "gcp-eastus-gc-2x8-payg",
    vendor: "GCP",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "e2-standard-2",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.067,
    notes: ["Balanced VM family", "Persistent disk charged separately"]
  },
  {
    id: "gcp-eastus-gc-2x8-reserved",
    vendor: "GCP",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "eastus",
    billingModel: "reserved",
    currency: "USD",
    unit: "hour",
    sku: "e2-standard-2",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.049,
    notes: ["1-year commitment equivalent"]
  },
  {
    id: "aliyun-southeastasia-gc-2x8-payg",
    vendor: "Alibaba Cloud",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "southeastasia",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "ecs.g7.large",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.071,
    notes: ["ESSD charged separately"]
  },
  {
    id: "aliyun-southeastasia-gc-2x8-reserved",
    vendor: "Alibaba Cloud",
    serviceFamily: "vm",
    workload: "general-compute",
    region: "southeastasia",
    billingModel: "reserved",
    currency: "USD",
    unit: "hour",
    sku: "ecs.g7.large",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 0,
    hourlyPrice: 0.051,
    notes: ["1-year subscription equivalent"]
  },
  {
    id: "aws-westeurope-db-2x8-payg",
    vendor: "AWS",
    serviceFamily: "database",
    workload: "managed-postgres",
    region: "westeurope",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "db.t4g.large",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 100,
    storagePricePerGbMonth: 0.115,
    engine: "PostgreSQL",
    hourlyPrice: 0.161,
    notes: ["Single AZ", "Backup beyond retention charged separately"]
  },
  {
    id: "azure-westeurope-db-2x8-payg",
    vendor: "Azure",
    serviceFamily: "database",
    workload: "managed-postgres",
    region: "westeurope",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "Flexible Server D2s v5",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 128,
    storagePricePerGbMonth: 0.12,
    engine: "PostgreSQL",
    hourlyPrice: 0.173,
    notes: ["Burstable disabled", "HA not included"]
  },
  {
    id: "gcp-westeurope-db-2x8-payg",
    vendor: "GCP",
    serviceFamily: "database",
    workload: "managed-postgres",
    region: "westeurope",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "Cloud SQL Custom 2 vCPU",
    vcpu: 2,
    memoryGb: 8,
    storageGbIncluded: 100,
    storagePricePerGbMonth: 0.17,
    engine: "PostgreSQL",
    hourlyPrice: 0.189,
    notes: ["Single zone", "HA charged separately"]
  },
  {
    id: "azure-eastus-storage-payg",
    vendor: "Azure",
    serviceFamily: "storage",
    workload: "object-storage",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "month",
    sku: "Hot LRS",
    storagePricePerGbMonth: 0.018,
    requestPricePer10k: 0.05,
    transferPricePerGb: 0.087,
    notes: ["Read-heavy tier", "Geo-redundancy not included"]
  },
  {
    id: "aws-eastus-storage-payg",
    vendor: "AWS",
    serviceFamily: "storage",
    workload: "object-storage",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "month",
    sku: "S3 Standard",
    storagePricePerGbMonth: 0.023,
    requestPricePer10k: 0.05,
    transferPricePerGb: 0.09,
    notes: ["First 50 TB tier modeled"]
  },
  {
    id: "gcp-eastus-storage-payg",
    vendor: "GCP",
    serviceFamily: "storage",
    workload: "object-storage",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "month",
    sku: "Standard Storage",
    storagePricePerGbMonth: 0.02,
    requestPricePer10k: 0.05,
    transferPricePerGb: 0.12,
    notes: ["Regional storage profile"]
  },
  {
    id: "aliyun-southeastasia-storage-payg",
    vendor: "Alibaba Cloud",
    serviceFamily: "storage",
    workload: "object-storage",
    region: "southeastasia",
    billingModel: "payg",
    currency: "USD",
    unit: "month",
    sku: "OSS Standard",
    storagePricePerGbMonth: 0.021,
    requestPricePer10k: 0.016,
    transferPricePerGb: 0.12,
    notes: ["Singapore public egress profile"]
  },
  {
    id: "azure-eastus-gpu-payg",
    vendor: "Azure",
    serviceFamily: "gpu",
    workload: "gpu-inference",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "NC4as T4 v3",
    vcpu: 4,
    memoryGb: 28,
    gpuCount: 1,
    gpuModel: "NVIDIA T4",
    hourlyPrice: 0.526,
    notes: ["Inference-friendly T4 profile"]
  },
  {
    id: "aws-eastus-gpu-payg",
    vendor: "AWS",
    serviceFamily: "gpu",
    workload: "gpu-inference",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "g4dn.xlarge",
    vcpu: 4,
    memoryGb: 16,
    gpuCount: 1,
    gpuModel: "NVIDIA T4",
    hourlyPrice: 0.526,
    notes: ["Includes NVMe local SSD"]
  },
  {
    id: "gcp-eastus-gpu-payg",
    vendor: "GCP",
    serviceFamily: "gpu",
    workload: "gpu-inference",
    region: "eastus",
    billingModel: "payg",
    currency: "USD",
    unit: "hour",
    sku: "n1-standard-4 + T4",
    vcpu: 4,
    memoryGb: 15,
    gpuCount: 1,
    gpuModel: "NVIDIA T4",
    hourlyPrice: 0.513,
    notes: ["Compute and GPU combined estimate"]
  }
];

function annotateSeedOffer(offer) {
  return {
    market: "global",
    operator: defaultOperatorByVendor[offer.vendor] || offer.vendor,
    ...seedSource,
    ...offer
  };
}

export const seedOffers = baseOffers.map(annotateSeedOffer);
