import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CompactPlayerCard, FullPlayerCard, playerPositionRatings, adjustedPositionRatingForTeamSize } from './SorteoLegacyPageIsland.jsx';

// Keep the server-rendered match information; use Sorteo's current card renderers.
function readCard(host) {
  const data = host.dataset;
  const player = {
    id: data.staticPlayerKey,
    nombre: host.querySelector('.formation-player-name')?.textContent.trim() || 'Jugador',
    posicion: data.playerPositions || data.assignedPosition,
    puntuacion: Number(data.playerSkill),
    photo_path: host.querySelector('.formation-card-photo img')?.getAttribute('src'),
    has_custom_photo: !!host.querySelector('.formation-card-photo.is-custom'),
    photo_position_x: Number(data.playerPhotoX || 50),
    photo_position_y: Number(data.playerPhotoY || 50),
    photo_zoom: Number(data.playerPhotoZoom || 100),
    availability_percent: Number(data.playerAvailability ?? 100),
  };
  const fields = {
    tecnica: 'playerTechnique', pase_vision: 'playerPassVision', ritmo_stat: 'playerRhythm',
    resistencia: 'playerStamina', solidez: 'playerDefensePhysical', ataque: 'playerAttack',
    compromiso: 'playerTeamwork', mentalidad: 'playerMentality', regularidad: 'playerRegularity',
    habilidad_arquero: 'playerGoalkeeperSkill',
  };
  Object.entries(fields).forEach(([field, attribute]) => { player[field] = Number(data[attribute]); });
  return {
    host, player, assignedPosition: data.assignedPosition,
    teamSize: host.closest('.team-formation').querySelectorAll('[data-static-formation-player]').length,
    goals: host.querySelector('.formation-scorer-badge')?.textContent.trim() || '',
    matchRating: host.querySelector('.formation-player-match-rating')?.textContent.trim() ?? null,
    awards: [...host.querySelectorAll('.formation-award-icons > span')].map(node => ({ label: node.title, icon: node.textContent })),
  };
}

function MatchIndicators({ entry }) {
  return <span className="gf-public-match-indicators">
    {entry.goals && <span title="Goles del partido">{entry.goals}</span>}
    {entry.matchRating !== null && <span title="Nota del partido">Nota {entry.matchRating}</span>}
    {entry.awards.map((award, index) => <span key={index} title={award.label} aria-label={award.label}>{award.icon}</span>)}
  </span>;
}

function PlayerPreview({ entry, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    return () => { previousFocus?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="gf-public-player-dialog sorteo-react-page" aria-label={`Ficha de ${entry.player.nombre}`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="gf-public-player-detail">
        <div className="gf-public-full-card"><FullPlayerCard player={entry.player} assignedPosition={entry.assignedPosition} teamSize={entry.teamSize} /></div>
        <aside>
          <h3>{entry.player.nombre}</h3>
          <p>Puntaje por posición</p>
          <div className="gf-public-position-ratings">
            {playerPositionRatings(entry.player, entry.assignedPosition, entry.teamSize).map(rating =>
              <div key={rating.position} data-active={rating.position === entry.assignedPosition}>
                <span>{rating.position}</span><meter min="0" max="100" value={rating.value} aria-label={`Puntaje ${rating.position}`} /><strong>{rating.value}</strong>
              </div>)}
          </div>
          <p>El puntaje usa las habilidades relevantes para cada posición y ajuste por regularidad.</p>
          <MatchIndicators entry={entry} />
          <button type="button" onClick={onClose} autoFocus>Cerrar ficha</button>
        </aside>
      </div>
    </dialog>, document.body,
  );
}

export function PublicFormationCardsIsland() {
  const [entries, setEntries] = useState([]);
  const [preview, setPreview] = useState(null);
  useLayoutEffect(() => {
    const hosts = [...document.querySelectorAll('.public-teams-uniform [data-static-formation-player]')];
    const cards = hosts.map(readCard);
    const teams = new Map();
    cards.forEach(entry => {
      const team = entry.host.closest('.team-formation');
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team).push(entry);
    });
    teams.forEach(team => team.slice().sort((a, b) => {
      const rating = entry => adjustedPositionRatingForTeamSize(entry.player, entry.assignedPosition, entry.teamSize);
      return rating(b) - rating(a) || String(a.player.id).localeCompare(String(b.player.id));
    }).slice(0, 3).forEach((entry, rank) => { entry.topPlayerRank = rank; }));
    const replacements = cards.map(entry => {
      const original = entry.host;
      const host = document.createElement('div');
      host.className = 'gf-public-player-slot';
      host.dataset.assignedPosition = entry.assignedPosition;
      original.replaceWith(host);
      entry.host = host;
      return { original, host };
    });
    setEntries(cards);
    return () => replacements.forEach(({ original, host }) => host.replaceWith(original));
  }, []);
  return <>
    {entries.map((entry, index) => createPortal(<>
      <CompactPlayerCard player={entry.player} assignedPosition={entry.assignedPosition} teamSize={entry.teamSize}
        topPlayerRank={entry.topPlayerRank ?? null}
        draggableProps={{ title: `Ver ficha de ${entry.player.nombre}` }} onOpen={() => setPreview(entry)} />
      <MatchIndicators entry={entry} />
    </>, entry.host, String(index)))}
    {preview && <PlayerPreview entry={preview} onClose={() => setPreview(null)} />}
  </>;
}
