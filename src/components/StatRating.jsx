export function StatRating({ name, label, value, onChange }) {
  const normalizeRating = (nextValue) => {
    const number = Number.parseFloat(String(nextValue ?? ''));
    const base = Number.isFinite(number) ? number : 1;
    return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
  };
  const formatRating = (nextValue) => Number.isInteger(nextValue) ? String(nextValue) : nextValue.toFixed(1);
  const cardOverallFromSix = nextValue => globalThis.GoodfellasRating.card(nextValue);
  const rating = normalizeRating(value);
  const barColor = rating >= 5.95
    ? '#16a34a'
    : rating >= 4
      ? '#84cc16'
      : rating >= 3
        ? '#f59e0b'
        : '#ef4444';
  const width = `${Math.max(0, Math.min(100, Math.round((rating / 6) * 100)))}%`;

  return (
    <div className="stat-rating" data-stat-rating>
      <input type="hidden" name={name} value={rating} data-stat-rating-input readOnly />
      <div className="stat-rating-stars" role="radiogroup" aria-label={label || name}>
        {[1, 2, 3, 4, 5, 6].map((star) => (
          <button
            className={`stat-rating-star${star <= rating ? ' is-active' : ''}`}
            type="button"
            data-stat-value={star}
            role="radio"
            aria-checked={star === rating ? 'true' : 'false'}
            aria-label={`${star} de 6`}
            key={star}
            onClick={() => onChange(normalizeRating(star))}
          >
            {'\u2605'}
          </button>
        ))}
      </div>
      <div className="stat-rating-bar-shell">
        <div className="stat-rating-bar" aria-hidden="true">
          <span data-stat-rating-bar style={{ width, backgroundColor: barColor }} />
        </div>
        <input
          className="stat-rating-range"
          type="range"
          min="1"
          max="6"
          step="0.1"
          value={rating}
          aria-label={label || name}
          data-stat-rating-range
          onChange={(event) => onChange(normalizeRating(event.target.value))}
          onInput={(event) => onChange(normalizeRating(event.currentTarget.value))}
        />
      </div>
      <span className="stat-rating-value" data-stat-rating-value title={`${formatRating(rating)}/6`}>{cardOverallFromSix(rating)}</span>
    </div>
  );
}
