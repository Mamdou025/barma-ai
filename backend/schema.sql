-- Barma AI — Supabase schema
-- Run this in the Supabase SQL Editor when provisioning a new project.
-- Reconstructed from the columns the backend routes read/write.
--
-- Also required (not creatable via SQL): a PUBLIC Storage bucket named
-- "documents" (Storage → New bucket → Public). The upload route stores PDFs
-- there and serves them via getPublicUrl(). Override the name with the
-- SUPABASE_BUCKET env var if you use a different bucket.

-- Embeddings use OpenAI text-embedding-3-small (1536 dimensions).
create extension if not exists vector;

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  storage_path text,
  storage_url  text,
  full_text    text,
  created_at   timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  content     text,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index if not exists document_chunks_document_id_idx
  on public.document_chunks(document_id);

create table if not exists public.chat_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       text,
  user_name        text,   -- selected profile (no-login identity), e.g. "Aziz Diop"
  document_id      uuid references public.documents(id) on delete cascade,
  user_message     text,
  ai_response      text,
  response_time_ms integer,
  user_ip          text,
  user_agent       text,
  created_at       timestamptz not null default now()
);
-- If chat_logs already exists from an older schema, add the column:
alter table public.chat_logs add column if not exists user_name text;
create index if not exists chat_logs_document_id_idx
  on public.chat_logs(document_id);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  title       text,
  content     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- notes are looked up and updated one-per-document
create unique index if not exists notes_document_id_key
  on public.notes(document_id);
