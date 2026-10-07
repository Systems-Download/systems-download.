-- V8: run this complete file in Supabase SQL Editor after questions.sql.
-- Mentions, grouped personal notifications, and verified follows.
-- Existing accounts and public cc_follows are preserved; legacy follows are copied once.
BEGIN;
DO $$ BEGIN
  IF to_regclass('cc_questions_private.sessions') IS NULL THEN
    RAISE EXCEPTION 'Run questions.sql before community.sql.';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS cc_social_private;
REVOKE ALL ON SCHEMA cc_social_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS cc_social_private.follows (
  follower_id text NOT NULL,
  following_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower_id,following_id),
  CHECK(follower_id<>following_id)
);
CREATE INDEX IF NOT EXISTS cc_social_following ON cc_social_private.follows(following_id);
CREATE TABLE IF NOT EXISTS cc_social_private.migrations (name text PRIMARY KEY);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM cc_social_private.migrations WHERE name='legacy_follows') THEN
    IF to_regclass('public.cc_follows') IS NOT NULL THEN
      EXECUTE $copy$ INSERT INTO cc_social_private.follows(follower_id,following_id)
        SELECT DISTINCT j->>'follower_id',j->>'following_id' FROM
          (SELECT to_jsonb(f) j FROM public.cc_follows f) x
        WHERE j->>'follower_id'<>j->>'following_id'
          AND EXISTS(SELECT 1 FROM public.cc_users u WHERE u.id::text=j->>'follower_id')
          AND EXISTS(SELECT 1 FROM public.cc_users u WHERE u.id::text=j->>'following_id')
        ON CONFLICT DO NOTHING $copy$;
    END IF;
    INSERT INTO cc_social_private.migrations VALUES('legacy_follows');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS cc_social_private.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL,
  actor_id text NOT NULL,
  thread_id uuid NOT NULL REFERENCES cc_questions_private.threads(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK(source_type IN ('thread','reply')),
  source_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('reply','mention')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE(recipient_id,source_type,source_id)
);
CREATE INDEX IF NOT EXISTS cc_social_inbox ON cc_social_private.notifications(recipient_id,thread_id,created_at DESC);
ALTER TABLE cc_social_private.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_social_private.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_social_private.migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cc_social_private FROM PUBLIC,anon,authenticated;

-- Called inside the posting transaction. Clients cannot insert notification recipients.
CREATE OR REPLACE FUNCTION cc_social_private.question_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_thread uuid; v_author text; v_names text[]; v_body text;
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM cc_social_private.notifications WHERE source_type='reply' AND source_id=OLD.id;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND NEW.body IS NOT DISTINCT FROM OLD.body THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='threads' THEN v_thread:=NEW.id; ELSE v_thread:=NEW.thread_id; END IF;
  SELECT author_id INTO v_author FROM cc_questions_private.threads WHERE id=v_thread;
  v_body := NEW.body;
  -- Canonical account names only; excludes email addresses and duplicates. Maximum ten.
  SELECT array_agg(x.name) INTO v_names FROM (
    SELECT DISTINCT lower(m[1]) AS name FROM regexp_matches(v_body,
      '(?:^|[^[:alnum:]_@])@([a-zA-Z0-9_-]{3,20})(?![[:alnum:]_-])','g') m
    ORDER BY name LIMIT 10
  ) x;
  INSERT INTO cc_social_private.notifications(recipient_id,actor_id,thread_id,source_type,source_id,kind)
    SELECT u.id::text,NEW.author_id,v_thread,
      CASE WHEN TG_TABLE_NAME='threads' THEN 'thread' ELSE 'reply' END,NEW.id,'mention'
    FROM public.cc_users u WHERE lower(u.username)=ANY(v_names) AND u.id::text<>NEW.author_id
      AND NOT coalesce((to_jsonb(u)->>'is_banned')::boolean,false)
    ON CONFLICT(recipient_id,source_type,source_id) DO UPDATE SET kind='mention';
  IF TG_TABLE_NAME='replies' AND TG_OP='INSERT' AND v_author<>NEW.author_id THEN
    INSERT INTO cc_social_private.notifications(recipient_id,actor_id,thread_id,source_type,source_id,kind)
      VALUES(v_author,NEW.author_id,v_thread,'reply',NEW.id,'reply') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION cc_social_private.question_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cc_social_thread_event ON cc_questions_private.threads;
CREATE TRIGGER cc_social_thread_event AFTER INSERT OR UPDATE OF body ON cc_questions_private.threads
  FOR EACH ROW EXECUTE FUNCTION cc_social_private.question_event();
DROP TRIGGER IF EXISTS cc_social_reply_event ON cc_questions_private.replies;
CREATE TRIGGER cc_social_reply_event AFTER INSERT OR UPDATE OF body OR DELETE ON cc_questions_private.replies
  FOR EACH ROW EXECUTE FUNCTION cc_social_private.question_event();

CREATE OR REPLACE FUNCTION public.cc_social_api(p_action text,p_token text DEFAULT NULL,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user jsonb; v_uid text; v_target text; v_items jsonb; v_time timestamptz; v_query text; v_thread uuid; v_enabled boolean; v_hash text;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Invalid request.' USING ERRCODE='22023'; END IF;
  IF p_token IS NOT NULL AND p_token<>'' THEN
    IF p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Please sign in again.' USING ERRCODE='42501'; END IF;
    v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
    SELECT to_jsonb(u) INTO v_user FROM cc_questions_private.sessions s JOIN public.cc_users u ON u.id::text=s.user_id
      WHERE s.token_hash=v_hash AND s.expires_at>now()
        AND s.password_fingerprint=encode(sha256(convert_to(u.password_hash::text,'UTF8')),'hex');
    IF v_user IS NULL OR coalesce((v_user->>'is_banned')::boolean,false) OR coalesce((v_user->>'is_frozen')::boolean,false)
      OR nullif(v_user->>'temp_ban_until','')::timestamptz>now() OR nullif(v_user->>'locked_until','')::timestamptz>now() THEN
      RAISE EXCEPTION 'Your session expired or the account is restricted. Please sign in again.' USING ERRCODE='42501';
    END IF;
    v_uid:=v_user->>'id';
  END IF;
  IF p_action='follow_stats' THEN
    v_target:=p_data->>'user_id';
    IF NOT EXISTS(SELECT 1 FROM public.cc_users u WHERE u.id::text=v_target) THEN RAISE EXCEPTION 'Profile not found.' USING ERRCODE='P0002'; END IF;
    RETURN jsonb_build_object('followers',(SELECT count(*) FROM cc_social_private.follows WHERE following_id=v_target),
      'following',(SELECT count(*) FROM cc_social_private.follows WHERE follower_id=v_target),
      'is_following',EXISTS(SELECT 1 FROM cc_social_private.follows WHERE following_id=v_target AND follower_id=v_uid));
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in to continue.' USING ERRCODE='42501'; END IF;
  IF p_action='follow' THEN
    v_target:=p_data->>'user_id';
    IF jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid follow state.' USING ERRCODE='22023'; END IF;
    IF v_uid=v_target THEN RAISE EXCEPTION 'You cannot follow yourself.' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.cc_users u WHERE u.id::text=v_target AND NOT coalesce((to_jsonb(u)->>'is_banned')::boolean,false)) THEN
      RAISE EXCEPTION 'Profile not found.' USING ERRCODE='P0002';
    END IF;
    v_enabled:=(p_data->>'enabled')::boolean;
    PERFORM pg_advisory_xact_lock(hashtextextended('cc_social_follow:'||v_uid,0));
    IF v_enabled THEN INSERT INTO cc_social_private.follows(follower_id,following_id) VALUES(v_uid,v_target) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM cc_social_private.follows WHERE follower_id=v_uid AND following_id=v_target; END IF;
    RETURN jsonb_build_object('is_following',v_enabled,'followers',(SELECT count(*) FROM cc_social_private.follows WHERE following_id=v_target));
  ELSIF p_action='mention_search' THEN
    v_query:=lower(left(btrim(coalesce(p_data->>'query','')),20));
    IF v_query !~ '^[a-z0-9_-]{1,20}$' THEN RETURN jsonb_build_object('users','[]'::jsonb); END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_items FROM (
      SELECT u.username,coalesce(u.display_name,u.username) AS name FROM public.cc_users u
      WHERE left(lower(u.username),char_length(v_query))=v_query AND NOT coalesce((to_jsonb(u)->>'is_banned')::boolean,false)
      ORDER BY lower(u.username) LIMIT 6
    ) x;
    RETURN jsonb_build_object('users',v_items);
  ELSIF p_action='notifications' THEN
    v_time:=clock_timestamp();
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_items FROM (
      SELECT n.thread_id,t.title,
        count(*)::int AS count,count(*) FILTER(WHERE n.read_at IS NULL)::int AS unread_count,
        count(*) FILTER(WHERE n.kind='mention' AND n.read_at IS NULL)::int AS mention_count,
        count(*) FILTER(WHERE n.kind='reply' AND n.read_at IS NULL)::int AS reply_count,
        max(n.created_at) AS created_at,
        (array_agg(coalesce(u.display_name,u.username,'Deleted user') ORDER BY n.created_at DESC,n.id)
          FILTER(WHERE n.kind='mention' AND n.read_at IS NULL))[1] AS mention_actor,
        (array_agg(coalesce(u.display_name,u.username,'Deleted user') ORDER BY n.created_at DESC,n.id)
          FILTER(WHERE n.kind='reply' AND n.read_at IS NULL))[1] AS reply_actor,
        (array_agg(coalesce(u.display_name,u.username,'Deleted user') ORDER BY n.created_at DESC,n.id))[1] AS actor
      FROM cc_social_private.notifications n JOIN cc_questions_private.threads t ON t.id=n.thread_id
        LEFT JOIN public.cc_users u ON u.id::text=n.actor_id
      WHERE n.recipient_id=v_uid GROUP BY n.thread_id,t.title ORDER BY max(n.created_at) DESC LIMIT 40
    ) x;
    RETURN jsonb_build_object('groups',v_items,'fetched_at',v_time,
      'unread_count',(SELECT count(*) FROM cc_social_private.notifications WHERE recipient_id=v_uid AND read_at IS NULL));
  ELSIF p_action='notifications_read' THEN
    v_time:=nullif(p_data->>'through','')::timestamptz;
    IF v_time IS NULL OR v_time>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'Invalid read timestamp.' USING ERRCODE='22023'; END IF;
    v_thread:=nullif(p_data->>'thread_id','')::uuid;
    UPDATE cc_social_private.notifications SET read_at=now() WHERE recipient_id=v_uid AND read_at IS NULL
      AND created_at<=v_time AND (v_thread IS NULL OR thread_id=v_thread);
    RETURN jsonb_build_object('ok',true);
  END IF;
  RAISE EXCEPTION 'Unknown action.' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.cc_social_api(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cc_social_api(text,text,jsonb) TO anon,authenticated;
-- Apply the requested 3 MiB limit to the configured avatars bucket, if present.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE 'UPDATE storage.buckets SET file_size_limit=3145728 WHERE id=''avatars''';
  END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
