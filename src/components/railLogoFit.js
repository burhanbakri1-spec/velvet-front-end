// Generated rail wordmarks use one type size and one cap center. The frame
// hugs each name so the visible artwork shares a height instead of sitting
// in leftover padding.
export const RAIL_WORDMARK = Object.freeze({
  viewH: 64,
  nameSize: 40,
  capCenter: 46,
  capRatio: 0.72,
});

export function railWordmarkNameSize() {
  return RAIL_WORDMARK.nameSize;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function railWordmarkSvg({ velvet = 'VELVET', branch, accent, nameWidth = 120, velvetWidth = 72 }) {
  const { viewH, nameSize, capCenter, capRatio } = RAIL_WORDMARK;
  const viewW = Math.max(88, Math.ceil(Math.max(nameWidth, velvetWidth) + 12));
  const baseline = capCenter + (nameSize * capRatio) / 2;
  const fill = `#${String(accent || '').replace('#', '')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}" role="img"><text x="${viewW / 2}" y="18" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="0.12em" text-anchor="middle">${escapeXml(velvet)}</text><text x="${viewW / 2}" y="${baseline.toFixed(2)}" fill="${fill}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="${nameSize}" font-weight="900" text-anchor="middle">${escapeXml(branch)}</text></svg>`;
}

// Fit a logo's visible ink to one shared max box. Transparent padding in the
// file is scaled out so every mark has the same prominence, while the ink
// aspect ratio stays intact and the result stays inside the max box.
export function railLogoFit({ natW, natH, inkX, inkY, inkW, inkH, maxW, maxH }) {
  if (!(natW > 0 && natH > 0 && inkW > 0 && inkH > 0 && maxW > 0 && maxH > 0)) return null;
  const usedScale = Math.min(1, maxW / natW, maxH / natH);
  const fittedW = natW * usedScale;
  const fittedH = natH * usedScale;
  const drawnW = Math.max(1, inkW * usedScale);
  const drawnH = Math.max(1, inkH * usedScale);
  const boost = Math.min(maxW / drawnW, maxH / drawnH, 3.5);
  const cx = (inkX + inkW / 2) / natW;
  const cy = (inkY + inkH / 2) / natH;
  return {
    boost,
    tx: (0.5 - cx) * fittedW,
    ty: (0.5 - cy) * fittedH,
    originX: cx,
    originY: cy,
    visualW: drawnW * boost,
    visualH: drawnH * boost,
  };
}

export function measureLogoInk(img) {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;
  const sample = Math.min(1, 360 / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * sample));
  const h = Math.max(1, Math.round(natH * sample));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] <= 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return {
    natW,
    natH,
    inkX: minX / sample,
    inkY: minY / sample,
    inkW: (maxX - minX + 1) / sample,
    inkH: (maxY - minY + 1) / sample,
  };
}
