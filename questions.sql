-- Questions: execute this complete file once in the Supabase SQL Editor.
-- No existing table, login policy, or account is changed.
-- Uses the existing cc_users username/password_hash (SHA-256) login format.
-- Open to all existing, unrestricted accounts. Owner tags remain exclusive to max.
-- Passwords are verified only during login; only hashed opaque session tokens are stored.

BEGIN;
CREATE SCHEMA IF NOT EXISTS cc_questions_private;
REVOKE ALL ON SCHEMA cc_questions_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS cc_questions_private.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  public_enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE cc_questions_private.settings ALTER COLUMN public_enabled SET DEFAULT true;
INSERT INTO cc_questions_private.settings (id,public_enabled) VALUES (true,true)
  ON CONFLICT(id) DO UPDATE SET public_enabled=true;

CREATE TABLE IF NOT EXISTS cc_questions_private.tags (
  slug text PRIMARY KEY,
  label text NOT NULL,
  owner_only boolean NOT NULL DEFAULT false
);
INSERT INTO cc_questions_private.tags (slug, label, owner_only) VALUES
  ('conch','Conch',false), ('cmdr','Cmdr',false), ('sentinel','Sentinel',false),
  ('website','Website',false), ('question','Question',false), ('other','Other',false),
  ('answered','Answered',true), ('in-progress','In Progress',true), ('closed','Closed',true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS cc_questions_private.sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS cc_questions_private.login_limits (
  username text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cc_questions_private.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 10000),
  tags text[] NOT NULL CHECK (cardinality(tags) BETWEEN 1 AND 5),
  owner_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cc_questions_private.replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES cc_questions_private.threads(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cc_questions_private.threads ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE cc_questions_private.replies ADD COLUMN IF NOT EXISTS edited_at timestamptz;
CREATE INDEX IF NOT EXISTS cc_q_threads_activity ON cc_questions_private.threads(last_activity DESC, id DESC);
CREATE INDEX IF NOT EXISTS cc_q_threads_tags ON cc_questions_private.threads USING gin(tags);
CREATE INDEX IF NOT EXISTS cc_q_replies_thread ON cc_questions_private.replies(thread_id, created_at, id);
CREATE INDEX IF NOT EXISTS cc_q_sessions_expiry ON cc_questions_private.sessions(expires_at);

ALTER TABLE cc_questions_private.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_questions_private.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_questions_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_questions_private.login_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_questions_private.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_questions_private.replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cc_questions_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cc_questions_api(
  p_action text, p_token text DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user jsonb;
  v_uid text;
  v_owner boolean;
  v_public boolean;
  v_token text;
  v_hash text;
  v_name text;
  v_attempts integer;
  v_id uuid;
  v_title text;
  v_body text;
  v_tags text[];
  v_tag text;
  v_search text;
  v_status text;
  v_offset integer;
  v_count integer;
  v_items jsonb;
  v_thread jsonb;
  v_author text;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid request.' USING ERRCODE = '22023';
  END IF;
  SELECT public_enabled INTO v_public FROM cc_questions_private.settings WHERE id = true;

  IF p_action = 'login' THEN
    v_name := lower(btrim(p_data->>'username'));
    IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 3 AND 20
      OR char_length(coalesce(p_data->>'password','')) NOT BETWEEN 1 AND 1024 THEN
      RETURN jsonb_build_object('error','Invalid credentials.','code','42501');
    END IF;
    IF NOT coalesce(v_public,false) AND v_name <> 'max' THEN
      RETURN jsonb_build_object('error','Questions is currently an owner-only preview.','code','42501');
    END IF;
    INSERT INTO cc_questions_private.login_limits(username) VALUES(v_name) ON CONFLICT DO NOTHING;
    -- Serialize checks for this account, including concurrent requests.
    PERFORM 1 FROM cc_questions_private.login_limits WHERE username=v_name FOR UPDATE;
    UPDATE cc_questions_private.login_limits SET attempts=0,window_start=now()
      WHERE username=v_name AND window_start < now()-interval '15 minutes';
    SELECT attempts INTO v_attempts FROM cc_questions_private.login_limits WHERE username=v_name;
    IF v_attempts >= 5 THEN
      RETURN jsonb_build_object('error','Too many attempts. Try again in 15 minutes.','code','42501');
    END IF;
    SELECT to_jsonb(u) INTO v_user FROM public.cc_users u WHERE lower(u.username)=v_name;
    IF v_user IS NULL OR v_user->>'password_hash' IS DISTINCT FROM
      encode(sha256(convert_to(p_data->>'password','UTF8')),'hex') THEN
      UPDATE cc_questions_private.login_limits SET attempts=attempts+1 WHERE username=v_name;
      RETURN jsonb_build_object('error','Invalid credentials.','code','42501');
    END IF;
    IF coalesce((v_user->>'is_banned')::boolean,false)
      OR coalesce((v_user->>'is_frozen')::boolean,false)
      OR nullif(v_user->>'temp_ban_until','')::timestamptz > now()
      OR nullif(v_user->>'locked_until','')::timestamptz > now() THEN
      RETURN jsonb_build_object('error','This account is currently restricted.','code','42501');
    END IF;
    DELETE FROM cc_questions_private.sessions WHERE expires_at < now();
    UPDATE cc_questions_private.login_limits SET attempts=0 WHERE username=v_name;
    v_token := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    INSERT INTO cc_questions_private.sessions(token_hash,user_id,password_fingerprint,expires_at)
      VALUES(encode(sha256(convert_to(v_token,'UTF8')),'hex'),v_user->>'id',
        encode(sha256(convert_to(v_user->>'password_hash','UTF8')),'hex'),now()+interval '12 hours');
    RETURN jsonb_build_object('token',v_token,'user_id',v_user->>'id','expires_at',now()+interval '12 hours');
  END IF;

  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Sign in to Questions to continue.' USING ERRCODE = '42501';
  END IF;
  v_hash := encode(sha256(convert_to(p_token,'UTF8')),'hex');
  IF p_action = 'logout' THEN
    DELETE FROM cc_questions_private.sessions WHERE token_hash=v_hash;
    RETURN jsonb_build_object('ok',true);
  END IF;
  SELECT to_jsonb(u) INTO v_user FROM cc_questions_private.sessions s
    JOIN public.cc_users u ON u.id::text=s.user_id
    WHERE s.token_hash=v_hash AND s.expires_at>now()
      AND s.password_fingerprint=encode(sha256(convert_to(u.password_hash::text,'UTF8')),'hex');
  IF v_user IS NULL OR coalesce((v_user->>'is_banned')::boolean,false)
    OR coalesce((v_user->>'is_frozen')::boolean,false)
    OR nullif(v_user->>'temp_ban_until','')::timestamptz>now()
    OR nullif(v_user->>'locked_until','')::timestamptz>now() THEN
    RAISE EXCEPTION 'Your Questions session expired or the account is restricted. Please sign in again.' USING ERRCODE = '42501';
  END IF;
  v_uid := v_user->>'id';
  v_owner := lower(v_user->>'username')='max';
  IF NOT v_owner AND NOT coalesce(v_public,false) THEN
    RAISE EXCEPTION 'Questions is currently an owner-only preview.' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'bootstrap' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.owner_only,t.label),'[]'::jsonb)
      INTO v_items FROM cc_questions_private.tags t;
    RETURN jsonb_build_object('user',jsonb_build_object('id',v_uid,'name',coalesce(v_user->>'display_name',v_user->>'username'),'owner',v_owner),'tags',v_items,'public_enabled',v_public);

  ELSIF p_action = 'list' THEN
    v_search := left(coalesce(p_data->>'search',''),200);
    v_tag := coalesce(p_data->>'tag','');
    v_status := coalesce(p_data->>'status','all');
    v_offset := greatest(0,least(coalesce((p_data->>'offset')::integer,0),100000));
    IF v_status NOT IN ('all','open','answered') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
    SELECT count(*) INTO v_count FROM cc_questions_private.threads t WHERE
      (v_search='' OR strpos(lower(t.title||' '||t.body),lower(v_search))>0)
      AND (v_tag='' OR v_tag=ANY(t.tags) OR v_tag=ANY(t.owner_tags))
      AND (v_status='all' OR (v_status='answered')=('answered'=ANY(t.owner_tags)));
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.last_activity DESC,x.id DESC),'[]'::jsonb) INTO v_items FROM (
      SELECT t.id,t.title,left(t.body,180) AS preview,t.tags,t.owner_tags,t.created_at,t.last_activity,
        coalesce(u.display_name,u.username,'Deleted user') AS author,
        (SELECT count(*) FROM cc_questions_private.replies r WHERE r.thread_id=t.id) AS reply_count
      FROM cc_questions_private.threads t LEFT JOIN public.cc_users u ON u.id::text=t.author_id
      WHERE (v_search='' OR strpos(lower(t.title||' '||t.body),lower(v_search))>0)
        AND (v_tag='' OR v_tag=ANY(t.tags) OR v_tag=ANY(t.owner_tags))
        AND (v_status='all' OR (v_status='answered')=('answered'=ANY(t.owner_tags)))
      ORDER BY t.last_activity DESC,t.id DESC LIMIT 30 OFFSET v_offset
    ) x;
    RETURN jsonb_build_object('items',v_items,'total',v_count);

  ELSIF p_action IN ('create','edit_thread') THEN
    IF p_action='edit_thread' THEN
      v_id := (p_data->>'id')::uuid;
      SELECT author_id INTO v_author FROM cc_questions_private.threads WHERE id=v_id FOR UPDATE;
      IF v_author IS NULL THEN RAISE EXCEPTION 'This question no longer exists.' USING ERRCODE='P0002'; END IF;
      IF v_author<>v_uid AND NOT v_owner THEN RAISE EXCEPTION 'You can only edit your own questions.' USING ERRCODE='42501'; END IF;
      IF NOT v_owner AND EXISTS(SELECT 1 FROM cc_questions_private.threads WHERE id=v_id AND 'closed'=ANY(owner_tags)) THEN RAISE EXCEPTION 'This discussion is closed.'; END IF;
    END IF;
    v_title := btrim(p_data->>'title'); v_body := btrim(p_data->>'body');
    IF coalesce(char_length(v_title),0) NOT BETWEEN 5 AND 160 OR coalesce(char_length(v_body),0) NOT BETWEEN 10 AND 10000 THEN
      RAISE EXCEPTION 'Use a title of 5-160 characters and a question of 10-10000 characters.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_data->'tags') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Select at least one topic tag.' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(DISTINCT value) INTO v_tags FROM jsonb_array_elements_text(p_data->'tags');
    IF coalesce(cardinality(v_tags),0) NOT BETWEEN 1 AND 5 OR EXISTS (
      SELECT 1 FROM unnest(v_tags) tag WHERE NOT EXISTS (
        SELECT 1 FROM cc_questions_private.tags t WHERE t.slug=tag AND NOT t.owner_only
      )
    ) THEN RAISE EXCEPTION 'Select 1-5 valid topic tags. Owner tags are applied after posting.' USING ERRCODE = '22023'; END IF;
    IF p_action='edit_thread' THEN
      UPDATE cc_questions_private.threads SET title=v_title,body=v_body,tags=v_tags,edited_at=now(),last_activity=now() WHERE id=v_id;
      RETURN jsonb_build_object('id',v_id);
    END IF;
    -- Bound write frequency per user. The transaction lock covers concurrent posts.
    PERFORM pg_advisory_xact_lock(hashtextextended('cc_questions_write:'||v_uid,0));
    IF EXISTS(SELECT 1 FROM cc_questions_private.threads WHERE author_id=v_uid AND created_at>now()-interval '10 seconds') THEN
      RAISE EXCEPTION 'Please wait a few seconds before posting another question.';
    END IF;
    INSERT INTO cc_questions_private.threads(author_id,title,body,tags) VALUES(v_uid,v_title,v_body,v_tags) RETURNING id INTO v_id;
    RETURN jsonb_build_object('id',v_id);

  ELSIF p_action IN ('edit_reply','delete_reply') THEN
    SELECT r.thread_id,r.author_id INTO v_id,v_author FROM cc_questions_private.replies r
      JOIN cc_questions_private.threads t ON t.id=r.thread_id WHERE r.id=(p_data->>'reply_id')::uuid FOR UPDATE OF r,t;
    IF v_author IS NULL THEN RAISE EXCEPTION 'This reply no longer exists.' USING ERRCODE='P0002'; END IF;
    IF v_author<>v_uid AND NOT v_owner THEN RAISE EXCEPTION 'You can only change your own replies.' USING ERRCODE='42501'; END IF;
    IF p_action='delete_reply' THEN
      DELETE FROM cc_questions_private.replies WHERE id=(p_data->>'reply_id')::uuid;
    ELSE
      IF NOT v_owner AND EXISTS(SELECT 1 FROM cc_questions_private.threads WHERE id=v_id AND 'closed'=ANY(owner_tags)) THEN RAISE EXCEPTION 'This discussion is closed.'; END IF;
      v_body := btrim(p_data->>'body');
      IF coalesce(char_length(v_body),0) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Replies must contain 1-5000 characters.' USING ERRCODE='22023'; END IF;
      UPDATE cc_questions_private.replies SET body=v_body,edited_at=now() WHERE id=(p_data->>'reply_id')::uuid;
    END IF;
    UPDATE cc_questions_private.threads SET last_activity=now() WHERE id=v_id;
    RETURN jsonb_build_object('ok',true);

  ELSIF p_action IN ('detail','reply','tag','delete_thread') THEN
    v_id := (p_data->>'id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM cc_questions_private.threads WHERE id=v_id) THEN
      RAISE EXCEPTION 'This question no longer exists.' USING ERRCODE = 'P0002';
    END IF;
    IF p_action IN ('reply','tag','delete_thread') THEN
      PERFORM 1 FROM cc_questions_private.threads WHERE id=v_id FOR UPDATE;
    END IF;
    IF p_action = 'detail' THEN
      SELECT to_jsonb(t)||jsonb_build_object('author',coalesce(u.display_name,u.username,'Deleted user'),'can_edit',t.author_id=v_uid OR v_owner) INTO v_thread
        FROM cc_questions_private.threads t LEFT JOIN public.cc_users u ON u.id::text=t.author_id WHERE t.id=v_id;
      v_offset := greatest(0,least(coalesce((p_data->>'reply_offset')::integer,0),100000));
      SELECT count(*) INTO v_count FROM cc_questions_private.replies WHERE thread_id=v_id;
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at,x.id),'[]'::jsonb) INTO v_items FROM (
        SELECT r.id,r.body,r.created_at,r.edited_at,coalesce(u.display_name,u.username,'Deleted user') AS author,
          r.author_id=v_uid OR v_owner AS can_edit,
          coalesce(lower(u.username)='max',false) AS owner
        FROM cc_questions_private.replies r LEFT JOIN public.cc_users u ON u.id::text=r.author_id WHERE r.thread_id=v_id
        ORDER BY r.created_at,r.id LIMIT 50 OFFSET v_offset
      ) x;
      RETURN jsonb_build_object('thread',v_thread,'replies',v_items,'reply_count',v_count);
    ELSIF p_action = 'delete_thread' THEN
      SELECT author_id INTO v_author FROM cc_questions_private.threads WHERE id=v_id;
      IF v_author<>v_uid AND NOT v_owner THEN RAISE EXCEPTION 'You can only delete your own questions.' USING ERRCODE='42501'; END IF;
      DELETE FROM cc_questions_private.threads WHERE id=v_id;
      RETURN jsonb_build_object('ok',true);
    ELSIF p_action = 'reply' THEN
      v_body := btrim(p_data->>'body');
      IF coalesce(char_length(v_body),0) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Replies must contain 1-5000 characters.' USING ERRCODE = '22023'; END IF;
      IF EXISTS(SELECT 1 FROM cc_questions_private.threads WHERE id=v_id AND 'closed'=ANY(owner_tags)) THEN RAISE EXCEPTION 'This discussion is closed.'; END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended('cc_questions_write:'||v_uid,0));
      IF EXISTS(SELECT 1 FROM cc_questions_private.replies WHERE author_id=v_uid AND created_at>now()-interval '2 seconds') THEN RAISE EXCEPTION 'Please wait a moment before replying again.'; END IF;
      INSERT INTO cc_questions_private.replies(thread_id,author_id,body) VALUES(v_id,v_uid,v_body);
      UPDATE cc_questions_private.threads SET last_activity=now() WHERE id=v_id;
      RETURN jsonb_build_object('ok',true);
    ELSE
      IF NOT v_owner THEN RAISE EXCEPTION 'Only Max can apply owner tags.' USING ERRCODE = '42501'; END IF;
      v_tag := p_data->>'tag';
      IF NOT EXISTS(SELECT 1 FROM cc_questions_private.tags WHERE slug=v_tag AND owner_only) OR jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid owner tag.' USING ERRCODE = '22023';
      END IF;
      UPDATE cc_questions_private.threads SET owner_tags=CASE WHEN (p_data->>'enabled')::boolean
        THEN array_append(array_remove(owner_tags,v_tag),v_tag) ELSE array_remove(owner_tags,v_tag) END,last_activity=now() WHERE id=v_id;
      RETURN jsonb_build_object('ok',true);
    END IF;
  END IF;
  RAISE EXCEPTION 'Unknown Questions action.' USING ERRCODE = '22023';
END;
$$;
REVOKE ALL ON FUNCTION public.cc_questions_api(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_questions_api(text,text,jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
