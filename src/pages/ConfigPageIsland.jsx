import React from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const panelClass = 'rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const labelPanelClass = 'grid gap-1.5 rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3';
const labelTextClass = 'text-xs font-black uppercase text-lime-100/85';
const inputClass = 'w-full rounded-lg border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25';
const compactInputClass = 'min-h-9 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50 outline-none focus:border-lime-200 focus:ring-2 focus:ring-lime-200/20';
const weightInputClass = 'min-h-9 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2 py-1.5 text-xs font-bold text-lime-50 outline-none focus:border-lime-200 focus:ring-2 focus:ring-lime-200/20';
const primaryButtonClass = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200';
const mutedButtonClass = 'inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3 py-2 text-sm font-extrabold text-lime-50 transition hover:bg-emerald-900';
const helpTextClass = 'text-xs font-semibold leading-snug text-lime-50/72';

function SettingsForm({ settings, positionWeights, positionWeightLabels }) {
  const weightEntries = Object.entries(positionWeights || {});

  return (
    <form className="grid gap-3" method="post">
      <input type="hidden" name="action" value="save_settings" />
      <label className={`${labelPanelClass} text-sm font-bold text-lime-50`}>
        <span className={labelTextClass}>Rehacer sorteo</span>
        <span className="flex min-h-11 items-center gap-3 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-3 py-2">
          <input
            className="h-4 w-4 accent-lime-200"
            type="checkbox"
            name="allow_redraw_default"
            value="1"
            defaultChecked={String(settings.allow_redraw_default) === '1'}
          />
          <span>Permitir rehacer sorteo</span>
        </span>
      </label>

      <label className={labelPanelClass}>
        <span className={labelTextClass}>Veces permitidas</span>
        <input className={inputClass} type="number" name="redraw_limit_default" min="0" max="20" defaultValue={settings.redraw_limit_default || '0'} />
      </label>

      <label className={labelPanelClass}>
        <span className={labelTextClass}>Sorteo multiple</span>
        <input className={inputClass} type="number" name="multi_draw_count_default" min="1" max="10" defaultValue={settings.multi_draw_count_default || '3'} />
        <small className={helpTextClass}>Cantidad de variantes a generar. Default recomendado: 3.</small>
      </label>

      <label className={labelPanelClass}>
        <span className={labelTextClass}>Cierre de votacion</span>
        <input className={inputClass} type="number" name="multi_draw_lock_minutes_default" min="0" max="1440" defaultValue={settings.multi_draw_lock_minutes_default || '0'} />
        <small className={helpTextClass}>Minutos antes del partido.</small>
      </label>

      <div className={`${labelPanelClass} gap-3`}>
        <div>
          <span className={labelTextClass}>Pesos por posicion</span>
          <p className="m-0 mt-1 text-xs font-semibold text-lime-50/72">
            Valores relativos. Al guardar se normalizan para que cada posicion sume 100%.
          </p>
        </div>
        <div className="grid gap-3">
          {weightEntries.map(([position, weights]) => {
            const fields = Object.entries(weights || {});
            const total = fields.reduce((sum, [, value]) => sum + Number(value || 0), 0);
            return (
              <fieldset key={position} className="grid gap-2 rounded-lg border border-lime-200/20 bg-emerald-950/65 p-3">
                <legend className="px-1 text-sm font-black text-lime-50">
                  {position} - {Math.round(total * 100)}%
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map(([field, weight]) => (
                    <label key={`${position}-${field}`} className="grid gap-1">
                      <span className="truncate text-[10px] font-black uppercase text-lime-100/80 sm:text-[11px]">
                        {positionWeightLabels[field] || field}
                      </span>
                      <input
                        className={weightInputClass}
                        type="number"
                        name={`position_weights[${position}][${field}]`}
                        min="0"
                        max="1"
                        step="0.01"
                        defaultValue={Number(weight || 0).toFixed(2)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
        <button className={mutedButtonClass} type="submit" name="reset_position_weights" value="1">
          Restaurar pesos por defecto
        </button>
      </div>

      <button className={primaryButtonClass} type="submit">Guardar configuracion</button>
    </form>
  );
}

function WeekdaySelect({ weekdays, defaultValue }) {
  return (
    <select className={inputClass} name="weekday" defaultValue={defaultValue}>
      {weekdays.map((day) => (
        <option key={day.value} value={day.value}>{day.label}</option>
      ))}
    </select>
  );
}

function CourtCreateForm({ weekdays }) {
  return (
    <form className="mb-4 grid gap-3 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3" method="post">
      <input type="hidden" name="action" value="save_court" />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={labelTextClass}>Id</span>
          <input className={inputClass} type="text" name="court_key" placeholder="cancha1" required />
        </label>
        <label className="grid gap-1.5">
          <span className={labelTextClass}>Lugar</span>
          <input className={inputClass} type="text" name="place" placeholder="kicker" required />
        </label>
        <label className="grid gap-1.5">
          <span className={labelTextClass}>Dia</span>
          <WeekdaySelect weekdays={weekdays} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelTextClass}>Horario</span>
          <input className={inputClass} type="time" name="time_value" defaultValue="21:00" required />
        </label>
        <label className="grid gap-1.5">
          <span className={labelTextClass}>Jugadores totales</span>
          <input className={inputClass} type="number" name="total_players" min="2" max="40" defaultValue="18" required />
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-lime-200/35 bg-emerald-950/92 px-3 py-2 text-sm font-bold text-lime-50">
          <input className="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" defaultChecked />
          <span>Activa</span>
        </label>
      </div>
      <button className={primaryButtonClass} type="submit">Agregar cancha</button>
    </form>
  );
}

function CourtEditForm({ court, weekdays }) {
  return (
    <form className="grid gap-2 rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3" method="post">
      <input type="hidden" name="action" value="save_court" />
      <input type="hidden" name="id" value={court.id} />
      <div className="grid gap-2 md:grid-cols-[0.8fr_1fr_0.9fr_0.8fr_0.8fr_auto]">
        <input className={compactInputClass} type="text" name="court_key" defaultValue={court.court_key || ''} required />
        <input className={compactInputClass} type="text" name="place" defaultValue={court.place || ''} required />
        <select className={compactInputClass} name="weekday" defaultValue={court.weekday}>
          {weekdays.map((day) => (
            <option key={day.value} value={day.value}>{day.label}</option>
          ))}
        </select>
        <input className={compactInputClass} type="time" name="time_value" defaultValue={court.time_value || '21:00'} required />
        <input className={compactInputClass} type="number" name="total_players" min="2" max="40" defaultValue={court.total_players || 18} required />
        <label className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-lime-200/25 bg-emerald-950/80 px-2 py-1 text-xs font-black text-lime-100">
          <input className="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" defaultChecked={court.active === true} />
          Activa
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <small className="font-semibold text-emerald-100/75">Proxima: {court.next_datetime}</small>
        <button className={`${mutedButtonClass} w-full px-3 py-1.5 text-xs sm:w-auto`} type="submit">Guardar cancha</button>
      </div>
    </form>
  );
}

export function ConfigPageIsland({ root }) {
  const payload = readPayload(root);
  const settings = payload.settings || {};
  const weekdays = Array.isArray(payload.weekdays) ? payload.weekdays : [];
  const courts = Array.isArray(payload.courts) ? payload.courts : [];

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Configuracion</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Defaults del sorteo y canchas alquiladas para crear fechas mas rapido.
          </p>
        </div>
        <a className="inline-flex min-h-9 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900" href="crear_partido.php">
          Crear fecha
        </a>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className={panelClass}>
          <div className="mb-4">
            <h2 className="mb-1 text-xl font-black text-lime-50">Opciones de sorteo</h2>
            <p className="text-sm font-semibold text-emerald-100/75">
              Estos valores se aplican automaticamente al crear una fecha nueva.
            </p>
          </div>
          <SettingsForm
            settings={settings}
            positionWeights={payload.positionWeights || {}}
            positionWeightLabels={payload.positionWeightLabels || {}}
          />
        </article>

        <article className={panelClass}>
          <div className="mb-4">
            <h2 className="mb-1 text-xl font-black text-lime-50">Canchas alquiladas</h2>
            <p className="text-sm font-semibold text-emerald-100/75">
              Cada cancha define dia, hora y cupos. Crear fecha calcula el proximo dia del calendario.
            </p>
          </div>

          <CourtCreateForm weekdays={weekdays} />

          <div className="grid gap-2">
            {courts.map((court) => (
              <CourtEditForm key={court.id} court={court} weekdays={weekdays} />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
