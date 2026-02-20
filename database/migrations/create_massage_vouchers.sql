-- Migration: Create massage_vouchers table
-- Description: Table for managing massage vouchers (Vale Massagem)
-- Based on Delphi 5 ValMas table structure

CREATE TABLE IF NOT EXISTS massage_vouchers (
    id BIGSERIAL PRIMARY KEY,
    num_ctr VARCHAR(20) NOT NULL UNIQUE,
    produto_codigo INTEGER NOT NULL,
    produto_nome VARCHAR(100) NOT NULL,
    tipo_moeda VARCHAR(10) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    data_vencimento DATE NOT NULL,
    status_baixado VARCHAR(10) NOT NULL DEFAULT 'Não',
    cliente_compra VARCHAR(100),
    cliente_massagem VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_num_ctr ON massage_vouchers(num_ctr);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_produto ON massage_vouchers(produto_codigo);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_vencimento ON massage_vouchers(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_massage_vouchers_status ON massage_vouchers(status_baixado);

-- Add comments for documentation
COMMENT ON TABLE massage_vouchers IS 'Cadastro de vales-massagem (migrado de Delphi 5 ValMas)';
COMMENT ON COLUMN massage_vouchers.num_ctr IS 'Número de controle sequencial do vale';
COMMENT ON COLUMN massage_vouchers.produto_codigo IS 'Código do produto/massagem';
COMMENT ON COLUMN massage_vouchers.produto_nome IS 'Nome do produto/massagem';
COMMENT ON COLUMN massage_vouchers.tipo_moeda IS 'Tipo de moeda/forma de pagamento (DN, CD, CH, etc)';
COMMENT ON COLUMN massage_vouchers.valor IS 'Valor do vale em reais';
COMMENT ON COLUMN massage_vouchers.data_vencimento IS 'Data de vencimento do vale (padrão: +2 meses)';
COMMENT ON COLUMN massage_vouchers.status_baixado IS 'Status de utilização: Sim ou Não';
COMMENT ON COLUMN massage_vouchers.cliente_compra IS 'Nome do cliente que comprou o vale';
COMMENT ON COLUMN massage_vouchers.cliente_massagem IS 'Nome do cliente que vai usar o vale';
