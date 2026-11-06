-- pg_trgm and idx_contact_name_trgm (GIN on name) already exist in production.
-- No additional GIN index is needed. Two-character ILIKE searches are supported,
-- but trigrams are generally more selective for searches of 3+ characters.
CREATE INDEX IF NOT EXISTS "Contact_organizationId_name_id_idx"
  ON public."Contact" ("organizationId", name, id);

-- A tuple comparison lets Postgres seek directly into the composite B-tree.
-- Fetch one extra record to detect the end without COUNT(*) or OFFSET.
CREATE OR REPLACE FUNCTION public.list_contact_page(
  p_organization_id text,
  p_search text DEFAULT '',
  p_after_name text DEFAULT NULL,
  p_after_id text DEFAULT NULL
)
RETURNS TABLE (id text, name text, phone text)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Omit unused filters so generic plans cannot turn a cursor seek into a scan.
  -- Only constant SQL fragments are concatenated; all values are bound parameters.
  RETURN QUERY EXECUTE
    'SELECT c.id, c.name, c.phone FROM public."Contact" AS c
     WHERE c."organizationId" = $1'
    || CASE WHEN p_search <> '' THEN ' AND c.name ILIKE $2' ELSE '' END
    || CASE WHEN p_after_name IS NOT NULL THEN ' AND (c.name, c.id) > ($3, $4)' ELSE '' END
    || ' ORDER BY c.name ASC, c.id ASC LIMIT 31'
  USING p_organization_id, '%' || p_search || '%', p_after_name, p_after_id;
END;
$$;

-- Matches the existing server-only admin repository. Do not expose a callable
-- cross-organization function to browser roles. No RLS policies are changed.
REVOKE ALL ON FUNCTION public.list_contact_page(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_contact_page(text, text, text, text) TO service_role;
