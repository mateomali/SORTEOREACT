import React from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const darkPanel = 'backup-card rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const mutedText = 'text-sm font-semibold leading-snug text-emerald-100/80';
const primaryButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200 sm:w-auto';
const dangerButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200/80 bg-red-600 px-3.5 py-2 text-sm font-extrabold text-white transition hover:bg-red-700 sm:w-auto';

export function BackupPageIsland({ root }) {
  const payload = readPayload(root);
  const zipAvailable = payload.zipAvailable !== false;
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const tableCounts = Array.isArray(payload.tableCounts) ? payload.tableCounts : [];

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <h1 className="m-0 text-lime-50">Backup</h1>
        <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
          Exporta una copia completa o importa solo las secciones que necesites recuperar.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className={darkPanel}>
          <h3 className="mb-2 text-lg font-black text-lime-50">Exportar backup</h3>
          <p className={mutedText}>
            Descarga {zipAvailable ? 'un ZIP con archivos CSV' : 'un JSON compatible porque la extension ZIP no esta habilitada'} de jugadores, fechas, equipos, premios y capitanes.
          </p>
          <form method="post" className="mt-4 flex flex-wrap gap-2" data-no-partial>
            <input type="hidden" name="action" value="export_backup" />
            <button className={primaryButton} type="submit">Descargar backup CSV</button>
          </form>
        </article>

        <article className={darkPanel}>
          <h3 className="mb-2 text-lg font-black text-lime-50">Importar backup</h3>
          <p className={mutedText}>
            Reemplaza solamente las secciones marcadas. Usa archivos ZIP o JSON generados por esta pantalla.
          </p>
          <form method="post" encType="multipart/form-data" className="mt-4 grid gap-3" data-no-partial>
            <input type="hidden" name="action" value="import_backup" />
            <div className="grid gap-1.5">
              <label className="mb-0 text-sm font-bold text-lime-50" htmlFor="backupFile">Archivo backup .zip o .json</label>
              <input
                className="block w-full max-w-full min-w-0 rounded-lg border border-lime-200/35 bg-emerald-950/75 px-2 py-2 text-xs text-lime-50 file:mr-2 file:rounded-md file:border-0 file:bg-lime-100 file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-[#07130f] hover:file:bg-lime-200"
                id="backupFile"
                type="file"
                name="backup_file"
                accept=".zip,.json,application/zip,application/json"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="mb-0 text-sm font-bold text-lime-50">Que importar</label>
              <div className="grid gap-2">
                {sections.map((section) => (
                  <label key={section.key} className="grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-lime-200/35 bg-emerald-950/75 p-3 text-lime-50">
                    <input className="mt-1 h-4 w-4 accent-lime-200" type="checkbox" name="import_sections[]" value={section.key} defaultChecked />
                    <span className="grid gap-0.5">
                      <strong className="text-sm font-black">{section.label}</strong>
                      <span className="text-xs font-semibold leading-snug text-emerald-100/80">{section.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-amber-200/70 bg-amber-50 p-3 text-sm font-bold text-amber-950">
              <input className="mt-0.5 h-4 w-4 accent-amber-600" type="checkbox" name="confirm_restore" value="1" required />
              <span>Reemplazar las secciones seleccionadas con este backup</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button className={dangerButton} type="submit" data-confirm="Esta accion reemplaza las secciones seleccionadas. Continuar?">
                Importar seleccion
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className={darkPanel}>
        <h3 className="mb-3 text-lg font-black text-lime-50">Contenido incluido</h3>
        <div className="overflow-x-auto rounded-lg border border-lime-200/25">
          <table className="w-full min-w-[320px] border-collapse text-sm sm:min-w-[360px]">
            <thead>
              <tr className="bg-emerald-900/70">
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Tabla</th>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Registros</th>
              </tr>
            </thead>
            <tbody>
              {tableCounts.map((item) => (
                <tr key={item.table}>
                  <td className="border-b border-lime-200/10 px-3 py-2 text-lime-50"><strong>{item.table}</strong></td>
                  <td className="border-b border-lime-200/10 px-3 py-2 text-emerald-100">{item.count}</td>
                </tr>
              ))}
              {!tableCounts.length ? (
                <tr>
                  <td className="px-3 py-3 text-emerald-100" colSpan="2">No hay tablas disponibles para exportar.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
