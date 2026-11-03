-- Ajoute sexe et birth_date à users sur une base créée avant ces colonnes.
-- Idempotent : peut être relancé sans erreur. À appliquer dans Supabase (SQL Editor)
-- avant de déployer le Worker, dont USER_SELECT lit ces deux colonnes.
alter table users
  add column if not exists sexe text check (sexe in ('femme','homme','autre')),
  add column if not exists birth_date date;
