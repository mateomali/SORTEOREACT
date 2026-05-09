export function StatRating({ name, label, value, onChange }) {
  const rating = Math.max(1, Math.min(6, Number(value) || 1));
  const barColor = rating >= 5.95
    ? '#67e8f9'
    : rating >= 4
      ? '#bef264'
      : rating >= 3
        ? '#fcd34d'
        : '#f87171';

  return (
    <div>
      <div
        className="stat-rating flex min-w-0 items-center justify-between gap-3 rounded-xl border border-lime-200/45 bg-emerald-950/70 px-3 py-2"
        style={{
          background: '#063d2b',
          borderColor: 'rgba(223,255,105,.28)',
          color: '#fff',
        }}
        data-stat-rating
      >
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
              style={{ color: star <= rating ? '#f5b625' : 'rgba(216,247,234,.32)' }}
            >
              ★
            </button>
          ))}
        </div>
        <span className="stat-rating-value shrink-0 rounded-full bg-lime-100 px-2.5 py-1 text-xs font-extrabold text-emerald-950 shadow-sm" style={{ background: '#dfff69', color: '#041a13' }} data-stat-rating-value>{rating}/6</span>
      </div>
      <div className="stat-rating-progress mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-950/80" style={{ background: '#041a13' }}>
        <span
          className="block h-full rounded-full"
          data-stat-rating-bar
          style={{ width: `${Math.max(0, Math.min(100, Math.round((rating / 6) * 100)))}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
