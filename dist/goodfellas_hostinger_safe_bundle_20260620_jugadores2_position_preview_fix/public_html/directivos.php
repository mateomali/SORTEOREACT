<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';

require_admin();
ensure_directivos_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    $redirectTo = 'directivos.php';
    try {
        if ($action === 'create_directivo') {
            $name = trim((string) ($_POST['name'] ?? ''));
            $active = isset($_POST['active']) ? 1 : 0;
            if ($name === '') {
                throw new RuntimeException('Completa el nombre del directivo.');
            }
            $stmt = db()->prepare(
                'INSERT INTO directive_members (name, password_hash, password_needs_setup, active)
                 VALUES (:name, :password_hash, 1, :active)'
            );
            $stmt->execute([
                'name' => $name,
                'password_hash' => password_hash('1234', PASSWORD_DEFAULT),
                'active' => $active,
            ]);
            flash('success', 'Directivo creado. Clave inicial: 1234. En el primer ingreso debera cambiarla.');
        } elseif ($action === 'update_directivo') {
            $id = (int) ($_POST['id'] ?? 0);
            $name = trim((string) ($_POST['name'] ?? ''));
            $active = isset($_POST['active']) ? 1 : 0;
            if ($id <= 0 || $name === '') {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare(
                'UPDATE directive_members
                 SET name = :name, active = :active
                 WHERE id = :id'
            );
            $stmt->execute(['id' => $id, 'name' => $name, 'active' => $active]);
            flash('success', 'Directivo actualizado.');
        } elseif ($action === 'reset_directivo_password') {
            $id = (int) ($_POST['id'] ?? 0);
            $member = $id > 0 ? directive_member_by_id($id) : null;
            if (!$member) {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare(
                'UPDATE directive_members
                 SET password_hash = :password_hash,
                     password_needs_setup = 1
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'password_hash' => password_hash('1234', PASSWORD_DEFAULT),
            ]);
            flash('success', 'Clave reiniciada para ' . (string) $member['name'] . '. Clave inicial: 1234. En el proximo ingreso debera cambiarla.');
        } elseif ($action === 'delete_directivo') {
            $id = (int) ($_POST['id'] ?? 0);
            $member = $id > 0 ? directive_member_by_id($id) : null;
            if (!$member) {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare('DELETE FROM directive_members WHERE id = :id');
            $stmt->execute(['id' => $id]);
            flash('success', 'Directivo eliminado: ' . (string) $member['name'] . '.');
        } elseif ($action === 'create_vote_invite') {
            $matchId = (int) ($_POST['match_id'] ?? 0);
            $playerId = (int) ($_POST['player_id'] ?? 0);
            $invite = directive_create_vote_invite($matchId, $playerId);
            flash('success', 'Token para ' . (string) $invite['player_name'] . ': ' . (string) $invite['token']);
            $redirectTo = 'directivos.php#invitar-votantes';
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect($redirectTo);
}

function junta_participant_ids_for_directivos(array $participants): array
{
    return array_values(array_map(
        static fn(array $p): int => (int) $p['id'],
        array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null)
    ));
}

function directivos_match_label(array $match): string
{
    $title = trim((string) ($match['title'] ?? ''));
    return $title !== '' ? $title : ('Fecha #' . (int) $match['id']);
}

$members = directive_members(false);
$activeCount = count(array_filter($members, static fn(array $member): bool => (int) $member['active'] === 1));
$pendingPasswordCount = count(array_filter($members, static fn(array $member): bool => (int) ($member['password_needs_setup'] ?? 0) === 1));
$finalizedMatches = repo_matches("m.status = 'finalizado'");
$latestFinalizedMatch = $finalizedMatches[0] ?? null;
$voteInviteMatches = ($latestFinalizedMatch && directive_voting_is_open($latestFinalizedMatch))
    ? [$latestFinalizedMatch]
    : [];
$voteInvitePlayers = repo_all_players(true);
$voteInviteRowsByMatch = [];
foreach ($voteInviteMatches as $match) {
    $matchId = (int) $match['id'];
    $participantCount = count(junta_participant_ids_for_directivos(repo_match_participants($matchId)));
    $voteInviteRowsByMatch[$matchId] = directive_vote_invites_for_match($matchId, $participantCount);
}

$directivosIslandPayload = [
    'summary' => [
        'total' => count($members),
        'active' => $activeCount,
        'pendingPasswords' => $pendingPasswordCount,
    ],
    'members' => array_map(
        static fn(array $member): array => [
            'id' => (int) $member['id'],
            'name' => (string) $member['name'],
            'active' => (int) $member['active'] === 1,
            'needsPassword' => (int) ($member['password_needs_setup'] ?? 0) === 1,
            'initial' => strtoupper(substr((string) $member['name'], 0, 1)),
        ],
        $members
    ),
    'voteInviteMatches' => array_map(
        static function (array $match) use ($voteInviteRowsByMatch, $voteInvitePlayers): array {
            $matchId = (int) $match['id'];
            $inviteRows = $voteInviteRowsByMatch[$matchId] ?? [];
            $invitedPlayerIds = array_flip(array_map(static fn(array $invite): int => (int) $invite['player_id'], $inviteRows));
            $availableInvitePlayers = array_values(array_filter(
                $voteInvitePlayers,
                static fn(array $player): bool => !isset($invitedPlayerIds[(int) $player['id']])
            ));

            return [
                'id' => $matchId,
                'label' => directivos_match_label($match),
                'date' => date('d/m/Y H:i', strtotime((string) $match['match_date'])),
                'invites' => array_map(
                    static fn(array $invite): array => [
                        'player_name' => (string) $invite['player_name'],
                        'token' => (string) $invite['token'],
                        'vote_complete' => (bool) $invite['vote_complete'],
                    ],
                    $inviteRows
                ),
                'availablePlayers' => array_map(
                    static fn(array $player): array => [
                        'id' => (int) $player['id'],
                        'name' => (string) $player['name'],
                    ],
                    $availableInvitePlayers
                ),
            ];
        },
        $voteInviteMatches
    ),
];

$title = 'Directivos | ' . APP_NAME;
$activePage = 'directivos.php';
$bodyClass = 'page-directivos';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="directivos_page">
  <script type="application/json">
    <?= json_encode($directivosIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
