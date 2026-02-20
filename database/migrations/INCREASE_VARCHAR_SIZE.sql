-- ============================================
-- CORREÇÃO: Aumentar tamanho dos campos VARCHAR
-- Execute no Supabase SQL Editor
-- ============================================

-- Aumentar tamanho dos campos que podem ter valores maiores
ALTER TABLE massage_vouchers 
ALTER COLUMN tipo_moeda TYPE VARCHAR(50),
ALTER COLUMN status_baixado TYPE VARCHAR(50);

-- Verificar estrutura atualizada
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'massage_vouchers'
ORDER BY ordinal_position;
