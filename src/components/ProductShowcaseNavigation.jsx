export default function ProductShowcaseNavigation({ onPrevious, onNext, previousLabel, nextLabel, disabled }) {
  return (
    <div className="product-showcase-nav">
      <button className="product-showcase-nav__button product-showcase-nav__button--previous" type="button" onClick={onPrevious} aria-label={previousLabel} disabled={disabled}>
        <span aria-hidden="true">←</span>
      </button>
      <button className="product-showcase-nav__button product-showcase-nav__button--next" type="button" onClick={onNext} aria-label={nextLabel} disabled={disabled}>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
