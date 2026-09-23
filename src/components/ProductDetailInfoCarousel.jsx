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
 * Centered PDP info card carousel.
 * Click side cards OR swipe to change active index. Dots also navigate.
 *
 * Click root-cause fix: setPointerCapture on the track diverted click events
 * away from cards, so onClick never flipped state. Activation is now decided
 * in pointerup from the card index captured on pointerdown.
 */
export default function ProductDetailInfoCarousel({ product, specs = [], eyebrow = '' }) {
  const { copy, locale } = useI18n();
  const isRtl = locale === 'ar';
  const trackRef = useRef(null);
  const drag = useRef({
    active: false,
    startX: 0,
    delta: 0,
    moved: false,
    cardIndex: null,
  });
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
    if (!len) return;
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

  const resolveCardIndex = (target) => {
    const node = target?.closest?.('[data-carousel-index]');
    if (!node) return null;
    const value = Number(node.getAttribute('data-carousel-index'));
    return Number.isFinite(value) ? value : null;
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      delta: 0,
      moved: false,
      cardIndex: resolveCardIndex(event.target),
      pointerId: event.pointerId,
    };
    // Do NOT capture yet — early capture steals click from peek cards.
    // Capture only after the gesture becomes a drag (see onPointerMove).
  };

  const onPointerMove = (event) => {
    if (!drag.current.active) return;
    const delta = event.clientX - drag.current.startX;
    drag.current.delta = delta;
    if (Math.abs(delta) > 8) {
      if (!drag.current.moved) {
        drag.current.moved = true;
        try {
          event.currentTarget.setPointerCapture?.(drag.current.pointerId ?? event.pointerId);
        } catch {
          /* Synthetic / non-primary pointers cannot capture — swipe still works via move handlers. */
        }
      }
      setDragOffset(delta);
    }
  };

  const onPointerUp = (event) => {
    if (!drag.current.active) return;
    const { delta, moved, cardIndex } = drag.current;
    drag.current.active = false;

    if (moved && event.currentTarget?.hasPointerCapture?.(drag.current.pointerId ?? event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(drag.current.pointerId ?? event.pointerId);
    }

    // Tap / click a side card → center it.
    if (!moved && cardIndex != null && cardIndex !== index) {
      goTo(cardIndex);
      return;
    }

    const threshold = 56;
    const forward = isRtl ? delta > threshold : delta < -threshold;
    const backward = isRtl ? delta < -threshold : delta > threshold;
    if (moved && forward) goTo(index + 1);
    else if (moved && backward) goTo(index - 1);
    else setDragOffset(0);
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
                data-carousel-index={cardIndex}
                className={`product-detail-carousel__card${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                role="group"
                aria-roledescription="slide"
                aria-label={card.title}
                onClick={() => {
                  // Fallback when pointerup path is skipped; ignore after drag.
                  if (drag.current.moved) return;
                  if (cardIndex !== index) goTo(cardIndex);
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
