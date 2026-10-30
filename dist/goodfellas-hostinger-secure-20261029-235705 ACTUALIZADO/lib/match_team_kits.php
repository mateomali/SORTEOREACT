<?php
declare(strict_types=1);
require_once __DIR__ . '/repository.php';

function match_team_kit_options(): array
{
    return ['ROSA' => 'Rosa', 'AZUL' => 'Azul', 'NARANJA' => 'Naranja', 'NEGRO' => 'Negro', 'VERDE' => 'Verde', 'CAMISADO' => 'Camisado', 'DESCAMISADO' => 'Descamisado'];
}

function match_team_kits(array $match): array
{
    $count = max(2, min(4, (int) ($match['num_teams'] ?? 2)));
    $kits = json_decode((string) ($match['team_kits_json'] ?? ''), true);
    if (!is_array($kits) && !empty($match['id'])) {
        $teams = repo_match_teams((int) $match['id']);
        if (!$teams) {
            $stmt = db()->prepare('SELECT teams_json FROM match_draw_options WHERE match_id = ? ORDER BY option_number LIMIT 1');
            $stmt->execute([(int) $match['id']]);
            $teams = json_decode((string) ($stmt->fetchColumn() ?: ''), true) ?: [];
        }
        $kits = array_column($teams, 'color_name');
    }
    $kits = is_array($kits) ? array_values($kits) : [];
    $defaults = array_keys(match_team_kit_options());
    return array_map(static fn(int $i): string => isset(match_team_kit_options()[$kits[$i] ?? '']) ? (string) $kits[$i] : $defaults[$i], range(0, $count - 1));
}

function match_validate_team_kits(array $input, int $count): array
{
    $kits = array_map(static fn($value): string => strtoupper(trim((string) $value)), array_slice(array_values($input), 0, $count));
    if (count($kits) !== $count || count(array_unique($kits)) !== $count || array_diff($kits, array_keys(match_team_kit_options()))) throw new RuntimeException('Elegí una camiseta o tipo distinto para cada equipo.');
    return $kits;
}
