<?php
declare(strict_types=1);

/**
 * Modo de valoraciones por fecha (matches.valuation_mode).
 * Permite definir si al finalizar la fecha se cargan puntajes, premios o ambos.
 */

function match_valuation_modes(): array
{
    return [
        'both' => 'Puntajes y premios',
        'ratings' => 'Solo puntajes',
        'awards' => 'Solo premios',
    ];
}

/**
 * Modo preseleccionado al crear una fecha nueva.
 * Las fechas ya cargadas conservan su propio modo.
 */
function match_valuation_default_mode(): string
{
    return 'awards';
}

function normalize_match_valuation_mode(mixed $value): string
{
    $mode = is_string($value) ? strtolower(trim($value)) : '';
    return array_key_exists($mode, match_valuation_modes()) ? $mode : 'both';
}

function match_valuation_mode(array $match): string
{
    return normalize_match_valuation_mode($match['valuation_mode'] ?? 'both');
}

function match_valuation_mode_label(mixed $mode): string
{
    return match_valuation_modes()[normalize_match_valuation_mode($mode)];
}

function match_valuation_mode_description(mixed $mode): string
{
    return match (normalize_match_valuation_mode($mode)) {
        'ratings' => 'Esta fecha carga solo puntajes: los premios no se piden al finalizar.',
        'awards' => 'Esta fecha carga solo premios: los puntajes no se piden al finalizar.',
        default => 'Esta fecha carga puntajes y premios al finalizar.',
    };
}

function match_valuation_includes_ratings(mixed $mode): bool
{
    return in_array(normalize_match_valuation_mode($mode), ['both', 'ratings'], true);
}

function match_valuation_includes_awards(mixed $mode): bool
{
    return in_array(normalize_match_valuation_mode($mode), ['both', 'awards'], true);
}

function match_valuation_scope_text(mixed $mode): string
{
    return match (normalize_match_valuation_mode($mode)) {
        'ratings' => 'puntajes',
        'awards' => 'premios',
        default => 'puntajes y premios',
    };
}

/**
 * Texto de cierre del listado de fechas: que falta cargar en esta fecha.
 */
function match_valuation_pending_note(mixed $mode, bool $missingRatings, bool $missingAwards): string
{
    if ($missingRatings && $missingAwards) {
        return 'Resultado cargado. Faltan puntajes y premios por completar.';
    }
    if ($missingRatings) {
        return 'Resultado cargado. Faltan puntajes por completar.';
    }
    if ($missingAwards) {
        return 'Resultado cargado. Faltan premios por completar.';
    }
    return 'Fecha cerrada. Resultado y detalle disponibles.';
}
