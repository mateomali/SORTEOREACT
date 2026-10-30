<?php
declare(strict_types=1);

// Twelve readable base-32 characters retain 60 random bits of the invitation.
function draw_invitation_short_code(string $token): string
{
    if (!preg_match('/^[a-f0-9]{64}$/D', $token)) return '';
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $bits = '';
    foreach (str_split(substr($token, 0, 15)) as $digit) $bits .= str_pad(decbin(hexdec($digit)), 4, '0', STR_PAD_LEFT);
    $code = '';
    foreach (str_split($bits, 5) as $chunk) $code .= $alphabet[bindec($chunk)];
    return $code;
}

function draw_invitation_short_prefix(string $code): ?string
{
    $code = strtoupper($code);
    if (!preg_match('/^[2-9A-HJ-NP-Z]{12}$/D', $code)) return null;
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    $bits = '';
    foreach (str_split($code) as $character) $bits .= str_pad(decbin((int) strpos($alphabet, $character)), 5, '0', STR_PAD_LEFT);
    $prefix = '';
    foreach (str_split($bits, 4) as $chunk) $prefix .= dechex(bindec($chunk));
    return $prefix;
}
