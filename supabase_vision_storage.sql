-- ═══════════════════════════════════════════════════════════
--  Vision board: fotos subidas desde la app (Supabase Storage)
--  Cada usuario sube a su carpeta vision/<su id>/...
-- ═══════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision', 'vision', true)
ON CONFLICT (id) DO NOTHING;

-- Cualquiera puede ver las fotos (el enlace es largo y aleatorio)
CREATE POLICY "vision: ver"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vision');

-- Solo puedes subir y borrar dentro de tu propia carpeta
CREATE POLICY "vision: subir a mi carpeta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vision' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "vision: borrar de mi carpeta"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vision' AND (storage.foldername(name))[1] = auth.uid()::text);
