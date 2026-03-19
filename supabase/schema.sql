-- ============================================================================
-- Schema para coleta de métricas do Minecraft Bot
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

create table if not exists bot_cycles (
  id            bigint generated always as identity primary key,
  created_at    timestamptz default now(),

  -- Sessão
  session_id      text not null,
  bot_username    text not null,
  room_code       text not null,
  model_selector  text not null,

  -- LLM
  llm_response_time_ms    real not null,
  llm_raw_length          integer not null,
  llm_json_repaired       boolean not null default false,
  llm_parse_error         boolean not null default false,

  -- Decisão
  action                  text not null,
  action_success          boolean not null,
  action_execution_time_ms real not null,
  action_error            text,
  reasoning               text,
  direction               text,
  target                  text,

  -- Contexto do Jogo
  health          real not null,
  food            real not null,
  pos_x           integer not null,
  pos_y           integer not null,
  pos_z           integer not null,
  biome           text not null,
  weather         text not null,
  time_of_day     integer not null,
  is_moving       boolean not null,
  nearby_players  integer not null,
  nearby_entities integer not null,
  nearby_blocks   integer not null,
  inventory_items integer not null
);

-- Índices para consultas comuns no TCC
create index if not exists idx_bot_cycles_session     on bot_cycles (session_id);
create index if not exists idx_bot_cycles_room        on bot_cycles (room_code);
create index if not exists idx_bot_cycles_created     on bot_cycles (created_at);
create index if not exists idx_bot_cycles_action      on bot_cycles (action);
create index if not exists idx_bot_cycles_model       on bot_cycles (model_selector);

-- RLS: permitir insert anônimo (jogadores não precisam de auth)
alter table bot_cycles enable row level security;

create policy "Allow anonymous inserts"
  on bot_cycles
  for insert
  to anon
  with check (true);

create policy "Allow anonymous reads"
  on bot_cycles
  for select
  to anon
  using (true);