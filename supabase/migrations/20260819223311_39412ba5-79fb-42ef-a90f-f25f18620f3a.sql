DO $$
DECLARE
  v_profile uuid;
  v_session uuid;
  m record;
  v_total numeric;
  v_items int;
  v_low numeric; v_high numeric; v_frac numeric; v_scaled numeric;
  v_cat text; v_int text;
  v_readiness numeric;
BEGIN
  SELECT id INTO v_profile FROM public.profiles WHERE code = 'TFS-V2DQ';
  IF v_profile IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  SELECT id INTO v_session FROM public.assessment_sessions WHERE user_id = v_profile ORDER BY started_at DESC LIMIT 1;

  -- answers for every active item (varied but realistic pattern)
  DELETE FROM public.assessment_answers WHERE session_id = v_session;
  INSERT INTO public.assessment_answers (session_id, question_id, module_id, answer_value, scored_value, answered_at)
  SELECT v_session, q.id, q.module_id,
         v.av,
         CASE WHEN q.direction = 'F' THEN v.av ELSE 6 - v.av END,
         now()
  FROM public.assessment_questions q
  CROSS JOIN LATERAL (SELECT 2 + (('x' || substr(md5(q.id::text || 'tfs-v2dq'), 1, 8))::bit(32)::bigint % 4) AS av) v
  WHERE q.active;

  -- progress
  DELETE FROM public.module_progress WHERE session_id = v_session;
  INSERT INTO public.module_progress (session_id, module_id, status, answered_count, total_items, started_at, completed_at)
  SELECT v_session, mo.id, 'completed',
         (SELECT count(*) FROM public.assessment_questions q WHERE q.module_id = mo.id AND q.active),
         (SELECT count(*) FROM public.assessment_questions q WHERE q.module_id = mo.id AND q.active),
         now(), now()
  FROM public.assessment_modules mo WHERE mo.active;

  -- dimension results
  DELETE FROM public.dimension_results WHERE session_id = v_session;
  INSERT INTO public.dimension_results (session_id, module_id, dimension_id, raw_score, normalized_score, status)
  SELECT v_session, d.module_id, d.id, s.raw,
         round(((s.raw - s.n) / NULLIF(s.n * 4, 0)) * 1000) / 10,
         CASE WHEN ((s.raw - s.n) / NULLIF(s.n * 4, 0)) * 100 < 50 THEN 'Perlu Penguatan'
              WHEN ((s.raw - s.n) / NULLIF(s.n * 4, 0)) * 100 < 75 THEN 'Berkembang'
              ELSE 'Kuat' END
  FROM public.assessment_dimensions d
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(a.scored_value), 0)::numeric AS raw, count(*)::numeric AS n
    FROM public.assessment_questions q
    JOIN public.assessment_answers a ON a.question_id = q.id AND a.session_id = v_session
    WHERE q.dimension_id = d.id AND q.active
  ) s
  WHERE s.n > 0;

  -- module results
  DELETE FROM public.assessment_results WHERE session_id = v_session;
  FOR m IN SELECT id FROM public.assessment_modules WHERE active LOOP
    SELECT coalesce(sum(a.scored_value), 0), count(*) INTO v_total, v_items
    FROM public.assessment_answers a WHERE a.session_id = v_session AND a.module_id = m.id;
    IF v_items = 0 THEN CONTINUE; END IF;
    SELECT min(min_score), max(max_score) INTO v_low, v_high
    FROM public.interpretation_bands WHERE module_id = m.id AND scope = 'module';
    v_frac := (v_total - v_items) / (v_items * 4);
    v_scaled := coalesce(v_low, 0) + v_frac * (coalesce(v_high, 100) - coalesce(v_low, 0));
    SELECT category, interpretation INTO v_cat, v_int
    FROM public.interpretation_bands
    WHERE module_id = m.id AND scope = 'module' AND v_scaled >= min_score AND v_scaled <= max_score
    ORDER BY sequence LIMIT 1;
    IF v_cat IS NULL THEN
      SELECT category, interpretation INTO v_cat, v_int FROM public.interpretation_bands
      WHERE module_id = m.id AND scope = 'module' ORDER BY sequence DESC LIMIT 1;
    END IF;
    INSERT INTO public.assessment_results (session_id, module_id, raw_score, normalized_score, category, interpretation, strongest_dimension_id, weakest_dimension_id)
    VALUES (
      v_session, m.id, v_total,
      round(((v_total - v_items) / (v_items * 4)) * 1000) / 10,
      coalesce(v_cat, 'Tidak Terkategori'), coalesce(v_int, ''),
      (SELECT dimension_id FROM public.dimension_results WHERE session_id = v_session AND module_id = m.id ORDER BY normalized_score DESC LIMIT 1),
      (SELECT dimension_id FROM public.dimension_results WHERE session_id = v_session AND module_id = m.id ORDER BY normalized_score ASC LIMIT 1)
    );
  END LOOP;

  -- overall
  SELECT round(avg(normalized_score) * 10) / 10 INTO v_readiness FROM public.assessment_results WHERE session_id = v_session;
  SELECT category, interpretation INTO v_cat, v_int FROM public.interpretation_bands
  WHERE scope = 'overall' AND v_readiness >= min_score AND v_readiness <= max_score ORDER BY sequence LIMIT 1;
  DELETE FROM public.overall_results WHERE session_id = v_session;
  INSERT INTO public.overall_results (session_id, readiness_score, category, interpretation)
  VALUES (v_session, coalesce(v_readiness, 0), coalesce(v_cat, 'Tidak Terkategori'), coalesce(v_int, ''));

  UPDATE public.assessment_sessions
  SET status = 'completed', scoring_calculated = true, completed_at = now()
  WHERE id = v_session;
END $$;