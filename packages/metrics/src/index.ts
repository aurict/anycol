export type MetricDefinition = {
  key: string;
  label: string;
  description: string;
  unit: "count" | "percent" | "currency" | "duration" | "position";
  aggregation: "sum" | "weighted" | "last" | "non_additive";
  formula?: string;
};

export const metricRegistry = {
  impressions: {
    key: "impressions",
    label: "Gösterim",
    description: "İçeriğin veya reklamın gösterilme sayısı.",
    unit: "count",
    aggregation: "sum",
  },
  clicks: {
    key: "clicks",
    label: "Tıklama",
    description: "Kaynak platform tarafından raporlanan tıklama sayısı.",
    unit: "count",
    aggregation: "sum",
  },
  cost: {
    key: "cost",
    label: "Harcama",
    description: "Reklam harcaması; kaynak para birimi ayrıca tutulur.",
    unit: "currency",
    aggregation: "sum",
  },
  conversions: {
    key: "conversions",
    label: "Dönüşüm",
    description: "Kaynak platform attribution ayarına göre dönüşüm.",
    unit: "count",
    aggregation: "sum",
  },
  conversion_value: {
    key: "conversion_value",
    label: "Dönüşüm değeri",
    description: "Dönüşümlere atanan toplam değer.",
    unit: "currency",
    aggregation: "sum",
  },
  ctr: {
    key: "ctr",
    label: "CTR",
    description: "Tıklama / gösterim.",
    unit: "percent",
    aggregation: "weighted",
    formula: "clicks / impressions",
  },
  cpc: {
    key: "cpc",
    label: "CPC",
    description: "Harcama / tıklama.",
    unit: "currency",
    aggregation: "weighted",
    formula: "cost / clicks",
  },
  roas: {
    key: "roas",
    label: "ROAS",
    description: "Dönüşüm değeri / harcama.",
    unit: "percent",
    aggregation: "weighted",
    formula: "conversion_value / cost",
  },
  average_position: {
    key: "average_position",
    label: "Ortalama konum",
    description: "Search Console ortalama arama sonucu konumu.",
    unit: "position",
    aggregation: "weighted",
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricKey = keyof typeof metricRegistry;

export function safeRatio(
  numerator: number,
  denominator: number,
): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function deriveMetrics(
  values: Partial<Record<MetricKey, number>>,
): Partial<Record<MetricKey, number>> {
  const result = { ...values };
  const ctr = safeRatio(values.clicks ?? 0, values.impressions ?? 0);
  const cpc = safeRatio(values.cost ?? 0, values.clicks ?? 0);
  const roas = safeRatio(values.conversion_value ?? 0, values.cost ?? 0);
  if (ctr !== null) result.ctr = ctr;
  if (cpc !== null) result.cpc = cpc;
  if (roas !== null) result.roas = roas;
  return result;
}
