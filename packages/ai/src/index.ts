import { z } from "zod";

export const Evidence = z.object({
  metric: z.string(),
  current: z.number(),
  previous: z.number(),
  source: z.string(),
  from: z.string().date(),
  to: z.string().date(),
});
export const Insight = z.object({
  title: z.string(),
  explanation: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(Evidence).min(1),
  suggestedAction: z.string(),
});
export type Insight = z.infer<typeof Insight>;

export function deterministicInsights(
  evidence: z.infer<typeof Evidence>[],
): Insight[] {
  return evidence.flatMap((item) => {
    if (item.previous === 0) return [];
    const change = (item.current - item.previous) / Math.abs(item.previous);
    if (Math.abs(change) < 0.15) return [];
    const decreaseIsBad = [
      "conversions",
      "conversion_value",
      "clicks",
      "ctr",
      "roas",
    ].includes(item.metric);
    const bad = decreaseIsBad
      ? change < 0
      : ["cost", "cpc", "cpa"].includes(item.metric) && change > 0;
    return [
      {
        title: `${item.metric} metriğinde belirgin ${change > 0 ? "artış" : "düşüş"}`,
        explanation: `Önceki döneme göre %${Math.abs(change * 100).toFixed(1)} değişim tespit edildi.`,
        severity: bad ? "warning" : "info",
        confidence: 0.95,
        evidence: [item],
        suggestedAction: bad
          ? "Kaynak kampanya ve kırılımları inceleyip göreve dönüştürün."
          : "Değişimi oluşturan segmentleri doğrulayın ve başarılı yaklaşımı ölçeklendirin.",
      } satisfies Insight,
    ];
  });
}

export function buildGroundedPrompt(insight: Insight): string {
  return JSON.stringify({
    instruction:
      "Yalnızca verilen kanıta dayanarak Türkçe yönetici özeti yaz. Yeni sayı üretme.",
    evidence: insight.evidence,
    finding: { title: insight.title, explanation: insight.explanation },
  });
}
