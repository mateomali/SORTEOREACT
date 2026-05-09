<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';

unset(
    $_SESSION['is_admin'],
    $_SESSION['directivo_id'],
    $_SESSION['directivo_name'],
    $_SESSION['pending_directivo_id'],
    $_SESSION['pending_directivo_name'],
    $_SESSION['user_id'],
    $_SESSION['username'],
    $_SESSION['user_role'],
    $_SESSION['player_id'],
    $_SESSION['player_name'],
    $_SESSION['guest_vote_invite_id'],
    $_SESSION['guest_vote_match_id'],
    $_SESSION['guest_vote_voter_id'],
    $_SESSION['guest_vote_name']
);
flash('success', 'Sesion cerrada.');
redirect('index.php');
