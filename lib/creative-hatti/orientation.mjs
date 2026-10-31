/** Classify a preview image's file orientation without guessing about its subject. */
export function orientationFromDimensions(widthValue, heightValue) {
  const width = Number(widthValue);
  const height = Number(heightValue);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "unknown";
  const ratio = width / height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return "square";
}
