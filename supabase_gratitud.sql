-- ═══════════════════════════════════════════════════════════
--  Gratitud: lo que escribes cada día en tus tres niveles
--  (salud, familia, lo que tienes o has logrado).
--  Las fotos van al almacén "vision", carpeta <tu id>/gratitud/.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gratitude_entries (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  salud      text NOT NULL DEFAULT '',
  familia    text NOT NULL DEFAULT '',
  logros     text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE gratitude_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gratitud: lo mío"
  ON gratitude_entries FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
