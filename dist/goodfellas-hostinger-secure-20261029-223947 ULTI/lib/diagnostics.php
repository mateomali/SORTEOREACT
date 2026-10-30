<?php
declare(strict_types=1);

function gf_diagnostics_dir(): string
{
    $dir = __DIR__ . '/../logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $htaccess = $dir . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents(
            $htaccess,
            "Require all denied\nDeny from all\n",
            LOCK_EX
        );
    }

    return $dir;
}

function gf_diagnostics_log_path(): string
{
    return gf_diagnostics_dir() . '/runtime.log';
}

function gf_diagnostics_clean_context(array $context): array
{
    $blockedKeys = ['password', 'pass', 'token', 'PHPSESSID', 'cookie', 'authorization'];
    $clean = [];
    foreach ($context as $key => $value) {
        $keyText = (string) $key;
        foreach ($blockedKeys as $blocked) {
            if (stripos($keyText, $blocked) !== false) {
                $clean[$keyText] = '[redacted]';
                continue 2;
            }
        }
        if (is_scalar($value) || $value === null) {
            $text = (string) $value;
            $clean[$keyText] = strlen($text) > 1000 ? substr($text, 0, 1000) . '...[truncated]' : $value;
        } elseif (is_array($value)) {
            $clean[$keyText] = gf_diagnostics_clean_context($value);
        } else {
            $clean[$keyText] = '[non-scalar]';
        }
    }
    return $clean;
}

function gf_log_event(string $type, array $context = []): void
{
    $entry = [
        'ts' => date('c'),
        'type' => $type,
        'request' => [
            'method' => (string) ($_SERVER['REQUEST_METHOD'] ?? ''),
            'uri' => (string) ($_SERVER['REQUEST_URI'] ?? ''),
            'script' => basename((string) ($_SERVER['SCRIPT_NAME'] ?? '')),
            'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
        ],
        'context' => gf_diagnostics_clean_context($context),
    ];

    $line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (is_string($line)) {
        @file_put_contents(gf_diagnostics_log_path(), $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

function gf_install_diagnostics(string $scope): void
{
    @ini_set('log_errors', '1');
    @ini_set('error_log', gf_diagnostics_log_path());

    gf_log_event('request_start', ['scope' => $scope]);

    set_error_handler(static function (int $severity, string $message, string $file, int $line) use ($scope): bool {
        if ((error_reporting() & $severity) === 0) {
            return false;
        }

        gf_log_event('php_error', [
            'scope' => $scope,
            'severity' => $severity,
            'message' => $message,
            'file' => basename($file),
            'line' => $line,
        ]);

        return false;
    });

    register_shutdown_function(static function () use ($scope): void {
        $error = error_get_last();
        if (!$error) {
            return;
        }

        $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR];
        if (!in_array((int) ($error['type'] ?? 0), $fatalTypes, true)) {
            return;
        }

        gf_log_event('php_fatal', [
            'scope' => $scope,
            'type' => (int) ($error['type'] ?? 0),
            'message' => (string) ($error['message'] ?? ''),
            'file' => basename((string) ($error['file'] ?? '')),
            'line' => (int) ($error['line'] ?? 0),
        ]);
    });
}

function gf_diagnostics_tail(int $maxLines = 200): string
{
    $path = gf_diagnostics_log_path();
    if (!is_file($path)) {
        return '';
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($lines)) {
        return '';
    }

    return implode(PHP_EOL, array_slice($lines, -max(1, $maxLines)));
}

function gf_diagnostics_clear(): void
{
    @file_put_contents(gf_diagnostics_log_path(), '', LOCK_EX);
}
