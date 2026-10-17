-- ═══════════════════════════════════════════════════════════
--  Revisión diaria (bien / mal / mejorar)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  date       date NOT NULL,
  rating     int  DEFAULT 0,
  good       jsonb DEFAULT '[]'::jsonb,
  bad        jsonb DEFAULT '[]'::jsonb,
  improve    jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own daily_reviews"
  ON daily_reviews FOR ALL USING (auth.uid() = user_id);
