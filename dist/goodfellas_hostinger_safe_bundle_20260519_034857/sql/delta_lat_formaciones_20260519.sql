-- Goodfellas - delta LAT / formaciones
-- Ejecutar en Hostinger despues de subir el bundle.
-- Requiere hacer backup de DB antes de correr.

ALTER TABLE match_players
  MODIFY assigned_position ENUM('ARQ','DEF','LAT','MED','DEL') DEFAULT NULL;

UPDATE players
SET
  technique = COALESCE(technique, skill),
  rhythm = COALESCE(rhythm, CASE WHEN pace = 'lento' THEN 2.0 ELSE 4.0 END),
  defense_physical = COALESCE(defense_physical, 3.0),
  attack = COALESCE(attack, skill),
  teamwork = COALESCE(teamwork, skill),
  mentality = COALESCE(mentality, 3.0),
  regularity = COALESCE(regularity, 3.5),
  goalkeeper_skill = COALESCE(
    goalkeeper_skill,
    CASE
      WHEN positions = 'ARQ' OR positions LIKE 'ARQ/%' OR positions LIKE '%/ARQ%' THEN skill
      ELSE NULL
    END
  );

UPDATE players
SET skill = ROUND(LEAST(6.0, GREATEST(1.0,
  CASE
    WHEN positions = 'ARQ' OR positions LIKE 'ARQ/%' THEN
      (
        (COALESCE(goalkeeper_skill, skill) * 0.42)
        + (defense_physical * 0.14)
        + (rhythm * 0.10)
        + (technique * 0.10)
        + (teamwork * 0.14)
        + (mentality * 0.10)
      ) * (1 + ((regularity - 3.5) / 50.0))
    WHEN positions = 'DEF' OR positions LIKE 'DEF/%' THEN
      (
        (defense_physical * 0.28)
        + (rhythm * 0.20)
        + (technique * 0.18)
        + (teamwork * 0.13)
        + (mentality * 0.13)
        + (attack * 0.08)
      ) * (1 + ((regularity - 3.5) / 50.0))
    WHEN positions = 'LAT' OR positions LIKE 'LAT/%' THEN
      (
        (rhythm * 0.24)
        + (defense_physical * 0.22)
        + (technique * 0.17)
        + (teamwork * 0.15)
        + (attack * 0.12)
        + (mentality * 0.10)
      ) * (1 + ((regularity - 3.5) / 50.0))
    WHEN positions = 'DEL' OR positions LIKE 'DEL/%' THEN
      (
        (attack * 0.31)
        + (rhythm * 0.20)
        + (technique * 0.17)
        + (teamwork * 0.14)
        + (mentality * 0.10)
        + (defense_physical * 0.08)
      ) * (1 + ((regularity - 3.5) / 50.0))
    ELSE
      (
        (technique * 0.24)
        + (rhythm * 0.23)
        + (teamwork * 0.19)
        + (mentality * 0.13)
        + (defense_physical * 0.12)
        + (attack * 0.09)
      ) * (1 + ((regularity - 3.5) / 50.0))
  END
)), 1);

UPDATE match_teams mt
LEFT JOIN (
  SELECT
    match_id,
    team_number,
    CONCAT(
      SUM(CASE WHEN assigned_position = 'ARQ' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'DEF' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'LAT' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'MED' THEN 1 ELSE 0 END), '-',
      SUM(CASE WHEN assigned_position = 'DEL' THEN 1 ELSE 0 END)
    ) AS formation_name
  FROM match_players
  WHERE team_number IS NOT NULL
  GROUP BY match_id, team_number
) f ON f.match_id = mt.match_id AND f.team_number = mt.team_number
SET mt.formation_name = f.formation_name
WHERE f.formation_name IS NOT NULL;
