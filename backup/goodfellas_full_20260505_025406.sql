-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: u552541920_futbol
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `u552541920_futbol`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `u552541920_futbol` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `u552541920_futbol`;

--
-- Table structure for table `captain_drafts`
--

DROP TABLE IF EXISTS `captain_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `captain_drafts` (
  `match_id` int(10) unsigned NOT NULL,
  `captain1_player_id` int(10) unsigned NOT NULL,
  `captain2_player_id` int(10) unsigned NOT NULL,
  `captain3_player_id` int(10) unsigned DEFAULT NULL,
  `captain4_player_id` int(10) unsigned DEFAULT NULL,
  `captain1_token` varchar(64) NOT NULL DEFAULT '',
  `captain2_token` varchar(64) NOT NULL DEFAULT '',
  `captain3_token` varchar(64) DEFAULT NULL,
  `captain4_token` varchar(64) DEFAULT NULL,
  `current_team` tinyint(3) unsigned DEFAULT 1,
  `status` enum('active','completed') NOT NULL DEFAULT 'active',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `turn_version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`match_id`),
  KEY `fk_captain_drafts_captain1` (`captain1_player_id`),
  KEY `fk_captain_drafts_captain2` (`captain2_player_id`),
  CONSTRAINT `fk_captain_drafts_captain1` FOREIGN KEY (`captain1_player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_captain_drafts_captain2` FOREIGN KEY (`captain2_player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_captain_drafts_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `captain_drafts`
--

LOCK TABLES `captain_drafts` WRITE;
/*!40000 ALTER TABLE `captain_drafts` DISABLE KEYS */;
INSERT INTO `captain_drafts` VALUES (28,14,6,NULL,NULL,'2278500f7ebe04d701278644efaaa663','7fc2c2a29b2f5f4799eab7ca210ba4e2',NULL,NULL,NULL,'completed','2026-05-02 00:03:00','2026-05-02 00:07:22',0,'2026-05-02 03:03:00','2026-05-02 03:07:22');
/*!40000 ALTER TABLE `captain_drafts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `captain_picks`
--

DROP TABLE IF EXISTS `captain_picks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `captain_picks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(10) unsigned NOT NULL,
  `player_id` int(10) unsigned NOT NULL,
  `team_number` tinyint(3) unsigned NOT NULL,
  `picked_by_player_id` int(10) unsigned NOT NULL,
  `pick_order` smallint(5) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_captain_pick_player` (`match_id`,`player_id`),
  UNIQUE KEY `uniq_captain_pick_order` (`match_id`,`pick_order`),
  KEY `idx_captain_pick_match_team` (`match_id`,`team_number`),
  KEY `fk_captain_picks_player` (`player_id`),
  KEY `fk_captain_picks_picker` (`picked_by_player_id`),
  CONSTRAINT `fk_captain_picks_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_captain_picks_picker` FOREIGN KEY (`picked_by_player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_captain_picks_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `captain_picks`
--

LOCK TABLES `captain_picks` WRITE;
/*!40000 ALTER TABLE `captain_picks` DISABLE KEYS */;
INSERT INTO `captain_picks` VALUES (76,28,14,1,14,1,'2026-05-02 03:03:00'),(77,28,6,2,6,2,'2026-05-02 03:03:00'),(78,28,12,1,14,3,'2026-05-02 03:04:50'),(79,28,7,2,6,4,'2026-05-02 03:05:01'),(80,28,22,1,14,5,'2026-05-02 03:05:09'),(81,28,9,2,6,6,'2026-05-02 03:05:14'),(82,28,19,1,14,7,'2026-05-02 03:05:19'),(83,28,17,2,6,8,'2026-05-02 03:05:25'),(84,28,8,1,14,9,'2026-05-02 03:05:29'),(85,28,3,2,6,10,'2026-05-02 03:05:32'),(86,28,5,1,14,11,'2026-05-02 03:05:35'),(87,28,24,2,6,12,'2026-05-02 03:05:42'),(88,28,27,1,14,13,'2026-05-02 03:05:49'),(89,28,2,2,6,14,'2026-05-02 03:05:58'),(90,28,16,1,14,15,'2026-05-02 03:06:01'),(91,28,13,2,6,16,'2026-05-02 03:06:05'),(92,28,23,1,14,17,'2026-05-02 03:07:14'),(93,28,18,2,6,18,'2026-05-02 03:07:22');
/*!40000 ALTER TABLE `captain_picks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_awards`
--

DROP TABLE IF EXISTS `match_awards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `match_awards` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(10) unsigned NOT NULL,
  `award_code` varchar(40) NOT NULL,
  `player_id` int(10) unsigned NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_match_award` (`match_id`,`award_code`),
  KEY `idx_awards_player` (`player_id`,`award_code`),
  CONSTRAINT `fk_match_awards_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_match_awards_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_awards`
--

LOCK TABLES `match_awards` WRITE;
/*!40000 ALTER TABLE `match_awards` DISABLE KEYS */;
INSERT INTO `match_awards` VALUES (1,27,'player_of_match',6,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(2,27,'goal_of_week',9,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(3,27,'lyrical',1,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(4,27,'wall',13,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(5,27,'capocannoniere',11,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(6,27,'tractor',11,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(7,27,'guinda',3,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(8,27,'putita',9,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(10,27,'keeper',5,NULL,'2026-05-02 01:52:24','2026-05-02 01:52:24'),(50,28,'player_of_match',16,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(51,28,'goal_of_week',13,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(52,28,'wall',2,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(53,28,'capocannoniere',2,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(54,28,'terminator',3,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(55,28,'tractor',14,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(56,28,'guinda',14,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(57,28,'putita',17,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(58,28,'ghost',9,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(59,28,'keeper',18,NULL,'2026-05-02 03:10:59','2026-05-02 03:10:59'),(60,29,'player_of_match',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(61,29,'goal_of_week',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(62,29,'lyrical',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(63,29,'wall',27,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(64,29,'capocannoniere',9,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(65,29,'terminator',9,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(66,29,'tractor',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(67,29,'guinda',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(68,29,'putita',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(69,29,'ghost',3,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(70,29,'keeper',26,NULL,'2026-05-02 04:36:23','2026-05-02 04:36:23'),(71,30,'player_of_match',1,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(72,30,'lyrical',1,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(73,30,'wall',15,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(74,30,'capocannoniere',3,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(75,30,'terminator',3,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(76,30,'tractor',18,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(77,30,'guinda',6,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(78,30,'putita',6,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(79,30,'ghost',13,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(80,30,'keeper',18,NULL,'2026-05-02 05:15:05','2026-05-02 05:15:05'),(81,31,'player_of_match',11,NULL,'2026-05-02 12:32:24','2026-05-02 12:32:24'),(82,31,'goal_of_week',11,NULL,'2026-05-02 12:32:24','2026-05-02 12:32:24'),(83,31,'capocannoniere',11,NULL,'2026-05-02 12:32:24','2026-05-02 12:32:24'),(84,31,'guinda',11,NULL,'2026-05-02 12:32:24','2026-05-02 12:32:24'),(85,32,'player_of_match',16,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(86,32,'goal_of_week',18,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(87,32,'lyrical',13,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(88,32,'wall',4,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(89,32,'capocannoniere',22,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(90,32,'terminator',1,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(91,32,'tractor',14,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(92,32,'guinda',4,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(93,32,'putita',27,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(94,32,'ghost',22,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(95,32,'keeper',26,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(96,32,'goodfellas',26,NULL,'2026-05-04 04:35:51','2026-05-04 04:35:51'),(97,33,'player_of_match',16,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(98,33,'goal_of_week',5,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(99,33,'lyrical',3,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(100,33,'wall',5,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(101,33,'capocannoniere',5,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(102,33,'terminator',7,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(103,33,'tractor',18,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(104,33,'guinda',22,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(105,33,'putita',26,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(106,33,'ghost',15,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(107,33,'keeper',13,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40'),(108,33,'goodfellas',22,NULL,'2026-05-04 04:43:40','2026-05-04 04:43:40');
/*!40000 ALTER TABLE `match_awards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_players`
--

DROP TABLE IF EXISTS `match_players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `match_players` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(10) unsigned NOT NULL,
  `player_id` int(10) unsigned NOT NULL,
  `team_number` tinyint(3) unsigned DEFAULT NULL,
  `assigned_position` enum('ARQ','DEF','MED','DEL') DEFAULT NULL,
  `is_goalkeeper` tinyint(1) NOT NULL DEFAULT 0,
  `lineup_order` smallint(5) unsigned DEFAULT NULL,
  `formation_line_order` tinyint(3) unsigned DEFAULT NULL,
  `availability_status` enum('convocado','confirmado','baja') NOT NULL DEFAULT 'convocado',
  `goals` smallint(5) unsigned NOT NULL DEFAULT 0,
  `rating` decimal(3,1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_match_player` (`match_id`,`player_id`),
  KEY `idx_match_team` (`match_id`,`team_number`),
  KEY `idx_player_stats` (`player_id`,`goals`,`rating`),
  KEY `idx_match_lineup` (`match_id`,`team_number`,`assigned_position`,`lineup_order`),
  KEY `idx_match_availability` (`match_id`,`availability_status`),
  CONSTRAINT `fk_match_players_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_match_players_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=497 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_players`
--

LOCK TABLES `match_players` WRITE;
/*!40000 ALTER TABLE `match_players` DISABLE KEYS */;
INSERT INTO `match_players` VALUES (277,27,16,1,'DEF',0,1,1,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(278,27,3,1,'DEL',0,2,1,'convocado',3,5.0,'2026-05-02 01:37:48','2026-05-02 02:09:45'),(279,27,13,1,'ARQ',1,3,1,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(280,27,9,1,'MED',0,4,1,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(281,27,10,1,'DEL',0,5,2,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(282,27,17,1,'DEF',0,6,2,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(283,27,7,2,'DEL',0,1,1,'convocado',0,7.5,'2026-05-02 01:37:48','2026-05-02 02:06:39'),(284,27,24,2,'DEF',0,2,1,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(285,27,18,2,'ARQ',1,3,1,'convocado',0,6.0,'2026-05-02 01:37:48','2026-05-02 02:06:39'),(286,27,22,1,'MED',0,7,2,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(287,27,5,1,'DEF',0,8,3,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(288,27,11,2,'MED',0,4,1,'convocado',2,5.0,'2026-05-02 01:37:48','2026-05-02 02:09:45'),(289,27,1,1,'MED',0,9,3,'convocado',1,5.0,'2026-05-02 01:37:48','2026-05-02 02:09:45'),(290,27,8,2,'MED',0,5,2,'convocado',0,7.0,'2026-05-02 01:37:48','2026-05-02 02:06:39'),(291,27,6,2,'DEL',0,6,2,'convocado',1,6.5,'2026-05-02 01:37:48','2026-05-02 02:09:45'),(292,27,21,2,'MED',0,7,3,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(293,27,19,2,'DEF',0,8,2,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(294,27,12,2,'DEF',0,9,3,'convocado',0,5.0,'2026-05-02 01:37:48','2026-05-02 01:52:24'),(295,28,16,1,'DEF',0,1,1,'convocado',1,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(296,28,3,2,'DEL',0,1,1,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(297,28,13,2,'DEL',0,2,2,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(298,28,9,2,'MED',0,3,1,'convocado',3,7.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(299,28,17,2,'DEF',0,4,1,'convocado',0,8.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(300,28,23,1,'DEL',0,2,1,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(301,28,7,2,'MED',0,5,2,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(302,28,24,2,'DEF',0,6,2,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(303,28,27,1,'ARQ',1,3,1,'convocado',0,9.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(304,28,18,2,'DEF',0,7,3,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(305,28,22,1,'MED',0,4,1,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(306,28,5,1,'DEF',0,5,2,'convocado',0,7.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(307,28,8,1,'MED',0,6,2,'convocado',2,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(308,28,14,1,'DEF',0,7,3,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(309,28,6,2,'DEL',0,8,3,'convocado',0,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(310,28,2,2,'ARQ',1,9,1,'convocado',0,9.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(311,28,19,1,'DEF',0,8,4,'convocado',3,5.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(312,28,12,1,'MED',0,9,3,'convocado',0,8.0,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(313,29,16,1,'DEF',0,1,1,'convocado',2,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(314,29,3,1,'DEL',0,2,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(315,29,9,2,'MED',0,1,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(316,29,17,1,'DEF',0,3,2,'convocado',2,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(317,29,7,2,'DEL',0,2,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(318,29,4,2,'MED',0,3,2,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(319,29,27,2,'ARQ',1,4,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(320,29,22,1,'MED',0,4,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(321,29,5,2,'DEF',0,5,1,'convocado',5,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(322,29,11,1,'MED',0,5,2,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(323,29,1,2,'MED',0,6,3,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(324,29,26,1,'ARQ',1,6,1,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(325,29,15,1,'DEL',0,7,2,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(326,29,2,1,'DEF',0,8,3,'convocado',3,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(327,29,19,2,'DEF',0,7,2,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(328,29,20,2,'DEL',0,8,2,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(329,29,25,2,'DEF',0,9,3,'convocado',2,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(330,29,12,1,'MED',0,9,3,'convocado',0,5.0,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(331,30,16,1,'DEF',0,1,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(332,30,3,1,'DEL',0,2,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(333,30,13,1,'ARQ',1,3,1,'convocado',1,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(334,30,10,2,'DEL',0,1,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(335,30,17,2,'DEF',0,2,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(336,30,23,2,'DEL',0,3,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(337,30,7,2,'MED',0,4,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(338,30,24,1,'DEF',0,4,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(339,30,4,1,'MED',0,5,1,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(340,30,18,2,'DEF',0,5,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(341,30,1,2,'MED',0,6,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(342,30,26,2,'ARQ',1,7,1,'convocado',1,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(343,30,15,1,'DEL',0,6,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(344,30,6,1,'DEL',0,7,3,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(345,30,21,1,'MED',0,8,2,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(346,30,19,1,'DEF',0,9,3,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(347,30,25,2,'DEF',0,8,3,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(348,30,12,2,'MED',0,9,3,'convocado',0,5.0,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(349,31,16,1,'DEL',0,1,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(350,31,3,1,'DEL',0,2,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(351,31,13,2,'ARQ',1,1,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(352,31,10,2,'MED',0,2,1,'convocado',4,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(353,31,17,2,'DEF',0,3,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(354,31,23,2,'DEL',0,4,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(355,31,7,1,'MED',0,3,1,'convocado',2,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(356,31,24,2,'DEL',0,5,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(357,31,22,2,'MED',0,6,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(358,31,5,1,'DEF',0,4,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(359,31,11,1,'MED',0,5,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(360,31,1,1,'MED',0,6,3,'convocado',3,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(361,31,26,1,'ARQ',1,7,1,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(362,31,8,1,'MED',0,8,4,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(363,31,21,2,'MED',0,7,3,'convocado',4,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(364,31,19,1,'DEF',0,9,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(365,31,25,2,'MED',0,8,4,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(366,31,12,2,'DEF',0,9,2,'convocado',0,5.0,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(367,32,16,1,'DEF',0,1,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(368,32,13,2,'DEL',0,8,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(369,32,9,1,'MED',0,2,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(370,32,17,1,'DEF',0,3,2,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(371,32,7,2,'MED',0,4,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(372,32,24,1,'DEF',0,4,3,'convocado',0,7.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(373,32,4,2,'MED',0,5,2,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(374,32,27,1,'ARQ',1,5,1,'convocado',1,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(375,32,18,1,'DEF',0,6,4,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(376,32,22,2,'MED',0,6,3,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(377,32,1,1,'MED',0,7,2,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(378,32,26,2,'ARQ',1,1,1,'convocado',0,7.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(379,32,15,2,'DEL',0,9,2,'convocado',1,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(380,32,8,2,'MED',0,7,4,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(381,32,14,1,'DEF',0,8,5,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(382,32,2,2,'DEF',0,2,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(383,32,20,1,'DEL',0,9,1,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(384,32,25,2,'DEF',0,3,2,'convocado',0,5.0,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(385,33,16,1,'DEF',0,1,1,'convocado',4,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(386,33,3,2,'MED',0,1,1,'convocado',2,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(387,33,13,1,'DEL',0,2,1,'convocado',1,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(388,33,23,2,'DEL',0,2,1,'convocado',0,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(389,33,7,1,'DEF',0,3,2,'convocado',2,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(390,33,18,2,'ARQ',1,3,1,'convocado',0,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(391,33,22,2,'DEF',0,4,1,'convocado',0,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(392,33,5,2,'DEF',0,5,2,'convocado',2,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(393,33,26,1,'ARQ',1,4,1,'convocado',0,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(394,33,15,1,'MED',0,5,1,'convocado',1,5.0,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(413,35,16,3,'DEF',0,7,2,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(414,35,3,2,'DEL',0,5,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(415,35,13,1,'ARQ',1,3,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(416,35,9,3,'MED',0,5,2,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(417,35,10,3,'DEL',0,4,2,'convocado',1,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(418,35,17,1,'DEF',0,2,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(419,35,23,3,'DEL',0,3,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(420,35,7,3,'MED',0,2,1,'convocado',4,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(421,35,24,2,'DEF',0,7,5,'convocado',3,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(422,35,4,1,'MED',0,1,1,'convocado',2,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(423,35,27,3,'ARQ',1,6,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(424,35,5,1,'DEF',0,6,2,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(425,35,11,1,'MED',0,5,2,'convocado',2,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(426,35,1,2,'MED',0,8,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(427,35,26,2,'ARQ',1,1,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(428,35,8,1,'MED',0,7,3,'convocado',2,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(429,35,14,2,'DEF',0,2,1,'convocado',1,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(430,35,6,1,'DEL',0,4,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(431,35,2,3,'DEF',0,1,1,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(432,35,21,3,'MED',0,8,3,'convocado',3,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(433,35,19,2,'DEF',0,3,2,'convocado',1,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(434,35,20,1,'DEL',0,8,2,'convocado',0,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(435,35,25,2,'DEF',0,6,4,'convocado',1,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(436,35,12,2,'DEF',0,4,3,'convocado',3,5.0,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(437,36,16,1,'DEF',0,6,3,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(438,36,3,2,'DEL',0,4,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(439,36,13,4,'DEL',0,1,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(440,36,9,4,'MED',0,2,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(441,36,10,3,'DEL',0,2,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(442,36,23,2,'DEL',0,1,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(443,36,7,2,'MED',0,2,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(444,36,24,3,'DEF',0,4,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(445,36,4,1,'MED',0,5,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(446,36,27,2,'ARQ',1,3,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(447,36,18,1,'ARQ',1,1,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(448,36,5,4,'DEF',0,4,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(449,36,11,3,'MED',0,3,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(450,36,1,3,'MED',0,6,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(451,36,26,4,'ARQ',1,6,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(452,36,15,3,'DEL',0,5,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(453,36,8,2,'MED',0,6,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(454,36,14,1,'DEF',0,2,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(455,36,6,1,'DEL',0,4,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(456,36,2,3,'ARQ',1,1,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(457,36,21,4,'MED',0,5,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(458,36,19,4,'DEF',0,3,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(459,36,25,2,'DEF',0,5,1,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(460,36,12,1,'DEF',0,3,2,'convocado',0,NULL,'2026-05-04 06:04:50','2026-05-04 06:05:47'),(461,37,16,1,'DEF',0,1,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(462,37,3,1,'DEL',0,2,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(463,37,13,1,'DEL',0,3,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(464,37,9,2,'MED',0,1,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(465,37,10,1,'DEL',0,4,3,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(466,37,17,2,'DEF',0,2,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(467,37,23,2,'DEL',0,3,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(468,37,7,2,'MED',0,4,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(469,37,24,2,'DEF',0,5,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(470,37,4,2,'MED',0,6,3,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(471,37,27,1,'ARQ',1,5,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(472,37,18,1,'DEF',0,6,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(473,37,22,1,'MED',0,7,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(474,37,5,2,'DEF',0,7,3,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(475,37,11,1,'MED',0,8,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(476,37,1,1,'MED',0,9,3,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(477,37,26,2,'ARQ',1,8,1,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(478,37,15,2,'DEL',0,9,2,'convocado',0,NULL,'2026-05-04 07:18:44','2026-05-04 07:18:56'),(479,38,16,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(480,38,3,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(481,38,9,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(482,38,10,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(483,38,17,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(484,38,24,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(485,38,4,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(486,38,18,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(487,38,22,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(488,38,5,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(489,38,11,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(490,38,26,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(491,38,14,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(492,38,6,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(493,38,2,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(494,38,19,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(495,38,29,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45'),(496,38,12,NULL,NULL,0,NULL,NULL,'convocado',0,NULL,'2026-05-05 05:33:45','2026-05-05 05:33:45');
/*!40000 ALTER TABLE `match_players` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_round_robin_results`
--

DROP TABLE IF EXISTS `match_round_robin_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `match_round_robin_results` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(10) unsigned NOT NULL,
  `home_team_number` tinyint(3) unsigned NOT NULL,
  `away_team_number` tinyint(3) unsigned NOT NULL,
  `leg` tinyint(3) unsigned NOT NULL,
  `home_goals` smallint(5) unsigned DEFAULT NULL,
  `away_goals` smallint(5) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_round_robin_fixture` (`match_id`,`home_team_number`,`away_team_number`,`leg`),
  KEY `idx_round_robin_match` (`match_id`),
  CONSTRAINT `fk_round_robin_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=559 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_round_robin_results`
--

LOCK TABLES `match_round_robin_results` WRITE;
/*!40000 ALTER TABLE `match_round_robin_results` DISABLE KEYS */;
INSERT INTO `match_round_robin_results` VALUES (1,35,1,2,1,3,3,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(2,35,2,1,2,2,1,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(3,35,1,3,1,1,2,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(4,35,3,1,2,2,1,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(5,35,2,3,1,3,1,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(6,35,3,2,2,3,1,'2026-05-04 05:48:05','2026-05-04 05:49:21'),(25,36,1,2,1,5,2,'2026-05-04 06:06:10','2026-05-04 07:18:15'),(27,36,1,3,1,NULL,NULL,'2026-05-04 06:06:10','2026-05-04 06:06:22'),(29,36,1,4,1,NULL,NULL,'2026-05-04 06:06:10','2026-05-04 07:18:15'),(31,36,2,3,1,NULL,NULL,'2026-05-04 06:06:10','2026-05-04 07:18:15'),(33,36,2,4,1,NULL,NULL,'2026-05-04 06:06:10','2026-05-04 07:18:15'),(35,36,3,4,1,1,0,'2026-05-04 06:06:10','2026-05-04 07:18:15'),(63,36,3,1,1,NULL,NULL,'2026-05-04 06:11:02','2026-05-04 07:18:15'),(349,36,4,1,2,NULL,NULL,'2026-05-04 07:11:51','2026-05-04 07:18:15'),(350,36,3,2,2,NULL,NULL,'2026-05-04 07:11:51','2026-05-04 07:18:15'),(351,36,1,3,2,NULL,NULL,'2026-05-04 07:11:51','2026-05-04 07:18:15'),(352,36,4,2,2,NULL,NULL,'2026-05-04 07:11:51','2026-05-04 07:18:15'),(353,36,2,1,2,NULL,NULL,'2026-05-04 07:11:51','2026-05-04 07:18:15'),(354,36,4,3,2,2,2,'2026-05-04 07:11:51','2026-05-04 07:18:15');
/*!40000 ALTER TABLE `match_round_robin_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_teams`
--

DROP TABLE IF EXISTS `match_teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `match_teams` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(10) unsigned NOT NULL,
  `team_number` tinyint(3) unsigned NOT NULL,
  `team_name` varchar(80) DEFAULT NULL,
  `captain_player_id` int(10) unsigned DEFAULT NULL,
  `total_skill` decimal(5,1) NOT NULL DEFAULT 0.0,
  `formation_name` varchar(80) DEFAULT NULL,
  `formation_data` text DEFAULT NULL,
  `color_name` varchar(40) DEFAULT NULL,
  `goals` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_match_team` (`match_id`,`team_number`),
  KEY `idx_match_teams_captain` (`captain_player_id`),
  CONSTRAINT `fk_match_teams_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_teams`
--

LOCK TABLES `match_teams` WRITE;
/*!40000 ALTER TABLE `match_teams` DISABLE KEYS */;
INSERT INTO `match_teams` VALUES (25,27,1,'Equipo 1',NULL,33.5,'1-3-3-2','[{\"id\":16,\"position\":\"DEF\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":13,\"position\":\"ARQ\"},{\"id\":9,\"position\":\"MED\"},{\"id\":10,\"position\":\"DEL\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":22,\"position\":\"MED\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":1,\"position\":\"MED\"}]',NULL,4,'2026-05-02 01:50:36','2026-05-02 02:03:29'),(26,27,2,'Equipo 2',NULL,33.5,'1-3-3-2','[{\"id\":7,\"position\":\"DEL\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":18,\"position\":\"ARQ\"},{\"id\":11,\"position\":\"MED\"},{\"id\":8,\"position\":\"MED\"},{\"id\":6,\"position\":\"DEL\"},{\"id\":21,\"position\":\"MED\"},{\"id\":19,\"position\":\"DEF\"},{\"id\":12,\"position\":\"DEF\"}]',NULL,3,'2026-05-02 01:50:36','2026-05-03 02:16:05'),(27,28,1,'Equipo 1',14,33.0,'1-4-3-1','[{\"id\":16,\"position\":\"DEF\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":22,\"position\":\"MED\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":8,\"position\":\"MED\"},{\"id\":14,\"position\":\"DEF\"},{\"id\":19,\"position\":\"DEF\"},{\"id\":12,\"position\":\"MED\"}]',NULL,6,'2026-05-02 03:07:22','2026-05-03 02:16:05'),(28,28,2,'Equipo 2',6,31.0,'1-3-2-3','[{\"id\":3,\"position\":\"DEL\"},{\"id\":13,\"position\":\"DEL\"},{\"id\":9,\"position\":\"MED\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":7,\"position\":\"MED\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":18,\"position\":\"DEF\"},{\"id\":6,\"position\":\"DEL\"},{\"id\":2,\"position\":\"ARQ\"}]',NULL,3,'2026-05-02 03:07:22','2026-05-03 02:16:05'),(29,29,1,'Equipo 1',NULL,33.5,'1-3-3-2','[{\"id\":16,\"position\":\"DEF\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":22,\"position\":\"MED\"},{\"id\":11,\"position\":\"MED\"},{\"id\":26,\"position\":\"ARQ\"},{\"id\":15,\"position\":\"DEL\"},{\"id\":2,\"position\":\"DEF\"},{\"id\":12,\"position\":\"MED\"}]','NARANJA',7,'2026-05-02 04:34:43','2026-05-03 02:16:05'),(30,29,2,'Equipo 2',NULL,33.5,'1-3-3-2','[{\"id\":9,\"position\":\"MED\"},{\"id\":7,\"position\":\"DEL\"},{\"id\":4,\"position\":\"MED\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":1,\"position\":\"MED\"},{\"id\":19,\"position\":\"DEF\"},{\"id\":20,\"position\":\"DEL\"},{\"id\":25,\"position\":\"DEF\"}]','AZUL',7,'2026-05-02 04:34:43','2026-05-03 02:16:05'),(31,30,1,'Equipo 1',NULL,29.0,'1-3-2-3','[{\"id\":16,\"position\":\"DEF\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":13,\"position\":\"ARQ\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":4,\"position\":\"MED\"},{\"id\":15,\"position\":\"DEL\"},{\"id\":6,\"position\":\"DEL\"},{\"id\":21,\"position\":\"MED\"},{\"id\":19,\"position\":\"DEF\"}]','ROSA',1,'2026-05-02 05:14:20','2026-05-02 05:14:35'),(32,30,2,'Equipo 2',NULL,29.0,'1-3-3-2','[{\"id\":10,\"position\":\"DEL\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":7,\"position\":\"MED\"},{\"id\":18,\"position\":\"DEF\"},{\"id\":1,\"position\":\"MED\"},{\"id\":26,\"position\":\"ARQ\"},{\"id\":25,\"position\":\"DEF\"},{\"id\":12,\"position\":\"MED\"}]','AZUL',1,'2026-05-02 05:14:20','2026-05-02 05:14:35'),(33,31,1,'Equipo 1',NULL,32.0,'1-2-4-2','[{\"id\":16,\"position\":\"DEL\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":7,\"position\":\"MED\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":11,\"position\":\"MED\"},{\"id\":1,\"position\":\"MED\"},{\"id\":26,\"position\":\"ARQ\"},{\"id\":8,\"position\":\"MED\"},{\"id\":19,\"position\":\"DEF\"}]','NEGRO',5,'2026-05-02 12:12:20','2026-05-02 12:23:36'),(34,31,2,'Equipo 2',NULL,31.5,'1-2-4-2','[{\"id\":13,\"position\":\"ARQ\"},{\"id\":10,\"position\":\"MED\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":24,\"position\":\"DEL\"},{\"id\":22,\"position\":\"MED\"},{\"id\":21,\"position\":\"MED\"},{\"id\":25,\"position\":\"MED\"},{\"id\":12,\"position\":\"DEF\"}]','AZUL',8,'2026-05-02 12:12:20','2026-05-02 12:23:36'),(35,32,1,'Equipo 1',NULL,29.0,'1-5-2-1','[{\"id\":16,\"position\":\"DEF\"},{\"id\":9,\"position\":\"MED\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":18,\"position\":\"DEF\"},{\"id\":1,\"position\":\"MED\"},{\"id\":14,\"position\":\"DEF\"},{\"id\":20,\"position\":\"DEL\"}]','ROSA',1,'2026-05-04 04:32:23','2026-05-04 04:35:51'),(36,32,2,'Equipo 2',NULL,29.5,'1-2-4-2','[{\"id\":26,\"position\":\"ARQ\"},{\"id\":2,\"position\":\"DEF\"},{\"id\":25,\"position\":\"DEF\"},{\"id\":7,\"position\":\"MED\"},{\"id\":4,\"position\":\"MED\"},{\"id\":22,\"position\":\"MED\"},{\"id\":8,\"position\":\"MED\"},{\"id\":13,\"position\":\"DEL\"},{\"id\":15,\"position\":\"DEL\"}]','AZUL',1,'2026-05-04 04:32:23','2026-05-04 04:35:51'),(37,33,1,'Equipo 1',NULL,15.0,'1-2-1-1','[{\"id\":16,\"position\":\"DEF\"},{\"id\":13,\"position\":\"DEL\"},{\"id\":7,\"position\":\"DEF\"},{\"id\":26,\"position\":\"ARQ\"},{\"id\":15,\"position\":\"MED\"}]','ROSA',8,'2026-05-04 04:42:16','2026-05-04 04:42:49'),(38,33,2,'Equipo 2',NULL,15.0,'1-2-1-1','[{\"id\":3,\"position\":\"MED\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":18,\"position\":\"ARQ\"},{\"id\":22,\"position\":\"DEF\"},{\"id\":5,\"position\":\"DEF\"}]','AZUL',4,'2026-05-04 04:42:16','2026-05-04 04:42:49'),(41,35,1,'Equipo 1',NULL,28.5,'1-2-3-2','[{\"id\":4,\"position\":\"MED\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":13,\"position\":\"ARQ\"},{\"id\":6,\"position\":\"DEL\"},{\"id\":11,\"position\":\"MED\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":8,\"position\":\"MED\"},{\"id\":20,\"position\":\"DEL\"}]','ROSA',6,'2026-05-04 05:27:42','2026-05-04 05:48:13'),(42,35,2,'Equipo 2',NULL,28.5,'1-5-1-1','[{\"id\":26,\"position\":\"ARQ\"},{\"id\":14,\"position\":\"DEF\"},{\"id\":19,\"position\":\"DEF\"},{\"id\":12,\"position\":\"DEF\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":25,\"position\":\"DEF\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":1,\"position\":\"MED\"}]','AZUL',9,'2026-05-04 05:27:42','2026-05-04 05:48:13'),(43,35,3,'Equipo 3',NULL,28.0,'1-2-3-2','[{\"id\":2,\"position\":\"DEF\"},{\"id\":7,\"position\":\"MED\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":10,\"position\":\"DEL\"},{\"id\":9,\"position\":\"MED\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":16,\"position\":\"DEF\"},{\"id\":21,\"position\":\"MED\"}]','NARANJA',8,'2026-05-04 05:27:42','2026-05-04 05:48:13'),(44,36,1,'Equipo 1',NULL,20.5,'1-3-1-1','[{\"id\":18,\"position\":\"ARQ\"},{\"id\":14,\"position\":\"DEF\"},{\"id\":12,\"position\":\"DEF\"},{\"id\":6,\"position\":\"DEL\"},{\"id\":4,\"position\":\"MED\"},{\"id\":16,\"position\":\"DEF\"}]','ROSA',0,'2026-05-04 06:05:47','2026-05-04 07:18:36'),(45,36,2,'Equipo 2',NULL,20.5,'1-1-2-2','[{\"id\":23,\"position\":\"DEL\"},{\"id\":7,\"position\":\"MED\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":25,\"position\":\"DEF\"},{\"id\":8,\"position\":\"MED\"}]','AZUL',0,'2026-05-04 06:05:47','2026-05-04 07:18:36'),(46,36,3,'Equipo 3',NULL,20.5,'1-1-2-2','[{\"id\":2,\"position\":\"ARQ\"},{\"id\":10,\"position\":\"DEL\"},{\"id\":11,\"position\":\"MED\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":15,\"position\":\"DEL\"},{\"id\":1,\"position\":\"MED\"}]','NARANJA',0,'2026-05-04 06:05:47','2026-05-04 07:18:36'),(47,36,4,'Equipo 4',NULL,20.5,'1-2-2-1','[{\"id\":13,\"position\":\"DEL\"},{\"id\":9,\"position\":\"MED\"},{\"id\":19,\"position\":\"DEF\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":21,\"position\":\"MED\"},{\"id\":26,\"position\":\"ARQ\"}]','NEGRO',0,'2026-05-04 06:05:47','2026-05-04 07:18:36'),(48,37,1,'Equipo 1',NULL,30.5,'1-2-3-3','[{\"id\":16,\"position\":\"DEF\"},{\"id\":3,\"position\":\"DEL\"},{\"id\":13,\"position\":\"DEL\"},{\"id\":10,\"position\":\"DEL\"},{\"id\":27,\"position\":\"ARQ\"},{\"id\":18,\"position\":\"DEF\"},{\"id\":22,\"position\":\"MED\"},{\"id\":11,\"position\":\"MED\"},{\"id\":1,\"position\":\"MED\"}]','ROSA',0,'2026-05-04 07:18:56','2026-05-04 07:19:15'),(49,37,2,'Equipo 2',NULL,30.5,'1-3-3-2','[{\"id\":9,\"position\":\"MED\"},{\"id\":17,\"position\":\"DEF\"},{\"id\":23,\"position\":\"DEL\"},{\"id\":7,\"position\":\"MED\"},{\"id\":24,\"position\":\"DEF\"},{\"id\":4,\"position\":\"MED\"},{\"id\":5,\"position\":\"DEF\"},{\"id\":26,\"position\":\"ARQ\"},{\"id\":15,\"position\":\"DEL\"}]','AZUL',0,'2026-05-04 07:18:56','2026-05-04 07:19:15');
/*!40000 ALTER TABLE `match_teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `matches`
--

DROP TABLE IF EXISTS `matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `matches` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(120) DEFAULT NULL,
  `match_date` datetime NOT NULL,
  `num_teams` tinyint(3) unsigned NOT NULL DEFAULT 2,
  `players_per_team` tinyint(3) unsigned NOT NULL DEFAULT 9,
  `max_diff` decimal(4,1) NOT NULL DEFAULT 2.0,
  `status` enum('programado','sorteado','finalizado') NOT NULL DEFAULT 'programado',
  `draw_mode` enum('none','random','captains','manual') NOT NULL DEFAULT 'none',
  `draw_started_at` datetime DEFAULT NULL,
  `draw_completed_at` datetime DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `formation_edit_deadline` datetime DEFAULT NULL,
  `public_token` varchar(64) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `result_notes` text DEFAULT NULL,
  `round_robin_legs` tinyint(3) unsigned NOT NULL DEFAULT 2,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_matches_public_token` (`public_token`),
  KEY `idx_matches_date` (`match_date`),
  KEY `idx_matches_status` (`status`),
  KEY `idx_matches_draw_mode` (`draw_mode`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `matches`
--

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
INSERT INTO `matches` VALUES (27,NULL,'2026-05-01 22:00:00',2,9,0.0,'finalizado','random','2026-05-01 22:50:29','2026-05-01 22:50:36','2026-05-01 23:48:46','2026-05-01 21:00:00',NULL,NULL,NULL,2,'2026-05-02 01:37:48','2026-05-02 02:48:46'),(28,NULL,'2026-05-02 00:00:00',2,9,0.5,'finalizado','captains','2026-05-02 00:03:00','2026-05-02 00:07:22','2026-05-02 00:10:59','2026-05-01 23:00:00',NULL,NULL,NULL,2,'2026-05-02 03:02:49','2026-05-02 03:10:59'),(29,NULL,'2026-05-02 00:00:00',2,9,0.0,'finalizado','random','2026-05-02 01:34:43','2026-05-02 01:34:43','2026-05-02 01:36:23','2026-05-01 23:00:00',NULL,NULL,NULL,2,'2026-05-02 03:08:43','2026-05-02 04:36:23'),(30,NULL,'2026-05-02 02:00:00',2,9,0.0,'finalizado','random','2026-05-02 02:14:20','2026-05-02 02:14:20','2026-05-02 02:15:05','2026-05-02 01:00:00',NULL,NULL,NULL,2,'2026-05-02 05:12:24','2026-05-02 05:15:05'),(31,NULL,'2026-05-02 09:00:00',2,9,0.5,'finalizado','random','2026-05-02 09:12:20','2026-05-02 09:12:20','2026-05-02 09:32:24','2026-05-02 08:00:00',NULL,NULL,NULL,2,'2026-05-02 12:02:41','2026-05-02 12:32:24'),(32,NULL,'2026-05-02 09:00:00',2,9,0.5,'finalizado','random','2026-05-04 01:32:23','2026-05-04 01:32:23','2026-05-04 01:35:51','2026-05-02 08:00:00',NULL,NULL,NULL,2,'2026-05-02 12:51:01','2026-05-04 04:35:51'),(33,NULL,'2026-05-04 01:00:00',2,5,0.0,'finalizado','random','2026-05-04 01:42:16','2026-05-04 01:42:16','2026-05-04 01:43:40','2026-05-04 00:00:00',NULL,NULL,NULL,2,'2026-05-04 04:41:47','2026-05-04 04:43:40'),(35,NULL,'2026-05-04 02:00:00',3,8,0.5,'finalizado','random','2026-05-04 02:27:42','2026-05-04 02:27:42','2026-05-04 03:03:33','2026-05-04 01:00:00',NULL,NULL,NULL,2,'2026-05-04 05:26:45','2026-05-04 06:03:33'),(36,NULL,'2026-05-04 03:00:00',4,6,0.0,'finalizado','random','2026-05-04 03:05:47','2026-05-04 03:05:47','2026-05-04 03:32:38','2026-05-04 02:00:00',NULL,NULL,NULL,2,'2026-05-04 06:04:50','2026-05-04 07:11:51'),(37,NULL,'2026-05-04 04:00:00',2,9,0.0,'finalizado','random','2026-05-04 04:18:56','2026-05-04 04:18:56','2026-05-04 04:19:09','2026-05-04 03:00:00',NULL,NULL,NULL,2,'2026-05-04 07:18:44','2026-05-04 07:19:09'),(38,NULL,'2026-05-05 02:00:00',2,9,0.5,'programado','none',NULL,NULL,NULL,'2026-05-05 01:00:00',NULL,NULL,NULL,2,'2026-05-05 05:33:45','2026-05-05 05:33:45');
/*!40000 ALTER TABLE `matches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `players` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `positions` varchar(20) NOT NULL,
  `pace` enum('rapido','lento') NOT NULL DEFAULT 'rapido',
  `skill` decimal(3,1) NOT NULL DEFAULT 1.0,
  `technique` decimal(3,1) DEFAULT NULL,
  `rhythm` decimal(3,1) DEFAULT NULL,
  `defense_physical` decimal(3,1) DEFAULT NULL,
  `attack` decimal(3,1) DEFAULT NULL,
  `teamwork` decimal(3,1) DEFAULT NULL,
  `goalkeeper_skill` decimal(3,1) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_players_name` (`name`),
  KEY `idx_players_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `players`
--

LOCK TABLES `players` WRITE;
/*!40000 ALTER TABLE `players` DISABLE KEYS */;
INSERT INTO `players` VALUES (1,'MARCELO','MED','lento',2.7,6.0,2.0,2.0,2.0,1.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:29:14'),(2,'RODRI SUAREZ','ARQ/DEF','lento',2.5,2.5,2.0,3.0,2.5,2.5,2.5,1,'2026-03-18 06:59:04','2026-05-05 04:36:22'),(3,'ALEJO','DEL','rapido',3.8,4.0,4.0,3.0,4.0,4.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(4,'FRANQUITO','MED','rapido',3.2,3.0,4.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(5,'JAVI','DEF','lento',3.0,3.0,3.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:53:52'),(6,'PELA','DEL','lento',4.4,5.0,3.0,5.0,6.0,2.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:53:52'),(7,'CUERVO','MED/DEL','lento',4.6,6.0,3.0,5.0,6.0,2.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:53:52'),(8,'NICO','MED','rapido',4.1,5.0,4.0,2.0,5.0,4.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:29:14'),(9,'AUGUSTO','MED','rapido',4.0,5.0,5.0,4.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:10:27'),(10,'BRIAN','DEL','lento',5.1,6.0,3.0,5.0,6.0,5.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:53:52'),(11,'MANU','MED','rapido',5.3,5.0,6.0,6.0,5.0,4.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:30:56'),(12,'VIKINGO','DEF/MED','rapido',4.6,4.0,6.0,3.0,5.0,5.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:49:30'),(13,'ANIBAL','ARQ/DEL','lento',2.2,2.0,2.0,3.0,2.0,2.0,2.0,1,'2026-03-18 06:59:04','2026-05-05 05:29:14'),(14,'PABLO','DEF','rapido',4.0,3.0,5.0,6.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:31:47'),(15,'MAURI','DEL','lento',2.8,3.0,2.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(16,'ALE CUERVO','DEF','rapido',3.2,3.0,4.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:21:46'),(17,'CESAR','DEF','lento',4.0,4.0,3.0,6.0,3.0,4.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:53:52'),(18,'GUILLE','ARQ/DEF','lento',2.0,1.0,1.0,2.0,1.0,3.0,2.0,1,'2026-03-18 06:59:04','2026-05-05 05:29:14'),(19,'SEBACORTEZ','DEF','lento',3.4,4.0,2.0,3.0,4.0,4.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(20,'TANQUE','DEL','rapido',3.2,3.0,4.0,3.0,3.0,3.0,NULL,0,'2026-03-18 06:59:04','2026-05-05 05:06:47'),(21,'SANTI','MED','rapido',3.2,3.0,4.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(22,'ISMA','MED','rapido',4.4,5.0,4.0,3.0,5.0,5.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(23,'CRISTIAN','DEL','lento',1.6,1.0,2.0,3.0,1.0,1.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(24,'FRANCOK','DEF','rapido',3.2,3.0,4.0,3.0,3.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(25,'TIMO','DEF','rapido',3.2,2.0,4.0,5.0,2.0,3.0,NULL,1,'2026-03-18 06:59:04','2026-05-05 05:09:07'),(26,'MATI ARQ','ARQ','rapido',2.7,2.5,4.0,3.0,2.5,2.5,2.5,1,'2026-03-18 06:59:04','2026-05-05 05:29:14'),(27,'GONZA','ARQ','rapido',3.9,4.0,4.0,3.0,4.0,4.0,4.0,1,'2026-03-18 06:59:04','2026-05-05 05:00:13'),(29,'TEBO','MED/DEL','rapido',5.0,5.0,6.0,4.0,5.0,5.0,NULL,1,'2026-05-05 04:50:25','2026-05-05 05:50:00');
/*!40000 ALTER TABLE `players` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'u552541920_futbol'
--

--
-- Dumping routines for database 'u552541920_futbol'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-05  2:54:06
