-- Marca sessões registradas como concluídas no histórico.
alter table if exists public.sessoes_estudo
add column if not exists concluida boolean;

update public.sessoes_estudo
set concluida = true
where concluida is null;

alter table if exists public.sessoes_estudo
alter column concluida set default true;

alter table if exists public.sessoes_estudo
alter column concluida set not null;
