-- ═══════════════════════════════════════════════════════════
--  Historial del Camino al éxito (paradas propias y foco del día)
--  Los hábitos ya tienen su historial en habit_logs.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS path_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  stop_id    text NOT NULL,
  date       date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, stop_id, date)
);

ALTER TABLE path_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own path_logs"
  ON path_logs FOR ALL USING (auth.uid() = user_id);
