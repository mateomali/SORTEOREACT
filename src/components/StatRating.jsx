export function StatRating({ name, label, value, onChange }) {
  const rating = Math.max(1, Math.min(6, Number(value) || 1));

  return (
    <div className="stat-rating flex min-w-0 items-center justify-between gap-3 rounded-xl border border-lime-200/45 bg-emerald-950/70 px-3 py-2" data-stat-rating>
      <input type="hidden" name={name} value={rating} data-stat-rating-input readOnly />
      <div className="stat-rating-stars inline-flex min-w-0 items-center gap-0.5" role="radiogroup" aria-label={label || name}>
        {[1, 2, 3, 4, 5, 6].map((star) => (
          <button
            key={star}
            type="button"
            className={`stat-star inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-xl leading-none transition hover:bg-lime-100/10 hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-lime-200/60 ${star <= rating ? 'is-active text-amber-300' : 'text-emerald-200/35'}`}
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
      <span className="stat-rating-value shrink-0 rounded-full bg-lime-100 px-2.5 py-1 text-xs font-extrabold text-emerald-950 shadow-sm" data-stat-rating-value>{rating}/6</span>
    </div>
  );
}
