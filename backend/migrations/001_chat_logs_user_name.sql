-- Barma AI — create chat_logs (was missing) + add the no-login "user_name" profile column.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

create table if not exists public.chat_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       text,
  user_name        text,   -- selected profile: "Pa Adama Ndour" | "Pa Aly" | "Aziz Diop"
  document_id      uuid references public.documents(id) on delete cascade,
  user_message     text,
  ai_response      text,
  response_time_ms integer,
  user_ip          text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

-- Safe if the table already existed from an older schema:
alter table public.chat_logs add column if not exists user_name text;

create index if not exists chat_logs_document_id_idx on public.chat_logs(document_id);
