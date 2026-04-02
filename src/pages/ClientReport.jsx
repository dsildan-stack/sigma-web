import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiUsers } from 'react-icons/fi';

const ClientReport = () => {
    const [loading, setLoading] = useState(false);

    const generatePDF = async () => {
        setLoading(true);
        try {
            // Fetch all customers ordering by name
            const { data, error } = await supabase
                .from('customers')
                .select('codigo, nome, endereco, bairro, cidade, estado, cep, telefone, celular')
                .order('nome', { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) {
                alert('Nenhum cliente encontrado.');
                setLoading(false);
                return;
            }

            const doc = new jsPDF('landscape'); // Landscape to fit all columns

            // Report Header
            doc.setFontSize(18);
            doc.text('Relatório de Clientes', 14, 22);

            doc.setFontSize(11);
            doc.setTextColor(100);
            const now = new Date();
            doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 30);
            doc.text(`Total de registros: ${data.length}`, 14, 36);

            // Table setup
            const tableColumn = ["Cód.", "Nome", "Endereço", "Bairro", "Cidade", "UF", "CEP", "Telefone", "Celular"];
            const tableRows = [];

            data.forEach(client => {
                const clientData = [
                    client.codigo,
                    client.nome || '',
                    client.endereco || '',
                    client.bairro || '',
                    client.cidade || '',
                    client.estado || '',
                    client.cep || '',
                    client.telefone || '',
                    client.celular || ''
                ];
                tableRows.push(clientData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [99, 102, 241] }, // Indigo-500 matching the UI theme
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 40 }
            });

            // Open in new tab or directly download
            // doc.save('Relatorio_Clientes.pdf');
            // Using window.open allows user to view before downloading:
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
                    <h1 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Relatório de Clientes</h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Geração de listagem completa de clientes em formato PDF</p>
                </div>
            </header>

            <div style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
                <FiUsers style={{ fontSize: '4rem', color: '#cbd5e1', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', color: '#334155', marginBottom: '0.5rem' }}>Listagem Geral de Clientes</h2>
                <p style={{ color: '#64748b', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.5' }}>
                    Este relatório extrai os seguintes dados de todos os clientes cadastrados no sistema: 
                    <br /><strong>Código, Nome, Endereço, Bairro, Cidade, Estado, CEP, Telefone e Celular.</strong>
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

export default ClientReport;
