import { SystemStatusIsland } from './SystemStatusIsland.jsx';
import { HistorySearchIsland } from './HistorySearchIsland.jsx';
import { PlayerListControlsIsland } from './PlayerListControlsIsland.jsx';
import { PlayerCreateIsland } from './PlayerCreateIsland.jsx';
import { EncounterHistoryControlsIsland } from './EncounterHistoryControlsIsland.jsx';
import { ParticipantControlsIsland } from './ParticipantControlsIsland.jsx';
import { FinishValuationControlsIsland } from './FinishValuationControlsIsland.jsx';
import { CaptainTokensIsland } from './CaptainTokensIsland.jsx';
import { ManualTeamsSearchAssistIsland } from './ManualTeamsSearchAssistIsland.jsx';
import { StatsPlayerSearchIsland } from './StatsPlayerSearchIsland.jsx';
import { Jugadores2PageIsland } from './Jugadores2PageIsland.jsx';

const registry = {
  captain_tokens: CaptainTokensIsland,
  encounter_history_controls: EncounterHistoryControlsIsland,
  finish_valuation_controls: FinishValuationControlsIsland,
  home_history_search: HistorySearchIsland,
  jugadores2_page: Jugadores2PageIsland,
  manual_teams_search_assist: ManualTeamsSearchAssistIsland,
  participant_controls: ParticipantControlsIsland,
  player_create: PlayerCreateIsland,
  player_list_controls: PlayerListControlsIsland,
  stats_player_search: StatsPlayerSearchIsland,
  system_status: SystemStatusIsland,
};

export function ReactIslandRegistry({ root }) {
  const islandName = root.dataset.reactIsland || '';
  const Component = registry[islandName];

  if (!Component) {
    return null;
  }

  return <Component root={root} />;
}
