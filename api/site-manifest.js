import { buildSiteManifest } from '../src/data/siteManifest.js';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  response.setHeader('Content-Type', 'application/vnd.igroup.site-manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return response.status(200).json(buildSiteManifest());
}
