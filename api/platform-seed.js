import { buildPlatformSeed } from '../src/data/platformSeed.js';

export default function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed.' });
  const forwarded = String(request.headers?.['x-forwarded-host'] || request.headers?.host || '').split(',')[0].trim();
  const protocol = String(request.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (!forwarded) return response.status(400).json({ message: 'Host is required.' });
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json(buildPlatformSeed(`${protocol}://${forwarded}`));
}
