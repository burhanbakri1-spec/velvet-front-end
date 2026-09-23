import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { buildProductUrl, buildQrImageUrl } from '../data/productShare';

export default function ProductShareControls({ slug }) {
  const { copy, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const productUrl = useMemo(() => buildProductUrl(slug, locale), [slug, locale]);
  const qrSrc = useMemo(() => buildQrImageUrl(productUrl), [productUrl]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    if (!productUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(productUrl);
      } else {
        const input = document.createElement('input');
        input.value = productUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!slug || !productUrl) return null;

  return (
    <div className="product-share" data-product-share>
      <button
        type="button"
        className={`product-share__copy${copied ? ' is-copied' : ''}`}
        onClick={copyLink}
      >
        {copied ? copy.detail.copyLinkDone : copy.detail.copyLink}
      </button>
      <figure className="product-share__qr">
        <img src={qrSrc} alt={copy.detail.qrLabel} width="148" height="148" loading="lazy" />
        <figcaption>{copy.detail.qrLabel}</figcaption>
      </figure>
    </div>
  );
}
