-- ============================================
-- SCRIPT DE CORREÇÃO DA TABELA massage_vouchers
-- Execute no Supabase SQL Editor
-- ============================================

-- 1. Adicionar campos faltantes
ALTER TABLE massage_vouchers 
ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipo_moeda VARCHAR(10),
ADD COLUMN IF NOT EXISTS data_vencimento DATE,
ADD COLUMN IF NOT EXISTS cliente_compra VARCHAR(100),
ADD COLUMN IF NOT EXISTS cliente_massagem VARCHAR(100),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Renomear campos existentes (se necessário)
-- Se o campo 'data venda' existe, vamos mantê-lo e usar data_vencimento separadamente
-- Se 'cliente código' existe, vamos mantê-lo para referência

-- 3. Atualizar valores padrão
ALTER TABLE massage_vouchers 
ALTER COLUMN status_baixado SET DEFAULT 'Não';

-- 4. Migrar dados existentes (se houver)
-- Se você tinha 'data venda' e quer usar como data_vencimento:
-- UPDATE massage_vouchers SET data_vencimento = "data venda" WHERE data_vencimento IS NULL;

-- 5. Criar índices nos novos campos
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_num_ctr ON massage_vouchers(num_ctr);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_produto ON massage_vouchers(produto_codigo);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_vencimento ON massage_vouchers(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_status ON massage_vouchers(status_baixado);

-- 6. Adicionar comentários nos novos campos
COMMENT ON COLUMN massage_vouchers.produto_nome IS 'Nome do produto/massagem';
COMMENT ON COLUMN massage_vouchers.tipo_moeda IS 'Tipo de moeda/forma de pagamento (DN, CD, CH, etc)';
COMMENT ON COLUMN massage_vouchers.data_vencimento IS 'Data de vencimento do vale (padrão: +2 meses)';
COMMENT ON COLUMN massage_vouchers.cliente_compra IS 'Nome do cliente que comprou o vale';
COMMENT ON COLUMN massage_vouchers.cliente_massagem IS 'Nome do cliente que vai usar o vale';

-- 7. Verificar estrutura final
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'massage_vouchers'
ORDER BY ordinal_position;
