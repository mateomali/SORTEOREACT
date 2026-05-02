-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 01-05-2026 a las 21:56:10
-- Versión del servidor: 11.8.6-MariaDB-log
-- Versión de PHP: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `u552541920_futbol`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `matches`
--

CREATE TABLE `matches` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(120) DEFAULT NULL,
  `match_date` datetime NOT NULL,
  `num_teams` tinyint(3) UNSIGNED NOT NULL DEFAULT 2,
  `max_diff` decimal(4,1) NOT NULL DEFAULT 2.0,
  `status` enum('programado','sorteado','finalizado') NOT NULL DEFAULT 'programado',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `matches`
--

INSERT INTO `matches` (`id`, `title`, `match_date`, `num_teams`, `max_diff`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(3, NULL, '2026-03-18 04:40:00', 2, 2.0, 'programado', NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `match_players`
--

CREATE TABLE `match_players` (
  `id` int(10) UNSIGNED NOT NULL,
  `match_id` int(10) UNSIGNED NOT NULL,
  `player_id` int(10) UNSIGNED NOT NULL,
  `team_number` tinyint(3) UNSIGNED DEFAULT NULL,
  `assigned_position` enum('ARQ','DEF','MED','DEL') DEFAULT NULL,
  `is_goalkeeper` tinyint(1) NOT NULL DEFAULT 0,
  `goals` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `rating` decimal(3,1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `match_players`
--

INSERT INTO `match_players` (`id`, `match_id`, `player_id`, `team_number`, `assigned_position`, `is_goalkeeper`, `goals`, `rating`, `created_at`, `updated_at`) VALUES
(49, 3, 16, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(50, 3, 3, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(51, 3, 13, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(52, 3, 9, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(53, 3, 10, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(54, 3, 17, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(55, 3, 23, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(56, 3, 7, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(57, 3, 24, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(58, 3, 4, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(59, 3, 27, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(60, 3, 18, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(61, 3, 22, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(62, 3, 5, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(63, 3, 11, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(64, 3, 1, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(65, 3, 26, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18'),
(66, 3, 15, NULL, NULL, 0, 0, NULL, '2026-03-18 07:40:18', '2026-03-18 07:40:18');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `match_teams`
--

CREATE TABLE `match_teams` (
  `id` int(10) UNSIGNED NOT NULL,
  `match_id` int(10) UNSIGNED NOT NULL,
  `team_number` tinyint(3) UNSIGNED NOT NULL,
  `team_name` varchar(80) DEFAULT NULL,
  `total_skill` decimal(5,1) NOT NULL DEFAULT 0.0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `players`
--

CREATE TABLE `players` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `positions` varchar(20) NOT NULL,
  `pace` enum('rapido','lento') NOT NULL DEFAULT 'rapido',
  `skill` decimal(3,1) NOT NULL DEFAULT 1.0,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `players`
--

INSERT INTO `players` (`id`, `name`, `positions`, `pace`, `skill`, `active`, `created_at`, `updated_at`) VALUES
(1, 'MARCELO', 'DEF', 'lento', 1.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(2, 'RODRI SUAREZ', 'ARQ/DEF', 'lento', 2.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(3, 'ALEJO', 'DEL', 'rapido', 4.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(4, 'FRANQUITO', 'MED', 'rapido', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(5, 'JAVI', 'DEF', 'rapido', 4.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(6, 'PELA', 'DEL', 'lento', 4.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(7, 'CUERVO', 'MED/DEL', 'lento', 5.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(8, 'NICO', 'MED', 'rapido', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(9, 'AUGUSTO', 'MED', 'rapido', 5.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(10, 'BRIAN', 'DEL', 'rapido', 5.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(11, 'MANU', 'MED', 'rapido', 5.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(12, 'VIKINGO', 'DEF/MED', 'rapido', 5.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(13, 'ANIBAL', 'ARQ/DEL', 'lento', 2.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(14, 'PABLO', 'DEF', 'rapido', 4.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(15, 'MAURI', 'DEL', 'lento', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(16, 'ALE CUERVO', 'DEF', 'rapido', 2.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(17, 'CESAR', 'DEF', 'lento', 4.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(18, 'GUILLE', 'ARQ/DEF', 'lento', 1.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(19, 'SEBACORTEZ', 'DEF', 'lento', 4.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(20, 'TANQUE', 'DEL', 'rapido', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(21, 'SANTI', 'MED', 'rapido', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(22, 'ISMA', 'MED', 'rapido', 4.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(23, 'CRISTIAN', 'DEL', 'lento', 1.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(24, 'FRANCOK', 'DEF', 'rapido', 3.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(25, 'TIMO', 'DEF', 'rapido', 3.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(26, 'MATI ARQ', 'ARQ', 'rapido', 2.5, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04'),
(27, 'GONZA', 'ARQ', 'rapido', 4.0, 1, '2026-03-18 06:59:04', '2026-03-18 06:59:04');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `matches`
--
ALTER TABLE `matches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_matches_date` (`match_date`),
  ADD KEY `idx_matches_status` (`status`);

--
-- Indices de la tabla `match_players`
--
ALTER TABLE `match_players`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_match_player` (`match_id`,`player_id`),
  ADD KEY `idx_match_team` (`match_id`,`team_number`),
  ADD KEY `idx_player_stats` (`player_id`,`goals`,`rating`);

--
-- Indices de la tabla `match_teams`
--
ALTER TABLE `match_teams`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_match_team` (`match_id`,`team_number`);

--
-- Indices de la tabla `players`
--
ALTER TABLE `players`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_players_name` (`name`),
  ADD KEY `idx_players_active` (`active`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `matches`
--
ALTER TABLE `matches`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `match_players`
--
ALTER TABLE `match_players`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT de la tabla `match_teams`
--
ALTER TABLE `match_teams`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `players`
--
ALTER TABLE `players`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `match_players`
--
ALTER TABLE `match_players`
  ADD CONSTRAINT `fk_match_players_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_match_players_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `match_teams`
--
ALTER TABLE `match_teams`
  ADD CONSTRAINT `fk_match_teams_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
