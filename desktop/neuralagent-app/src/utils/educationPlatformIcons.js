/** Favicon URLs for education platforms (Automations / Schedule). */
export const EDUCATION_PLATFORM_ICON_URL = {
  chaoxing: '/chaoxing.webp',
  icourse: '/icourse.webp',
  xuetangx: '/xuetangx.webp',
  zhihuishu: '/zhihuishu.webp',
  yuketang: '/yuketang.webp',
};

/** Extra URLs tried when the primary favicon fails to load (Electron/CSP/network). */
export const PLATFORM_LOGO_FALLBACK_URLS = {
  chaoxing: [],
  icourse: [],
  xuetangx: [],
  zhihuishu: [],
  yuketang: [],
};

export function resolvePlatformLogoUrl(platformId, logoField) {
  if (typeof logoField === 'string' && /^https?:\/\//i.test(logoField)) {
    return logoField;
  }
  return EDUCATION_PLATFORM_ICON_URL[platformId] || null;
}
