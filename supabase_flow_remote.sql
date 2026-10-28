-- ═══════════════════════════════════════════════════════════
--  Flow: controlar la extensión de Google Flow desde el móvil
--  flow_devices:  cada portátil conectado, con su código secreto y el último
--                 estado que mandó la extensión.
--  flow_commands: las órdenes que se mandan desde el móvil.
--  La extensión no inicia sesión: entra solo por las dos funciones de abajo,
--  con el código secreto de su portátil.
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS flow_devices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  name       text NOT NULL DEFAULT 'Portátil',
  secret     text NOT NULL UNIQUE,
  state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_commands (
  id         bigserial PRIMARY KEY,
  device_id  uuid REFERENCES flow_devices ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  action     text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status     text NOT NULL DEFAULT 'pending',   -- pending | taken | done | failed
  result     text,
  created_at timestamptz DEFAULT now(),
  done_at    timestamptz
);
CREATE INDEX IF NOT EXISTS flow_commands_pending ON flow_commands (device_id, status, created_at);

ALTER TABLE flow_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own flow_devices" ON flow_devices;
CREATE POLICY "users own flow_devices"
  ON flow_devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users own flow_commands" ON flow_commands;
CREATE POLICY "users own flow_commands"
  ON flow_commands FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- La extensión manda su estado y recoge las órdenes pendientes. Solo las de los
-- últimos 10 minutos: una orden vieja no se ejecuta cuando el portátil vuelve.
CREATE OR REPLACE FUNCTION flow_device_sync(p_secret text, p_state jsonb)
RETURNS SETOF flow_commands
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d uuid;
BEGIN
  UPDATE flow_devices SET state = p_state, updated_at = now()
   WHERE secret = p_secret RETURNING id INTO d;
  IF d IS NULL THEN RAISE EXCEPTION 'codigo no valido'; END IF;
  UPDATE flow_commands SET status = 'failed', result = '{"text":"⌛ Caducada: el portátil no la recogió en 10 minutos"}', done_at = now()
   WHERE device_id = d AND status = 'pending' AND created_at <= now() - interval '10 minutes';
  RETURN QUERY
    WITH taken AS (
      UPDATE flow_commands SET status = 'taken'
       WHERE device_id = d AND status = 'pending' AND created_at > now() - interval '10 minutes'
      RETURNING *
    )
    SELECT * FROM taken ORDER BY id;
END $$;

-- La extensión dice cómo fue una orden
CREATE OR REPLACE FUNCTION flow_command_done(p_secret text, p_id bigint, p_ok boolean, p_result text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE flow_commands c SET status = CASE WHEN p_ok THEN 'done' ELSE 'failed' END,
         result = p_result, done_at = now()
    FROM flow_devices d
   WHERE c.id = p_id AND c.device_id = d.id AND d.secret = p_secret;
END $$;

REVOKE ALL ON FUNCTION flow_device_sync(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION flow_command_done(text, bigint, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION flow_device_sync(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION flow_command_done(text, bigint, boolean, text) TO anon, authenticated;
