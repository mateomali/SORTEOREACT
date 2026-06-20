import React from 'react';

const panelClass = 'rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const mutedText = 'text-sm font-semibold leading-snug text-emerald-100/78';
const primaryButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200 sm:w-auto';
const mutedButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900 sm:w-auto';
const fileInputClass = 'block w-full max-w-full min-w-0 rounded-lg border border-lime-200/35 bg-emerald-950/75 px-2 py-2 text-xs font-semibold text-lime-50 file:mr-2 file:rounded-md file:border-0 file:bg-lime-100 file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-[#07130f] hover:file:bg-lime-200';

function ActionPanel({ title, description, children }) {
  return (
    <article className={panelClass}>
      <h3 className="mb-2 text-lg font-black text-lime-50">{title}</h3>
      <p className={mutedText}>{description}</p>
      <div className="mt-4">{children}</div>
    </article>
  );
}

export function MigrarCsvPageIsland() {
  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-lime-50">Migracion desde CSV</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Importa jugadores desde el archivo historico al nuevo modelo en base de datos.
          </p>
        </div>
        <a className={mutedButton} href="jugadores2.php">Volver a jugadores</a>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ActionPanel
          title="Exportar jugadores actuales"
          description="Descarga un CSV con todos los jugadores cargados, activos e inactivos, y todas sus caracteristicas actuales."
        >
          <form method="post" className="flex flex-wrap gap-2" data-no-partial>
            <input type="hidden" name="action" value="export_players" />
            <button className={primaryButton} type="submit">Exportar CSV</button>
          </form>
        </ActionPanel>

        <ActionPanel
          title="Importar jugadores.csv local"
          description="Usa el archivo jugadores.csv de esta carpeta."
        >
          <form method="post" className="flex flex-wrap gap-2" data-no-partial>
            <input type="hidden" name="action" value="import_default" />
            <button className={primaryButton} type="submit">Importar archivo local</button>
          </form>
        </ActionPanel>

        <ActionPanel
          title="Subir otro CSV"
          description="Columnas esperadas: Nombre, Posicion, Velocidad, Puntuacion. Tambien acepta Pase vision e Ida y vuelta si vienen en el archivo."
        >
          <form method="post" encType="multipart/form-data" className="grid gap-3" data-no-partial>
            <input type="hidden" name="action" value="import_upload" />
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase text-lime-100/85">Archivo CSV</span>
              <input className={fileInputClass} type="file" name="csv_file" accept=".csv,text/csv" required />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className={primaryButton} type="submit">Subir e importar</button>
            </div>
          </form>
        </ActionPanel>
      </section>
    </div>
  );
}
