-- ═══════════════════════════════════════════════════════════
--  Habits
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS habits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  name       text NOT NULL,
  icon       text DEFAULT '⭐',
  color      text DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  habit_id   uuid REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  date       date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (habit_id, date)
);

ALTER TABLE habits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own habits"
  ON habits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users own habit_logs"
  ON habit_logs FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
--  Notes
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  title      text NOT NULL DEFAULT '',
  content    text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own notes"
  ON notes FOR ALL USING (auth.uid() = user_id);
