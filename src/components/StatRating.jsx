export function StatRating({ name, label, value, onChange }) {
  const rating = Math.max(1, Math.min(6, Number(value) || 1));

  return (
    <div className="stat-rating" data-stat-rating>
      <input type="hidden" name={name} value={rating} data-stat-rating-input readOnly />
      <div className="stat-rating-stars" role="radiogroup" aria-label={label || name}>
        {[1, 2, 3, 4, 5, 6].map((star) => (
          <button
            key={star}
            type="button"
            className={`stat-star${star <= rating ? ' is-active' : ''}`}
            role="radio"
            aria-checked={star === rating ? 'true' : 'false'}
            aria-label={`${star} de 6`}
            onClick={() => onChange(star)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                return;
              }
              event.preventDefault();
              const next = event.key === 'Home'
                ? 1
                : event.key === 'End'
                  ? 6
                  : rating + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1);
              onChange(Math.max(1, Math.min(6, next)));
            }}
          >
            ★
          </button>
        ))}
      </div>
      <span className="stat-rating-value" data-stat-rating-value>{rating}/6</span>
    </div>
  );
}
