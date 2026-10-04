import React, { useState } from 'react';
import { UsuariosPageIsland } from './UsuariosPageIsland.jsx';
import { DirectivosPageIsland } from './DirectivosPageIsland.jsx';

export function PersonasPageIsland({ root }) {
  const payload = JSON.parse(root.dataset.payload || '{}');
  const [tab, setTab] = useState(payload.tab || 'jugadores');
  return (
    <div className="grid gap-4">
      <header className="rounded-lg border border-[#adc8bb] bg-white p-4">
        <h1 className="m-0 text-2xl font-black text-[#07130f]">Personas</h1>
        <p className="mb-0 text-sm text-[#526b62]">Vincula jugadores a sus cuentas y administra usuario, clave y permisos. Los directivos conservan todas las funciones de jugador.</p>
      </header>
      <nav aria-label="Filtrar cuentas" className="flex border-b border-[#adc8bb]">
        {['jugadores', 'directivos'].map((value) => (
          <button key={value} type="button" aria-pressed={tab === value}
            className={`min-h-11 border-b-2 bg-transparent px-4 text-sm font-bold ${tab === value ? 'border-[#063d2b] text-[#063d2b]' : 'border-transparent text-[#526b62]'}`}
            onClick={() => {
              setTab(value);
              const url = new URL(window.location.href);
              url.searchParams.set('tab', value);
              window.history.replaceState(window.history.state, '', url);
            }}>
            {value === 'jugadores' ? 'Jugadores' : 'Directivos'}
          </button>
        ))}
      </nav>
      <UsuariosPageIsland key={tab} payloadOverride={payload.accounts} embedded roleFilter={tab === 'directivos' ? 'directivo' : null} defaultRole={tab === 'directivos' ? 'directivo' : 'jugador'} />
      {tab === 'directivos' ? <DirectivosPageIsland payloadOverride={payload.board} embedded /> : null}
    </div>
  );
}
