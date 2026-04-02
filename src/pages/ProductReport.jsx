import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiPackage } from 'react-icons/fi';

const ProductReport = () => {
    const [loading, setLoading] = useState(false);

    const generatePDF = async () => {
        setLoading(true);
        try {
            // Fetch all products ordering by name
            const { data, error } = await supabase
                .from('products')
                .select('codigo, nome, tempo_duracao, preco, moedas_string, comissao_tipo_a, comissao_tipo_b, comissao_tipo_c, comissao_tipo_d')
                .order('nome', { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) {
                alert('Nenhum produto encontrado.');
                setLoading(false);
                return;
            }

            const doc = new jsPDF('landscape'); // Landscape to fit all columns

            // Report Header
            doc.setFontSize(18);
            doc.text('Relatório de Produtos', 14, 22);

            doc.setFontSize(11);
            doc.setTextColor(100);
            const now = new Date();
            doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 30);
            doc.text(`Total de registros: ${data.length}`, 14, 36);

            // Table setup
            const tableColumn = ["Cód.", "Nome do Produto", "Tempo(m)", "Preço(R$)", "Moedas Aceitas", "Comis.A", "Comis.B", "Comis.C", "Comis.D"];
            const tableRows = [];

            data.forEach(product => {
                const productData = [
                    product.codigo,
                    product.nome || '',
                    product.tempo_duracao || '0',
                    product.preco ? parseFloat(product.preco).toFixed(2) : '0.00',
                    product.moedas_string ? product.moedas_string.replace(/-/g, ', ') : '',
                    product.comissao_tipo_a ? parseFloat(product.comissao_tipo_a).toFixed(2) : '0.00',
                    product.comissao_tipo_b ? parseFloat(product.comissao_tipo_b).toFixed(2) : '0.00',
                    product.comissao_tipo_c ? parseFloat(product.comissao_tipo_c).toFixed(2) : '0.00',
                    product.comissao_tipo_d ? parseFloat(product.comissao_tipo_d).toFixed(2) : '0.00'
                ];
                tableRows.push(productData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [99, 102, 241] }, // Indigo-500 matching the UI theme
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 40 }
            });

            // Open in new tab or directly download
            window.open(URL.createObjectURL(doc.output("blob")));

        } catch (err) {
            console.error('Erro ao gerar relatório', err);
            alert('Erro ao gerar relatório: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Relatório de Produtos</h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Geração de listagem completa de produtos e valores em formato PDF</p>
                </div>
            </header>

            <div style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
                <FiPackage style={{ fontSize: '4rem', color: '#cbd5e1', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', color: '#334155', marginBottom: '0.5rem' }}>Listagem Geral de Produtos</h2>
                <p style={{ color: '#64748b', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.5' }}>
                    Este relatório extrai os seguintes dados de todos os produtos cadastrados no sistema:
                    <br /><strong>Código, Nome, Tempo de Duração, Preço, Moedas, e as Comissões (Tipos A, B, C e D).</strong>
                </p>

                <button
                    onClick={generatePDF}
                    disabled={loading}
                    style={{
                        backgroundColor: loading ? '#a5b4fc' : '#6366f1',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '1rem',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                    }}
                >
                    <FiDownload /> {loading ? 'Gerando PDF, aguarde...' : 'Gerar Relatório em PDF'}
                </button>
            </div>
        </div>
    );
};

export default ProductReport;
