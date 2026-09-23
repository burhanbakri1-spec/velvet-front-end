import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProductDescription } from '../data/products';
import { useI18n } from '../i18n/I18nContext';

function PolicyList({ points = [] }) {
  if (!points.length) return null;
  return (
    <ul className="product-detail-carousel__policy">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

/**
 * Centered PDP info card carousel: active card in the middle with peek of neighbors.
 * Order: Details & Specs → Product Details → Delivery → Exchange → Cancellation.
 * Supports swipe/drag and click-to-center on peek cards.
 */
export default function ProductDetailInfoCarousel({ product, specs = [], eyebrow = '' }) {
  const { copy, locale } = useI18n();
  const isRtl = locale === 'ar';
  const trackRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, delta: 0, moved: false });
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [cardSpan, setCardSpan] = useState(58);

  const cards = useMemo(() => {
    const description = getProductDescription(product, locale);
    return [
      {
        id: 'specs',
        title: copy.detail.specs,
        body: specs.length ? (
          <dl className="product-detail-carousel__specs">
            {specs.map((row) => (
              <div key={`${row.label}-${row.value}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{description}</p>
        ),
      },
      {
        id: 'product-details',
        title: copy.detail.productDetails || copy.detail.about,
        body: <p className="product-detail-carousel__description">{description}</p>,
      },
      {
        id: 'delivery',
        title: copy.detail.deliveryTitle,
        body: <PolicyList points={copy.detail.deliveryPoints || []} />,
      },
      {
        id: 'exchange',
        title: copy.detail.exchangeTitle,
        body: <PolicyList points={copy.detail.exchangePoints || []} />,
      },
      {
        id: 'cancellation',
        title: copy.detail.cancellationTitle,
        body: <PolicyList points={copy.detail.cancellationPoints || []} />,
      },
    ];
  }, [copy.detail, locale, product, specs]);

  const goTo = useCallback((next) => {
    const len = cards.length;
    const wrapped = ((next % len) + len) % len;
    setIndex(wrapped);
    setDragOffset(0);
  }, [cards.length]);

  useEffect(() => {
    setIndex(0);
    setDragOffset(0);
  }, [product?.slug]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => setCardSpan(media.matches ? 72 : 58);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { active: true, startX: event.clientX, delta: 0, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!drag.current.active) return;
    const delta = event.clientX - drag.current.startX;
    drag.current.delta = delta;
    if (Math.abs(delta) > 6) drag.current.moved = true;
    setDragOffset(delta);
  };

  const onPointerUp = () => {
    if (!drag.current.active) return;
    const threshold = 56;
    const delta = drag.current.delta;
    const moved = drag.current.moved;
    drag.current.active = false;
    const forward = isRtl ? delta > threshold : delta < -threshold;
    const backward = isRtl ? delta < -threshold : delta > threshold;
    if (moved && forward) goTo(index + 1);
    else if (moved && backward) goTo(index - 1);
    else setDragOffset(0);
  };

  const onCardActivate = (cardIndex) => {
    if (cardIndex === index) return;
    if (drag.current.moved || Math.abs(drag.current.delta) >= 8) return;
    goTo(cardIndex);
  };

  const sidePeek = (100 - cardSpan) / 2;
  const dragPercent = dragOffset ? (dragOffset / (trackRef.current?.clientWidth || 1)) * 100 : 0;
  const base = sidePeek - index * cardSpan;
  const translate = isRtl
    ? `translateX(calc(${-base}% + ${dragPercent}%))`
    : `translateX(calc(${base}% + ${dragPercent}%))`;

  return (
    <section
      className="product-detail-carousel"
      aria-roledescription="carousel"
      aria-label={copy.detail.specs}
      data-product-section="info-carousel"
    >
      <div className="product-detail-carousel__viewport" ref={trackRef}>
        <div
          className="product-detail-carousel__track"
          style={{ transform: translate }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {cards.map((card, cardIndex) => {
            const isActive = cardIndex === index;
            return (
              <article
                key={card.id}
                className={`product-detail-carousel__card${isActive ? ' is-active' : ''}`}
                aria-hidden={!isActive}
                role="group"
                aria-roledescription="slide"
                aria-label={card.title}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onCardActivate(cardIndex)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onCardActivate(cardIndex);
                  }
                }}
              >
                <div className="product-detail-section-head">
                  {eyebrow ? <span className="store-eyebrow">{eyebrow}</span> : null}
                  <h2>{card.title}</h2>
                </div>
                <div className="product-detail-carousel__body">{card.body}</div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="product-detail-carousel__dots" role="tablist" aria-label={copy.detail.specs}>
        {cards.map((card, cardIndex) => (
          <button
            key={card.id}
            type="button"
            role="tab"
            className={`product-detail-carousel__dot${cardIndex === index ? ' is-active' : ''}`}
            aria-selected={cardIndex === index}
            aria-label={card.title}
            onClick={() => goTo(cardIndex)}
          />
        ))}
      </div>
    </section>
  );
}
