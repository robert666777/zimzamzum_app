function getPublicUrl(path) {
  return `${process.env.PUBLIC_URL}${path}`;
}

/** Favicon URLs for education platforms (Automations / Schedule). */
export const EDUCATION_PLATFORM_ICON_URL = {
  chaoxing: getPublicUrl('/chaoxing.webp'),
  icourse: getPublicUrl('/icourse.webp'),
  xuetangx: getPublicUrl('/xuetangx.webp'),
  zhihuishu: getPublicUrl('/Zhihuishu.webp'),
  yuketang: getPublicUrl('/Yuketang.webp'),
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
