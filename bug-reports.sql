-- Bug reports V7: run this entire file in the Supabase SQL Editor.
-- Independent of questions.sql; uses the existing cc_users login format.
-- Existing cc_bug_reports and its legacy reports remain unchanged.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cc_bugs_private;
REVOKE ALL ON SCHEMA cc_bugs_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS cc_bugs_private.sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL,
  password_fingerprint text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS cc_bugs_private.login_limits (
  username text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cc_bugs_private.reports (
  id uuid PRIMARY KEY,
  receipt_hash text NOT NULL UNIQUE,
  user_id text, username text NOT NULL DEFAULT 'anonymous',
  tool text NOT NULL CHECK(tool IN ('conch','cmdr','sentinel','website','other')),
  version text NOT NULL CHECK(char_length(version) BETWEEN 1 AND 80),
  title text NOT NULL CHECK(char_length(title) BETWEEN 5 AND 100),
  description text NOT NULL CHECK(char_length(description) BETWEEN 20 AND 2000),
  error_message text NOT NULL CHECK(char_length(error_message) BETWEEN 1 AND 2000),
  steps_to_reproduce text NOT NULL CHECK(char_length(steps_to_reproduce) BETWEEN 5 AND 2000),
  category text NOT NULL CHECK(category IN ('download','login','ui','performance','search','other')),
  severity text NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  screenshot_url text,
  browser text NOT NULL DEFAULT '', page text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','fixed','closed')),
  owner_note text NOT NULL DEFAULT '' CHECK(char_length(owner_note)<=2000),
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cc_bugs_private.status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES cc_bugs_private.reports(id) ON DELETE CASCADE,
  status text NOT NULL, note text NOT NULL DEFAULT '', changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cc_bugs_user_created ON cc_bugs_private.reports(user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS cc_bugs_status_created ON cc_bugs_private.reports(status,created_at DESC,id);
CREATE INDEX IF NOT EXISTS cc_bugs_history_report ON cc_bugs_private.status_history(report_id,changed_at,id);
ALTER TABLE cc_bugs_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_bugs_private.login_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_bugs_private.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_bugs_private.status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cc_bugs_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA cc_bugs_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cc_bug_reports_api(
  p_action text, p_token text DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_user jsonb; v_uid text; v_owner boolean := false;
  v_name text; v_token text; v_hash text; v_id uuid; v_receipt text;
  v_row cc_bugs_private.reports%ROWTYPE;
  v_items jsonb; v_total integer; v_offset integer; v_status text;
  v_history jsonb; v_allowed boolean := false;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Invalid request.' USING ERRCODE='22023'; END IF;
  IF p_action='login' THEN
    v_name:=lower(btrim(p_data->>'username'));
    IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 3 AND 20
      OR char_length(coalesce(p_data->>'password','')) NOT BETWEEN 1 AND 1024 THEN
      RETURN jsonb_build_object('error','Invalid credentials.','code','42501');
    END IF;
    INSERT INTO cc_bugs_private.login_limits(username) VALUES(v_name) ON CONFLICT DO NOTHING;
    PERFORM 1 FROM cc_bugs_private.login_limits WHERE username=v_name FOR UPDATE;
    UPDATE cc_bugs_private.login_limits SET attempts=0,window_start=now() WHERE username=v_name AND window_start<now()-interval '15 minutes';
    IF (SELECT attempts FROM cc_bugs_private.login_limits WHERE username=v_name)>=5 THEN
      RETURN jsonb_build_object('error','Too many attempts. Try again in 15 minutes.','code','42501');
    END IF;
    SELECT to_jsonb(u) INTO v_user FROM public.cc_users u WHERE lower(u.username)=v_name;
    IF v_user IS NULL OR v_user->>'password_hash' IS DISTINCT FROM encode(sha256(convert_to(p_data->>'password','UTF8')),'hex') THEN
      UPDATE cc_bugs_private.login_limits SET attempts=attempts+1 WHERE username=v_name;
      RETURN jsonb_build_object('error','Invalid credentials.','code','42501');
    END IF;
    IF coalesce((v_user->>'is_banned')::boolean,false) OR coalesce((v_user->>'is_frozen')::boolean,false)
      OR nullif(v_user->>'temp_ban_until','')::timestamptz>now() OR nullif(v_user->>'locked_until','')::timestamptz>now() THEN
      RETURN jsonb_build_object('error','Account restricted.','code','42501');
    END IF;
    DELETE FROM cc_bugs_private.sessions WHERE expires_at<now();
    UPDATE cc_bugs_private.login_limits SET attempts=0 WHERE username=v_name;
    v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    INSERT INTO cc_bugs_private.sessions VALUES(encode(sha256(convert_to(v_token,'UTF8')),'hex'),v_user->>'id',encode(sha256(convert_to(v_user->>'password_hash','UTF8')),'hex'),now()+interval '12 hours');
    RETURN jsonb_build_object('token',v_token,'user_id',v_user->>'id','expires_at',now()+interval '12 hours');
  END IF;

  IF p_token IS NOT NULL AND p_token<>'' THEN
    IF p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid session.' USING ERRCODE='42501'; END IF;
    v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
    IF p_action='logout' THEN
      DELETE FROM cc_bugs_private.sessions WHERE token_hash=v_hash;
      RETURN jsonb_build_object('ok',true);
    END IF;
    SELECT to_jsonb(u) INTO v_user FROM cc_bugs_private.sessions s JOIN public.cc_users u ON u.id::text=s.user_id
      WHERE s.token_hash=v_hash AND s.expires_at>now()
      AND s.password_fingerprint=encode(sha256(convert_to(u.password_hash::text,'UTF8')),'hex');
    -- Reuse an existing verified Questions session when that optional module is installed.
    IF v_user IS NULL AND to_regclass('cc_questions_private.sessions') IS NOT NULL THEN
      EXECUTE 'SELECT to_jsonb(u) FROM cc_questions_private.sessions s JOIN public.cc_users u ON u.id::text=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.password_fingerprint=encode(sha256(convert_to(u.password_hash::text,''UTF8'')),''hex'')'
        INTO v_user USING v_hash;
    END IF;
    IF v_user IS NULL OR coalesce((v_user->>'is_banned')::boolean,false) OR coalesce((v_user->>'is_frozen')::boolean,false)
      OR nullif(v_user->>'temp_ban_until','')::timestamptz>now() OR nullif(v_user->>'locked_until','')::timestamptz>now() THEN
      RAISE EXCEPTION 'Session expired or account restricted.' USING ERRCODE='42501';
    END IF;
    v_uid:=v_user->>'id'; v_owner:=lower(v_user->>'username')='max';
  END IF;

  IF p_action='bootstrap' THEN
    RETURN jsonb_build_object('user',CASE WHEN v_user IS NULL THEN NULL ELSE jsonb_build_object('id',v_uid,'name',coalesce(v_user->>'display_name',v_user->>'username'),'owner',v_owner) END);
  ELSIF p_action='create' THEN
    v_id:=(p_data->>'id')::uuid; v_receipt:=p_data->>'receipt';
    IF v_id IS NULL OR v_receipt IS NULL OR v_receipt !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid receipt.' USING ERRCODE='22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text,0));
    SELECT * INTO v_row FROM cc_bugs_private.reports WHERE id=v_id;
    IF FOUND THEN
      IF v_row.receipt_hash<>encode(sha256(convert_to(v_receipt,'UTF8')),'hex') THEN RAISE EXCEPTION 'Invalid receipt.' USING ERRCODE='42501'; END IF;
      RETURN jsonb_build_object('id',v_row.id,'created_at',v_row.created_at,'status',v_row.status,'duplicate',true);
    END IF;
    IF v_uid IS NOT NULL AND (SELECT count(*) FROM cc_bugs_private.reports WHERE user_id=v_uid AND created_at>now()-interval '10 minutes')>=5 THEN
      RAISE EXCEPTION 'Too many reports. Try again later.' USING ERRCODE='54000';
    END IF;
    IF p_data->>'screenshot_url' IS NOT NULL AND (char_length(p_data->>'screenshot_url')>1000 OR p_data->>'screenshot_url' !~ '^https?://[^[:space:]]+$') THEN
      RAISE EXCEPTION 'Invalid screenshot URL.' USING ERRCODE='22023';
    END IF;
    INSERT INTO cc_bugs_private.reports(id,receipt_hash,user_id,username,tool,version,title,description,error_message,steps_to_reproduce,category,severity,screenshot_url,browser,page)
    VALUES(v_id,encode(sha256(convert_to(v_receipt,'UTF8')),'hex'),v_uid,coalesce(v_user->>'username','anonymous'),
      p_data->>'tool',btrim(p_data->>'version'),btrim(p_data->>'title'),btrim(p_data->>'description'),btrim(p_data->>'error_message'),btrim(p_data->>'steps_to_reproduce'),
      p_data->>'category',p_data->>'severity',p_data->>'screenshot_url',left(coalesce(p_data->>'browser',''),300),left(coalesce(p_data->>'page',''),1000)) RETURNING * INTO v_row;
    INSERT INTO cc_bugs_private.status_history(report_id,status) VALUES(v_id,'open');
    RETURN jsonb_build_object('id',v_id,'created_at',v_row.created_at,'status','open','duplicate',false);
  ELSIF p_action='list' THEN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to view reports.' USING ERRCODE='42501'; END IF;
    v_status:=coalesce(p_data->>'status','all');
    IF v_status NOT IN ('all','open','in-progress','fixed','closed') THEN RAISE EXCEPTION 'Invalid status.' USING ERRCODE='22023'; END IF;
    v_offset:=greatest(0,least(coalesce((p_data->>'offset')::integer,0),100000));
    SELECT count(*) INTO v_total FROM cc_bugs_private.reports r WHERE (v_owner OR r.user_id=v_uid) AND (v_status='all' OR r.status=v_status);
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id),'[]'::jsonb) INTO v_items FROM (
      SELECT r.id,r.title,r.tool,r.version,r.username,r.status,r.created_at,r.updated_at,r.revision
      FROM cc_bugs_private.reports r WHERE (v_owner OR r.user_id=v_uid) AND (v_status='all' OR r.status=v_status)
      ORDER BY r.created_at DESC,r.id LIMIT 20 OFFSET v_offset
    ) x;
    RETURN jsonb_build_object('items',v_items,'total',v_total);
  ELSIF p_action IN ('detail','status') THEN
    v_id:=(p_data->>'id')::uuid;
    SELECT * INTO v_row FROM cc_bugs_private.reports WHERE id=v_id FOR UPDATE;
    v_allowed:=v_owner OR (v_uid IS NOT NULL AND v_row.user_id=v_uid)
      OR (coalesce(p_data->>'receipt','') ~ '^[0-9a-f]{64}$' AND v_row.receipt_hash=encode(sha256(convert_to(p_data->>'receipt','UTF8')),'hex'));
    IF v_row.id IS NULL OR NOT coalesce(v_allowed,false) THEN RAISE EXCEPTION 'Report unavailable.' USING ERRCODE='42501'; END IF;
    IF p_action='status' THEN
      IF NOT v_owner THEN RAISE EXCEPTION 'Only Max can update the status.' USING ERRCODE='42501'; END IF;
      v_status:=p_data->>'status';
      IF v_status IS NULL OR v_status NOT IN ('open','in-progress','fixed','closed') OR char_length(coalesce(p_data->>'note',''))>2000 THEN RAISE EXCEPTION 'Invalid status or note.' USING ERRCODE='22023'; END IF;
      IF coalesce((p_data->>'revision')::integer,-1)<>v_row.revision THEN RAISE EXCEPTION 'Report changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
      IF v_status<>v_row.status OR coalesce(p_data->>'note','')<>v_row.owner_note THEN
        UPDATE cc_bugs_private.reports SET status=v_status,owner_note=coalesce(p_data->>'note',''),revision=revision+1,updated_at=now() WHERE id=v_id RETURNING * INTO v_row;
        INSERT INTO cc_bugs_private.status_history(report_id,status,note) VALUES(v_id,v_status,v_row.owner_note);
      END IF;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('status',h.status,'note',h.note,'changed_at',h.changed_at) ORDER BY h.changed_at,h.id),'[]'::jsonb) INTO v_history FROM cc_bugs_private.status_history h WHERE report_id=v_id;
    RETURN jsonb_build_object('report',to_jsonb(v_row)-'receipt_hash','history',v_history,'can_manage',v_owner);
  END IF;
  RAISE EXCEPTION 'Unknown action.' USING ERRCODE='22023';
END;
$$;
REVOKE ALL ON FUNCTION public.cc_bug_reports_api(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cc_bug_reports_api(text,text,jsonb) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
