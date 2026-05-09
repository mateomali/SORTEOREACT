export function StatRating({ name, label, value, onChange }) {
  const rating = Math.max(1, Math.min(6, Number(value) || 1));
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
      <div className="stat-rating-bar-shell">
        <div className="stat-rating-bar" aria-hidden="true">
          <span data-stat-rating-bar style={{ width, backgroundColor: barColor }} />
        </div>
        <input
          className="stat-rating-range"
          type="range"
          min="1"
          max="6"
          step="1"
          value={rating}
          aria-label={label || name}
          data-stat-rating-range
          onChange={(event) => onChange(Number(event.target.value))}
          onInput={(event) => onChange(Number(event.currentTarget.value))}
        />
      </div>
      <span className="stat-rating-value" data-stat-rating-value>{rating}/6</span>
    </div>
  );
}
