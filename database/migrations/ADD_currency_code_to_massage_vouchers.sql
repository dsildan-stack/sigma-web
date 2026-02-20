-- ============================================
-- ADICIONAR CAMPO currency_code NA TABELA massage_vouchers
-- Execute no Supabase SQL Editor
-- ============================================

-- 1. Adicionar coluna currency_code
ALTER TABLE massage_vouchers 
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);

-- 2. Migrar dados existentes de tipo_moeda para currency_code (se houver)
UPDATE massage_vouchers 
SET currency_code = tipo_moeda 
WHERE currency_code IS NULL AND tipo_moeda IS NOT NULL;

-- 3. Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_currency ON massage_vouchers(currency_code);

-- 4. Adicionar comentário no campo
COMMENT ON COLUMN massage_vouchers.currency_code IS 'Código da moeda da tabela product_currencies';

-- 5. Verificar estrutura final
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'massage_vouchers'
ORDER BY ordinal_position;
