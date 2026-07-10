-- Passo 1: adicionar valor 'rmo' ao enum papel_empresa_usuario
ALTER TYPE public.papel_empresa_usuario ADD VALUE IF NOT EXISTS 'rmo';