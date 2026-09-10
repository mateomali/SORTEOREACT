import { useEffect, useState } from 'react';

const registry = {
  backup_page: () => import('./BackupPageIsland.jsx').then((module) => module.BackupPageIsland),
  card_design_previews_page: () => import('./CardDesignPreviewsPageIsland.jsx').then((module) => module.CardDesignPreviewsPageIsland),
  capitanes_page: () => import('./CaptainsPageIsland.jsx').then((module) => module.CaptainsPageIsland),
  captain_tokens: () => import('./CaptainTokensIsland.jsx').then((module) => module.CaptainTokensIsland),
  config_page: () => import('./ConfigPageIsland.jsx').then((module) => module.ConfigPageIsland),
  directivos_page: () => import('./DirectivosPageIsland.jsx').then((module) => module.DirectivosPageIsland),
  encounter_history_controls: () => import('./EncounterHistoryControlsIsland.jsx').then((module) => module.EncounterHistoryControlsIsland),
  encuentros_page: () => import('./EncountersPageIsland.jsx').then((module) => module.EncountersPageIsland),
  equipos_manual_page: () => import('./EquiposManualPageIsland.jsx').then((module) => module.EquiposManualPageIsland),
  finish_valuation_controls: () => import('./FinishValuationControlsIsland.jsx').then((module) => module.FinishValuationControlsIsland),
  home_history_search: () => import('./HistorySearchIsland.jsx').then((module) => module.HistorySearchIsland),
  junta_votaciones_page: () => import('./JuntaVotacionesPageIsland.jsx').then((module) => module.JuntaVotacionesPageIsland),
  jugadores_card_preview_page: () => import('./JugadoresCardPreviewPageIsland.jsx').then((module) => module.JugadoresCardPreviewPageIsland),
  jugadores2_page: () => import('./Jugadores2PageIsland.jsx').then((module) => module.Jugadores2PageIsland),
  login_page: () => import('./LoginPageIsland.jsx').then((module) => module.LoginPageIsland),
  manual_teams_search_assist: () => import('./ManualTeamsSearchAssistIsland.jsx').then((module) => module.ManualTeamsSearchAssistIsland),
  migrar_csv_page: () => import('./MigrarCsvPageIsland.jsx').then((module) => module.MigrarCsvPageIsland),
  mis_valoraciones_page: () => import('./MisValoracionesPageIsland.jsx').then((module) => module.MisValoracionesPageIsland),
  participant_controls: () => import('./ParticipantControlsIsland.jsx').then((module) => module.ParticipantControlsIsland),
  player_create: () => import('./PlayerCreateIsland.jsx').then((module) => module.PlayerCreateIsland),
  player_list_controls: () => import('./PlayerListControlsIsland.jsx').then((module) => module.PlayerListControlsIsland),
  perfil_page: () => import('./ProfilePageIsland.jsx').then((module) => module.ProfilePageIsland),
  sorteo_legacy_page: () => import('./SorteoLegacyPageIsland.jsx').then((module) => module.SorteoLegacyPageIsland),
  sorteo_multiple_page: () => import('./SorteoMultiplePageIsland.jsx').then((module) => module.SorteoMultiplePageIsland),
  stats_player_search: () => import('./StatsPlayerSearchIsland.jsx').then((module) => module.StatsPlayerSearchIsland),
  system_status: () => import('./SystemStatusIsland.jsx').then((module) => module.SystemStatusIsland),
  usuarios_page: () => import('./UsuariosPageIsland.jsx').then((module) => module.UsuariosPageIsland),
  votar_sorteo_page: () => import('./VotarSorteoPageIsland.jsx').then((module) => module.VotarSorteoPageIsland),
};

export function ReactIslandRegistry({ root }) {
  const islandName = root.dataset.reactIsland || '';
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    let active = true;
    const load = registry[islandName];
    setComponent(null);

    if (!load) {
      return () => {
        active = false;
      };
    }

    load()
      .then((LoadedComponent) => {
        if (active) {
          setComponent(() => LoadedComponent);
        }
      })
      .catch((error) => {
        console.error(`No se pudo cargar la isla React "${islandName}".`, error);
      });

    return () => {
      active = false;
    };
  }, [islandName]);

  if (!Component) {
    return null;
  }

  return <Component root={root} />;
}
