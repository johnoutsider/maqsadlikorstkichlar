-- ============================================================================
-- UzSWLU departments (kafedras) seed
-- Faculties must already exist; this only inserts departments.
-- Idempotent: ON CONFLICT DO NOTHING on (faculty_id, short_code).
-- Angren filiali is intentionally excluded.
-- ============================================================================

DO $$
DECLARE
  v_uni  uuid;
  fac    uuid;
BEGIN
  SELECT id INTO v_uni FROM universities WHERE short_code = 'UZSWLU';
  IF v_uni IS NULL THEN
    RAISE EXCEPTION 'University with short_code=UZSWLU not found. Run this after the university row exists.';
  END IF;

  -- ── Ingliz tili №1 fakulteti ────────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Ingliz tili №1 fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Ingliz tili amaliy fanlar №1',         'ITAF'),
      (v_uni, fac, 'Ingliz tili integrallashgan kursi №1',  'ITIK'),
      (v_uni, fac, 'Ingliz tili nazariy aspektlari №1',     'ITNA'),
      (v_uni, fac, 'Ingliz tilini o''qitish metodikasi №1', 'ITOM'),
      (v_uni, fac, 'Umumiy tilshunoslik',                   'UT'),
      (v_uni, fac, 'Pedagogika va psixologiya',             'PP')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Ingliz tili №2 fakulteti ────────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Ingliz tili №2 fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Ingliz tili amaliy fanlar №2',         'ITAF'),
      (v_uni, fac, 'Ingliz tili integrallashgan kursi №2',  'ITIK'),
      (v_uni, fac, 'Ingliz tili nazariy aspektlari №2',     'ITNA'),
      (v_uni, fac, 'Ingliz tilini o''qitish metodikasi №2', 'ITOM'),
      (v_uni, fac, 'Jismoniy madaniyat va sport',           'JMS'),
      (v_uni, fac, 'O''zbek tili va adabiyoti',             'OTVA')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Ingliz tili №3 fakulteti ────────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Ingliz tili №3 fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Ingliz tili amaliy fanlar №3',         'ITAF'),
      (v_uni, fac, 'Ingliz tili integrallashgan kursi №3',  'ITIK'),
      (v_uni, fac, 'Ingliz tili nazariy aspektlari №3',     'ITNA'),
      (v_uni, fac, 'Ingliz tilini o''qitish metodikasi №3', 'ITOM'),
      (v_uni, fac, 'Jahon adabiyoti',                       'JA'),
      (v_uni, fac, 'Ikkinchi chet tili',                    'ICT')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Ingliz filologiyasi fakulteti ───────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Ingliz filologiyasi fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Ingliz tili funksional leksika',                               'ITFL'),
      (v_uni, fac, 'Ingliz tili amaliy aspektlari',                                'ITAA'),
      (v_uni, fac, 'Ingliz tilini o''qitish metodikasi va ta''lim texnologiyalari', 'ITOMTT'),
      (v_uni, fac, 'Ingliz tilini ikkinchi chet tili sifatida o''qitish',           'ITICTS'),
      (v_uni, fac, 'Ingliz tili nazariy fanlar',                                    'ITNF')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Roman-german filologiyasi fakulteti ─────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Roman-german filologiyasi fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Nemis tili amaliy fanlar',   'NTAF'),
      (v_uni, fac, 'Nemis tili nazariy fanlar',   'NTNF'),
      (v_uni, fac, 'Fransuz tili amaliy fanlar',  'FTAF'),
      (v_uni, fac, 'Fransuz tili nazariy fanlar', 'FTNF'),
      (v_uni, fac, 'Ispan tili amaliy fanlar',    'ISPAF'),
      (v_uni, fac, 'Ispan tili nazariy fanlar',   'ISPNF')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Rus filologiyasi fakulteti ───────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Rus filologiyasi fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Rus tilini o''qitish metodikasi',        'RTOM'),
      (v_uni, fac, 'Rus adabiyoti va o''qitish metodikasi',  'RAOM'),
      (v_uni, fac, 'Hozirgi zamon rus tili',                 'HZRT')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Sharq filologiyasi fakulteti ────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Sharq filologiyasi fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Koreys filologiyasi',              'KF'),
      (v_uni, fac, 'Yapon filologiyasi',               'YF'),
      (v_uni, fac, 'Xitoy filologiyasi',               'XF'),
      (v_uni, fac, 'Zamonaviy axborot texnologiyalari', 'ZAT')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Tarjimonlik fakulteti ────────────────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Tarjimonlik fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Ingliz tili amaliy tarjima',                        'ITAT'),
      (v_uni, fac, 'Ingliz tili tarjima nazariyasi',                    'ITTN'),
      (v_uni, fac, 'Roman german tillari tarjimashunosligi',             'RGTT'),
      (v_uni, fac, 'Arab tili tarjima nazariyasi va amaliyoti',         'ATTNA'),
      (v_uni, fac, 'O''zbekiston tarixi',                               'OT'),
      (v_uni, fac, 'Ekologiya va yashil resurslar',                     'EVR'),
      (v_uni, fac, 'Italyan tili tarjima nazariyasi',                   'ITRN')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

  -- ── Xalqaro jurnalistika fakulteti ──────────────────────────────────────
  SELECT id INTO fac FROM faculties WHERE university_id = v_uni AND name = 'Xalqaro jurnalistika fakulteti';
  IF fac IS NOT NULL THEN
    INSERT INTO departments (university_id, faculty_id, name, short_code) VALUES
      (v_uni, fac, 'Lingvistika va ingliz adabiyoti',              'LVIA'),
      (v_uni, fac, 'Axborot xizmati va jamoatchilik bilan aloqalar','AXJA'),
      (v_uni, fac, 'Medialingvistika va kommunikatsiya',            'MVK'),
      (v_uni, fac, 'Ijtimoiy fanlar',                               'IF'),
      (v_uni, fac, 'Siyosiy fanlar',                                'SF')
    ON CONFLICT (faculty_id, short_code) DO NOTHING;
  END IF;

END $$;
