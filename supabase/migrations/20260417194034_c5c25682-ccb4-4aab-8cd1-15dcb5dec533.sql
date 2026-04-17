CREATE TYPE public.modelo_contratacao AS ENUM ('presencial', 'hibrido', 'remoto');

ALTER TABLE public.projetos
ADD COLUMN modelo_contratacao public.modelo_contratacao;