const ALLOWED_DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const ALLOWED_LOCAL_ASSET_RE = /^\/src\/assets\/images\/[A-Za-z0-9_.-]+\.(jpg|jpeg|png|webp)$/i;

/**
 * Sanitizes untrusted text input by stripping HTML tags, dangerous URI schemes,
 * and control characters while preserving normal Thai/English prose and newlines.
 */
export function sanitizeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\b(?:javascript|vbscript|data:text\/html)\s*:/gi, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * Sanitizes inline single-line fields (titles, tags, categories).
 */
export function sanitizeSingleLine(input: unknown, maxLength = 160): string {
  return sanitizeText(input, maxLength).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Validates that an image URL/preview is strictly a safe local asset path or
 * base64 raster image data URL (blocking SVG/HTML/javascript schemes).
 */
export function sanitizeImageSrc(src: unknown): string | undefined {
  if (typeof src !== 'string') return undefined;
  const trimmed = src.trim();
  if (ALLOWED_LOCAL_ASSET_RE.test(trimmed)) return trimmed;
  if (ALLOWED_DATA_IMAGE_RE.test(trimmed)) return trimmed;
  return undefined;
}
