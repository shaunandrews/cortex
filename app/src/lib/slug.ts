/**
 * Derive a WP.com-compatible blog subdomain slug from a free-form title.
 *
 * Rules (match WP.com blog-name conventions):
 * - lowercase
 * - whitespace and underscores → hyphens
 * - strip anything outside [a-z0-9-]
 * - collapse repeated hyphens
 * - trim leading/trailing hyphens
 */
export function deriveSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_MIN_LENGTH = 4;
export const SLUG_MAX_LENGTH = 50;

export type SlugShape = { ok: true } | { ok: false; message: string };

export function validateSlugShape(slug: string): SlugShape {
  if (slug.length === 0) {
    return { ok: false, message: 'Choose an address for your P2.' };
  }
  if (slug.length < SLUG_MIN_LENGTH) {
    return { ok: false, message: `Address must be at least ${SLUG_MIN_LENGTH} characters.` };
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return { ok: false, message: `Address must be under ${SLUG_MAX_LENGTH} characters.` };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { ok: false, message: 'Use only lowercase letters, numbers, and hyphens.' };
  }
  return { ok: true };
}
