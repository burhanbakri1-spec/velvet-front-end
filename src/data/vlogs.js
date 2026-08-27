// Mutable collections filled by platform/CPanel content when available.
// Keep empty by default — VlogsPage renders a localized empty state.
export const vlogVideos = [];
export const vlogPosts = [];

export const getVlogTitle = (item, locale) => (locale === 'ar' ? (item.titleAr || item.title) : item.title) || '';
export const getVlogBody = (item, locale) => (locale === 'ar' ? (item.bodyAr || item.body) : item.body) || '';
export const getVlogCategory = (item, locale) => (locale === 'ar' ? (item.categoryAr || item.category) : item.category) || '';

export function applyVlogContent({ videos = [], posts = [] } = {}) {
  vlogVideos.splice(0, vlogVideos.length, ...(Array.isArray(videos) ? videos : []));
  vlogPosts.splice(0, vlogPosts.length, ...(Array.isArray(posts) ? posts : []));
}
