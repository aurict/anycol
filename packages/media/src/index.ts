export type MediaMetadata = {
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
};
export type MediaRule = {
  mimeTypes: string[];
  maxBytes: number;
  minWidth?: number;
  maxDurationSeconds?: number;
  aspectRatios?: Array<[number, number]>;
};
export function validateMedia(media: MediaMetadata, rule: MediaRule): string[] {
  const errors: string[] = [];
  if (!rule.mimeTypes.includes(media.mimeType))
    errors.push(`Desteklenmeyen dosya türü: ${media.mimeType}`);
  if (media.bytes > rule.maxBytes)
    errors.push("Dosya boyutu platform limitini aşıyor");
  if (rule.minWidth && (media.width ?? 0) < rule.minWidth)
    errors.push("Görsel genişliği minimum değerin altında");
  if (
    rule.maxDurationSeconds &&
    (media.durationSeconds ?? 0) > rule.maxDurationSeconds
  )
    errors.push("Video süresi platform limitini aşıyor");
  return errors;
}
