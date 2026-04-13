-- ============================================================
-- Schema para coleta de dados do benchmark fan-out
-- Três tabelas: sessions, participant_snapshots, cycle_responses
-- ============================================================

-- 1. Metadados de cada sessão de benchmark
CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  room_code text NOT NULL,
  bot_username text NOT NULL,
  participant_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- 2. Snapshot das specs de cada máquina no início da sessão
--    Capturado via gambi.listParticipants() que retorna specs (CPU, RAM, GPU)
CREATE TABLE participant_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id),
  participant_id text NOT NULL,
  nickname text NOT NULL,
  model_name text NOT NULL,
  endpoint text,
  -- Specs da máquina (preenchidas automaticamente pelo Gambi CLI)
  cpu text,
  ram text,
  gpu text,
  vram text,
  os text,
  -- JSON completo das specs caso haja campos extras
  specs_raw jsonb,
  captured_at timestamptz DEFAULT now(),
  UNIQUE(session_id, participant_id)
);

-- 3. Uma linha por participante por ciclo
--    Se 4 máquinas estão online, cada ciclo gera 4 linhas
CREATE TABLE cycle_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  -- ─── Sessão & Ciclo ──────────────────────────────────────
  session_id uuid NOT NULL REFERENCES sessions(id),
  cycle_number integer NOT NULL,
  room_code text NOT NULL,

  -- ─── Participante ────────────────────────────────────────
  participant_id text NOT NULL,
  participant_nickname text NOT NULL,
  model_name text NOT NULL,

  -- ─── Resposta LLM ────────────────────────────────────────
  llm_response_time_ms numeric,
  llm_raw_length integer,
  llm_json_repaired boolean DEFAULT false,
  llm_parse_error boolean DEFAULT false,
  llm_error text,

  -- ─── Ação Parseada ───────────────────────────────────────
  action text,
  reasoning text,
  direction text,
  target text,
  content text,
  raw_response text,

  -- ─── Execução (só a resposta escolhida tem esses campos) ─
  was_executed boolean DEFAULT false,
  action_success boolean,
  action_execution_time_ms numeric,
  action_error text,

  -- ─── Contexto do Jogo (igual pra todos no mesmo ciclo) ──
  health numeric,
  food numeric,
  pos_x numeric,
  pos_y numeric,
  pos_z numeric,
  biome text,
  weather text,
  time_of_day integer,
  is_moving boolean,
  nearby_players integer,
  nearby_entities integer,
  nearby_blocks integer,
  inventory_items integer,

  -- ─── Prompt -──
  prompt_sent TEXT
);

-- ─── Índices para consultas comuns ─────────────────────────
CREATE INDEX idx_cr_session ON cycle_responses(session_id);
CREATE INDEX idx_cr_cycle ON cycle_responses(session_id, cycle_number);
CREATE INDEX idx_cr_participant ON cycle_responses(participant_id);
CREATE INDEX idx_cr_model ON cycle_responses(model_name);
CREATE INDEX idx_cr_action ON cycle_responses(action);
CREATE INDEX idx_cr_created ON cycle_responses(created_at);
CREATE INDEX idx_ps_session ON participant_snapshots(session_id);

-- ─── RLS (acesso anônimo para o bot enviar dados) ─────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_insert_snapshots" ON participant_snapshots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_snapshots" ON participant_snapshots FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_responses" ON cycle_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_responses" ON cycle_responses FOR SELECT TO anon USING (true);

-- ─── Views úteis para análise ──────────────────────────────

-- Latência média por modelo × hardware
CREATE VIEW v_latency_by_setup AS
SELECT
  cr.model_name,
  ps.gpu,
  ps.vram,
  ps.ram,
  COUNT(*) AS total_cycles,
  ROUND(AVG(cr.llm_response_time_ms)::numeric, 1) AS avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cr.llm_response_time_ms)::numeric, 1) AS p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cr.llm_response_time_ms)::numeric, 1) AS p95_ms,
  ROUND(AVG(CASE WHEN cr.llm_parse_error THEN 0 ELSE 1 END)::numeric * 100, 1) AS valid_json_pct,
  ROUND(AVG(CASE WHEN cr.action_success THEN 1 ELSE 0 END)::numeric * 100, 1) AS action_success_pct
FROM cycle_responses cr
JOIN participant_snapshots ps
  ON cr.session_id = ps.session_id
  AND cr.participant_id = ps.participant_id
WHERE cr.llm_error IS NULL
GROUP BY cr.model_name, ps.gpu, ps.vram, ps.ram;

-- Qual setup "ganhou" cada ciclo (menor latência válida)
CREATE VIEW v_fastest_per_cycle AS
SELECT DISTINCT ON (session_id, cycle_number)
  session_id,
  cycle_number,
  participant_id,
  participant_nickname,
  model_name,
  llm_response_time_ms
FROM cycle_responses
WHERE llm_error IS NULL AND NOT llm_parse_error
ORDER BY session_id, cycle_number, llm_response_time_ms ASC;