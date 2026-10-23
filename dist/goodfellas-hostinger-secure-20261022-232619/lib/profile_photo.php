<?php
declare(strict_types=1);

function profile_update_own_photo(int $playerId, array $file): void
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Elegí una imagen válida para subir.');
    }
    $tmp = (string) ($file['tmp_name'] ?? '');
    if (!is_uploaded_file($tmp) || filesize($tmp) > 3 * 1024 * 1024) {
        throw new RuntimeException('La imagen debe ser válida y no superar 3 MB.');
    }
    $info = @getimagesize($tmp);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
    if (!isset($extensions[$mime])) {
        throw new RuntimeException('Usá una imagen JPG, PNG o WEBP.');
    }
    $dir = __DIR__ . '/../uploads/players';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo preparar la carpeta de fotos.');
    }
    $path = 'uploads/players/player-' . $playerId . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
    $absolutePath = __DIR__ . '/../' . $path;
    if (!move_uploaded_file($tmp, $absolutePath)) {
        throw new RuntimeException('No se pudo guardar la foto.');
    }
    try {
        // Resolve ownership again in the mutation; never accept a player ID from the form.
        $stmt = db()->prepare('UPDATE players p INNER JOIN site_users u ON u.player_id = p.id SET p.photo_path = :path, p.photo_position_x = 50, p.photo_position_y = 50, p.photo_zoom = 100 WHERE p.id = :player AND u.id = :user AND u.active = 1');
        $stmt->execute(['path' => $path, 'player' => $playerId, 'user' => current_user_id()]);
        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException('Tu cuenta ya no está vinculada a este jugador.');
        }
    } catch (Throwable $e) {
        @unlink($absolutePath);
        throw new RuntimeException('No se pudo actualizar tu foto. Volvé a intentarlo.', 0, $e);
    }
}
