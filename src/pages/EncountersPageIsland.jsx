import React, { useEffect, useMemo, useState } from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const primaryAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#063d2b] bg-[#063d2b] px-3 py-2 text-sm font-black text-white no-underline transition hover:bg-[#052f22] disabled:cursor-not-allowed disabled:opacity-45';
const strongAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#111827] bg-[#111827] px-3 py-2 text-sm font-black text-white no-underline transition hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-45';
const mutedAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#b7c4bf] bg-white px-3 py-2 text-sm font-black text-[#10231d] no-underline transition hover:border-[#879892] hover:bg-[#f6f7f5] disabled:cursor-not-allowed disabled:opacity-45';
const formationAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#7fa994] bg-[#f8fbf9] px-3 py-2 text-sm font-black text-[#063d2b] no-underline transition hover:border-[#386f57] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45';
const warningAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#d7a319] bg-[#fff3c4] px-3 py-2 text-sm font-black text-[#684200] no-underline transition hover:bg-[#ffe89a] disabled:cursor-not-allowed disabled:opacity-45';
const undoAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#a78b5f] bg-[#f7f2e9] px-3 py-2 text-sm font-black text-[#4f3b1d] no-underline transition hover:border-[#80643f] hover:bg-[#f1e6d5] disabled:cursor-not-allowed disabled:opacity-45';
const dangerAction = 'inline-flex min-h-9 w-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-0 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45';
const disabledAction = 'inline-flex min-h-9 items-center justify-center rounded-md border border-[#d9dfdc] bg-[#f1f3f2] px-3 py-2 text-sm font-black text-[#8b9490]';
const panelClass = 'rounded-lg border border-[#d7ded9] bg-white p-3 shadow-sm';
const filterPanelClass = 'rounded-lg border border-[#adc8bb] bg-[#e8f3ee] p-2 shadow-sm sm:p-3';
const inputClass = 'min-h-9 w-full rounded-md border border-[#b7c4bf] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-[#d8f999] sm:min-h-10 sm:px-3 sm:py-2';
const searchInputClass = 'min-h-9 w-full rounded-md border !border-[#063d2b] !bg-white px-2.5 py-1.5 text-sm font-black !text-[#07130f] outline-none placeholder:!text-[#526b62] focus:!border-[#063d2b] focus:ring-2 focus:ring-[#d8f999]/80 sm:min-h-10 sm:px-3 sm:py-2';
const sectionLabelClass = 'block text-[11px] font-black leading-none text-[#52615b]';

function ShirtMark({ color }) {
  const fills = {
    ROSA: '#ec4899',
    AZUL: '#2563eb',
    VERDE: '#16a34a',
    NEGRO: '#111827',
    NARANJA: '#f97316',
    CAMISADO: '#f8fafc',
    DESCAMISADO: '#d6d3d1',
  };
  const fill = fills[String(color || '').toUpperCase()] || '#047857';
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill={fill}>
      <path d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />
    </svg>
  );
}

function Icon({ name }) {
  const paths = {
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h.01" /><path d="M16 8h.01" /><path d="M12 12h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" /></>,
  };
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
}

function StatusBadge({ children, tone = 'neutral' }) {
  const styles = {
    neutral: 'text-[#52615b]',
    result: 'text-[#6b7280]',
    ready: 'text-[#0c6b49]',
    warning: 'text-[#8a5a00]',
    done: 'text-[#47515a]',
    court: 'text-[#476057]',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-black leading-tight ${styles[tone] || styles.neutral}`}>
      {children}
    </span>
  );
}

function Scoreboard({ teams = [] }) {
  if (!teams.length) {
    return <StatusBadge tone="result">Sin resultado</StatusBadge>;
  }

  if (teams.length !== 2) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#cbd7d1] pb-1 text-[11px] font-black text-[#0c6b49]">
        {teams.map((team, index) => (
          <React.Fragment key={`${team.label}-${index}`}>
            {index > 0 ? <span className="text-[#8a9690]">vs</span> : null}
            <span className="inline-flex items-center gap-1">
              <span>{team.label}</span>
              <ShirtMark color={team.color} />
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-b border-[#cbd7d1] pb-1 text-[11px] font-black text-[#0c6b49]">
      <span className="inline-flex min-w-0 items-center gap-1 truncate px-1">
        <span className="truncate">{teams[0].label}</span>
        <ShirtMark color={teams[0].color} />
      </span>
      <strong className="px-1.5 text-sm font-black text-[#07130f]">
        {teams[0].goals} - {teams[1].goals}
      </strong>
      <span className="inline-flex min-w-0 items-center justify-end gap-1 truncate px-1 text-right">
        <span className="truncate">{teams[1].label}</span>
        <ShirtMark color={teams[1].color} />
      </span>
    </div>
  );
}

function DeleteForm({ match }) {
  return (
    <form method="post" className="contents">
      <input type="hidden" name="action" value="delete_match" />
      <input type="hidden" name="id" value={match.id} />
      <button className={`${dangerAction} max-sm:min-h-8 max-sm:w-9 max-sm:py-1 max-sm:text-xs`} type="submit" data-confirm={match.deleteConfirm} aria-label="Eliminar fecha" title="Eliminar">
        X
      </button>
    </form>
  );
}

function UndoForm({ match, className = undoAction }) {
  return (
    <form method="post" className="contents">
      <input type="hidden" name="action" value="undo_draw" />
      <input type="hidden" name="id" value={match.id} />
      <button className={className} type="submit" data-confirm="¿Deshacer el sorteo? Se borrarán equipos, capitanes y variantes para volver a sortear.">
        Deshacer
      </button>
    </form>
  );
}

function ActionSection({ label, children, tone = 'neutral', contentClassName = 'flex min-w-0 flex-wrap items-center gap-1.5' }) {
  const styles = {
    neutral: 'border-[#d7ded9] bg-[#f8faf9]',
    warning: 'border-[#ead39a] bg-[#fffaf0]',
    primary: 'border-[#b9dfcd] bg-[#f3faf6]',
    danger: 'border-red-100 bg-red-50/45',
  };
  return (
    <div className={`grid min-h-[104px] grid-rows-[auto_1fr] gap-1.5 rounded-md border p-1.5 ${styles[tone] || styles.neutral}`}>
      <span className={sectionLabelClass}>{label}</span>
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  );
}

function StatusSection({ match }) {
  const statusTone = match.isFinalized ? 'done' : (match.canFinalize ? 'ready' : 'warning');
  return (
    <div className="grid gap-1.5 rounded-md border border-[#d7ded9] bg-[#f8faf9] p-2">
      <span className={sectionLabelClass}>Estado</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge tone={statusTone}>{match.statusLabel}</StatusBadge>
        <StatusBadge tone="court">Cancha: {match.courtLabel}</StatusBadge>
        {match.missingAwards ? <StatusBadge tone="warning">Sin premios</StatusBadge> : null}
        {match.missingRating ? <StatusBadge tone="warning">Sin puntaje</StatusBadge> : null}
      </div>
    </div>
  );
}

function ResultSection({ match }) {
  return (
    <div className="grid gap-1.5 rounded-md border border-[#d7ded9] bg-white p-2">
      <span className={sectionLabelClass}>Resultado</span>
      <Scoreboard teams={match.scoreboard} />
    </div>
  );
}

function MatchActions({ match, compact = false }) {
  const followUpLabel = match.canFinalize
    ? 'Cierre'
    : match.isFinalized
      ? (match.needsValuations ? 'Pendientes' : 'Detalle')
      : 'Cierre';
  const teamActionsGrid = 'grid min-w-0 grid-cols-2 content-center gap-1.5';
  const singleActionGrid = 'grid min-w-0 content-center gap-1.5 justify-items-stretch';
  return (
    <div className={`grid min-w-0 items-stretch gap-2 ${compact ? 'sm:grid-cols-[minmax(190px,1fr)_118px_56px]' : 'lg:grid-cols-[minmax(190px,1fr)_118px_56px]'}`}>
      {match.isScheduled ? (
        <ActionSection label="Preparación" tone="warning" contentClassName={teamActionsGrid}>
          <a className={`${mutedAction} w-full px-0`} href={match.links.edit} aria-label="Editar fecha" title="Editar"><Icon name="edit" /></a>
          <a className={`${warningAction} w-full px-2`} href={match.links.draw}><Icon name="dice" /> <span className="ml-1.5">Sortear</span></a>
          <a className={`${primaryAction} w-full px-2`} href={match.links.captains}>Capitanes</a>
          <a className={`${mutedAction} w-full px-2`} href={match.links.manual}>Manual</a>
        </ActionSection>
      ) : (
        <ActionSection label="Equipos" tone={match.canFinalize ? 'primary' : 'neutral'} contentClassName={teamActionsGrid}>
          <span className={`${disabledAction} w-full px-0`} aria-label="Editar no disponible" title="Editar"><Icon name="edit" /></span>
          <span className={`${disabledAction} w-full px-2`}>{match.canFinalize || match.isFinalized ? 'Sorteado' : 'Sortear'}</span>
          {match.canEditFormation ? <a className={`${formationAction} w-full px-2`} href={match.links.formations}>Formaciones</a> : <span className={`${disabledAction} w-full px-2`}>Formaciones</span>}
          {match.canFinalize ? <UndoForm match={match} className={`${undoAction} w-full px-2`} /> : null}
        </ActionSection>
      )}

      <ActionSection label={followUpLabel} tone={match.canFinalize || match.needsValuations ? 'primary' : 'neutral'} contentClassName={singleActionGrid}>
        {match.canFinalize ? (
          <a className={`${primaryAction} w-full px-2`} href={match.links.finish}>Finalizar</a>
        ) : match.isFinalized ? (
          <>
            {match.needsValuations ? <a className={`${strongAction} w-full px-2`} href={match.links.valuations}>Valoraciones</a> : null}
            <a className={`${mutedAction} w-full px-2`} href={match.links.view}>Ver</a>
          </>
        ) : (
          <span className={`${disabledAction} w-full px-2`}>Finalizar</span>
        )}
      </ActionSection>

      <ActionSection label="Admin" tone="danger" contentClassName={singleActionGrid}>
        <DeleteForm match={match} />
      </ActionSection>
    </div>
  );
}

function MobileMatchHeader({ match, eyebrow }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {eyebrow ? <StatusBadge tone="ready">{eyebrow}</StatusBadge> : null}
          <span className="text-[11px] font-black text-[#047857]">{match.dateShort || match.dateLabel}</span>
        </div>
        <h3 className="m-0 truncate text-sm font-black leading-tight text-[#07130f]">{match.title}</h3>
        <span className="mt-0.5 block text-[11px] font-semibold text-[#526b62]">{match.participantsCount}/{match.expectedPlayers} convocados</span>
      </div>
      <DeleteForm match={match} />
    </div>
  );
}

function MobileMatchSummary({ match }) {
  const statusTone = match.isFinalized ? 'done' : (match.canFinalize ? 'ready' : 'warning');
  return (
    <div className="grid gap-1 rounded-md border border-[#d7ded9] bg-[#f8faf9] p-1.5">
      <Scoreboard teams={match.scoreboard} />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge tone={statusTone}>{match.statusLabel}</StatusBadge>
        <StatusBadge tone="court">Cancha: {match.courtLabel}</StatusBadge>
        {match.missingAwards ? <StatusBadge tone="warning">Sin premios</StatusBadge> : null}
        {match.missingRating ? <StatusBadge tone="warning">Sin puntaje</StatusBadge> : null}
      </div>
    </div>
  );
}

function MobileActionLink({ className, href, children, ariaLabel, title }) {
  return (
    <a className={`${className} min-h-8 w-full px-2 py-1 text-[11px]`} href={href} aria-label={ariaLabel} title={title}>
      {children}
    </a>
  );
}

function MobileMatchActions({ match }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {match.isScheduled ? (
        <>
          <MobileActionLink className={mutedAction} href={match.links.edit} ariaLabel="Editar fecha" title="Editar">
            <Icon name="edit" />
            <span className="ml-1.5">Editar</span>
          </MobileActionLink>
          <MobileActionLink className={warningAction} href={match.links.draw}>
            <Icon name="dice" />
            <span className="ml-1.5">Sortear</span>
          </MobileActionLink>
          <MobileActionLink className={primaryAction} href={match.links.captains}>Capitanes</MobileActionLink>
          <MobileActionLink className={mutedAction} href={match.links.manual}>Manual</MobileActionLink>
          <span className={`${disabledAction} col-span-2 min-h-8 w-full px-2 py-1 text-[11px]`}>Finalizar</span>
        </>
      ) : (
        <>
          <span className={`${disabledAction} min-h-8 w-full px-2 py-1 text-[11px]`}>Sorteado</span>
          {match.canEditFormation ? (
            <MobileActionLink className={formationAction} href={match.links.formations}>Formaciones</MobileActionLink>
          ) : (
            <span className={`${disabledAction} min-h-8 w-full px-2 py-1 text-[11px]`}>Formaciones</span>
          )}
          {match.canFinalize ? (
            <>
              <UndoForm match={match} className={`${undoAction} min-h-8 w-full px-2 py-1 text-[11px]`} />
              <MobileActionLink className={primaryAction} href={match.links.finish}>Finalizar</MobileActionLink>
            </>
          ) : match.isFinalized ? (
            <>
              {match.needsValuations ? <MobileActionLink className={strongAction} href={match.links.valuations}>Valoraciones</MobileActionLink> : null}
              <MobileActionLink className={mutedAction} href={match.links.view}>Ver</MobileActionLink>
            </>
          ) : (
            <span className={`${disabledAction} col-span-2 min-h-8 w-full px-2 py-1 text-[11px]`}>Finalizar</span>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  const cardTone = match.isScheduled
    ? 'border-l-[#d7a319] bg-[#fffdf7]'
    : match.isFinalized
      ? 'border-l-[#6b7280] bg-white'
      : 'border-l-[#063d2b] bg-white';
  const sideBorderTone = match.isFocused
    ? 'border-y-[#063d2b] border-r-[#063d2b] ring-2 ring-[#d8f999]'
    : match.isLatest
      ? 'border-y-[#9fc8b5] border-r-[#9fc8b5]'
      : 'border-y-[#d7e6df] border-r-[#d7e6df]';
  return (
    <article
      id={`partido-admin-${match.id}`}
      tabIndex={match.isFocused ? 0 : -1}
      className={`grid gap-2 rounded-lg border-y border-r border-l-4 p-2 shadow-sm outline-none lg:gap-3 lg:p-3 ${cardTone} ${sideBorderTone}`}
      data-focus-match={match.isFocused ? '1' : '0'}
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(150px,.75fr)_minmax(260px,1fr)_minmax(280px,1fr)] lg:items-start">
        <MobileMatchHeader match={match} />
        <MobileMatchSummary match={match} />
        <MobileMatchActions match={match} />
      </div>
    </article>
  );
}

function SummaryCard({ label, value, active, tone = 'neutral', onClick }) {
  const styles = {
    scheduled: active
      ? 'border-[#d7a319] bg-[#fff3c4] ring-2 ring-[#ffe89a]'
      : 'border-[#ead39a] bg-[#fffaf0] hover:border-[#d7a319]',
    ready: active
      ? 'border-[#063d2b] bg-[#e4f4ec] ring-2 ring-[#d8f999]'
      : 'border-[#b9dfcd] bg-[#f8fbf9] hover:border-[#7fa994]',
    done: active
      ? 'border-[#475569] bg-[#eef0f1] ring-2 ring-[#c8ced0]'
      : 'border-[#d3d7da] bg-[#f7f8f8] hover:border-[#9aa3a8]',
    neutral: active
      ? 'border-[#063d2b] bg-[#ecfdf5] ring-2 ring-[#d8f999]'
      : 'border-[#d7e6df] bg-white hover:border-[#adc8bb]',
  };
  return (
    <button
      className={`grid min-h-[56px] content-center rounded-md border px-2 py-1.5 text-center transition sm:min-h-0 sm:rounded-lg sm:p-3 sm:text-left ${styles[tone] || styles.neutral}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="truncate text-[10px] font-black leading-tight text-[#526b62] sm:text-xs">{label}</span>
      <strong className="text-xl font-black leading-none text-[#07130f] sm:text-2xl">{value}</strong>
    </button>
  );
}

function Pagination({ currentPage, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Páginas de fechas">
      <button className={currentPage > 1 ? mutedAction : disabledAction} type="button" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>
        Anterior
      </button>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
        <button
          key={page}
          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-black ${
            page === currentPage
              ? 'border-[#063d2b] bg-[#063d2b] text-white'
              : 'border-[#adc8bb] bg-white text-[#063d2b] hover:bg-[#f4fbf7]'
          }`}
          type="button"
          onClick={() => onPage(page)}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      <button className={currentPage < totalPages ? mutedAction : disabledAction} type="button" disabled={currentPage >= totalPages} onClick={() => onPage(currentPage + 1)}>
        Siguiente
      </button>
    </nav>
  );
}

function EditEncountersPage({ payload, root }) {
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(Number(payload.pagination?.currentPage || 1));
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    window.goodfellasHydrateDynamicContent?.(root);
  }, [root, matches.length, page, status, query]);

  useEffect(() => {
    const focused = root.querySelector('[data-focus-match="1"]');
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }, [root]);

  const latest = matches.find((match) => Number(match.id) === Number(payload.latestId)) || null;
  const filtered = matches.filter((match) => {
    const matchesQuery = normalizedQuery === '' || String(match.searchText || '').includes(normalizedQuery);
    const matchesStatus = status === '' || match.status === status;
    return matchesQuery && matchesStatus;
  });
  const perPage = Math.max(1, Number(payload.pagination?.perPage || 10));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visibleMatches = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  return (
    <section className="mx-auto grid w-full max-w-[1360px] gap-3 px-3 py-2 text-[#07130f] sm:px-5 lg:gap-4 lg:py-5">
      <header className="grid gap-0.5">
        <h1 className="m-0 text-xl font-black leading-tight text-[#07130f] sm:text-2xl">{payload.heading || 'Editar fechas'}</h1>
        <p className="m-0 text-xs font-semibold leading-snug text-[#526b62] sm:text-sm">{payload.description || 'Administra fechas cargadas, acciones disponibles y resultados.'}</p>
      </header>

      <section className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Resumen de fechas">
        <SummaryCard label="Programados" value={payload.summary?.scheduled || 0} tone="scheduled" active={status === 'programado'} onClick={() => setStatus(status === 'programado' ? '' : 'programado')} />
        <SummaryCard label="Listos para finalizar" value={payload.summary?.ready || 0} tone="ready" active={status === 'sorteado'} onClick={() => setStatus(status === 'sorteado' ? '' : 'sorteado')} />
        <SummaryCard label="Finalizados" value={payload.summary?.finished || 0} tone="done" active={status === 'finalizado'} onClick={() => setStatus(status === 'finalizado' ? '' : 'finalizado')} />
      </section>

      {latest ? (
        <section className="rounded-lg border border-l-4 border-y-[#cbd7d1] border-r-[#cbd7d1] border-l-[#063d2b] bg-white p-2 shadow-sm lg:p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(150px,.75fr)_minmax(260px,1fr)_minmax(280px,1fr)] lg:items-start">
            <MobileMatchHeader match={latest} eyebrow="Ultima fecha" />
            <MobileMatchSummary match={latest} />
            <MobileMatchActions match={latest} />
          </div>
          {false ? (
            <>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone="ready">Última fecha</StatusBadge>
                <span className="text-xs font-bold text-[#526b62]">{latest.dateLabel}</span>
              </div>
              <h2 className="m-0 truncate text-lg font-black text-[#07130f]">{latest.title}</h2>
              <p className="m-0 text-sm font-semibold text-[#526b62]">{latest.participantsCount}/{latest.expectedPlayers} convocados</p>
              <div className="mt-2 grid max-w-3xl gap-2 md:grid-cols-[minmax(180px,.75fr)_minmax(240px,1fr)]">
                <ResultSection match={latest} />
                <StatusSection match={latest} />
              </div>
            </div>
            <MatchActions match={latest} compact />
            </>
          ) : null}
        </section>
      ) : null}

      <section className={filterPanelClass}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end lg:gap-3">
          <label className="col-span-2 grid gap-1 text-xs font-black text-[#315247] sm:text-sm lg:col-span-1">
            Buscar fecha
            <input className={searchInputClass} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, fecha, cancha, capitán o resultado" />
          </label>
          <label className="grid gap-1 text-xs font-black text-[#315247] sm:text-sm">
            Estado
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="programado">Programados</option>
              <option value="sorteado">Equipos listos</option>
              <option value="finalizado">Finalizados</option>
            </select>
          </label>
          <span className="self-end pb-1 text-xs font-black text-[#526b62] sm:text-sm">{filtered.length}/{payload.summary?.total || matches.length} fechas</span>
        </div>
      </section>

      <section className="grid gap-2" aria-label="Historial de fechas">
        {visibleMatches.length ? visibleMatches.map((match) => <MatchCard key={match.id} match={match} />) : (
          <div className={panelClass}>
            <p className="m-0 text-sm font-semibold text-[#526b62]">No hay fechas que coincidan con la búsqueda.</p>
          </div>
        )}
      </section>

      <Pagination currentPage={safePage} totalPages={totalPages} onPage={setPage} />
    </section>
  );
}

function LegacyEncountersPage({ root, html }) {
  useEffect(() => {
    window.goodfellasHydrateDynamicContent?.(root);
  }, [root, html]);

  return (
    <div
      className="encounters-page-react grid gap-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function EncountersPageIsland({ root }) {
  const payload = useMemo(() => readPayload(root), [root]);

  if (payload.mode === 'edit') {
    return <EditEncountersPage payload={payload} root={root} />;
  }

  return <LegacyEncountersPage root={root} html={typeof payload.html === 'string' ? payload.html : ''} />;
}
