import { buildSiteManifest } from '../src/data/siteManifest.js';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const forwarded = String(request.headers?.['x-forwarded-host'] || request.headers?.host || '').split(',')[0].trim();
  const protocol = String(request.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (!forwarded) return response.status(400).json({ error: 'Host is required' });

  response.setHeader('Content-Type', 'application/vnd.igroup.site-manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return response.status(200).json(buildSiteManifest({ baseUrl: `${protocol}://${forwarded}` }));
}
