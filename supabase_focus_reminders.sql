-- ═══════════════════════════════════════════════════════════
--  Recordatorios de concentración (notificaciones push)
--  push_subscriptions: a qué móviles/navegadores avisar
--  focus_reminders:    cada cuánto, entre qué horas y qué días,
--                      y una copia del camino para escribir el aviso
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  user_id    uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS focus_reminders (
  user_id    uuid PRIMARY KEY REFERENCES auth.users DEFAULT auth.uid(),
  enabled    boolean NOT NULL DEFAULT false,
  every_min  int     NOT NULL DEFAULT 60,       -- cada cuántos minutos
  start_min  int     NOT NULL DEFAULT 540,      -- desde (minutos del día: 540 = 9:00)
  end_min    int     NOT NULL DEFAULT 1320,     -- hasta (1320 = 22:00)
  days       int[]   NOT NULL DEFAULT '{0,1,2,3,4,5,6}',  -- 0 = lunes … 6 = domingo
  tz         text    NOT NULL DEFAULT 'Europe/Madrid',
  path       jsonb,                             -- paradas del camino (la app lo mantiene al día)
  last_slot  text,                              -- último aviso enviado ("2026-11-21#3")
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE focus_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own focus_reminders"
  ON focus_reminders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
