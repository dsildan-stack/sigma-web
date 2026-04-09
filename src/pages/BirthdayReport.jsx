import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiGift } from 'react-icons/fi';

const BirthdayReport = () => {
    const [loading, setLoading] = useState(false);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    const generatePDF = async () => {
        if (!startMonth || !endMonth) {
            alert('Por favor, selecione o Mês Inicial e o Mês Final.');
            return;
        }

        const startM = parseInt(startMonth);
        const endM = parseInt(endMonth);

        if (startM > endM) {
            alert('O Mês Inicial não pode ser maior que o Mês Final.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('codigo, nome, telefone, celular, folha, carimbos, total_pontos, ultmov, endereco, aniversario')
                .not('aniversario', 'is', null)
                .order('nome', { ascending: true }); 

            if (error) throw error;

            // Filter in memory by extracted month
            const filteredData = (data || []).filter(client => {
                const bday = client.aniversario;
                if (!bday) return false;
                
                // Supabase date is usually YYYY-MM-DD
                let monthStr = '';
                if (bday.includes('-')) {
                    const parts = bday.split('-');
                    if (parts.length === 3) {
                        monthStr = parts[1];
                    }
                } else if (bday.includes('/')) {
                    const parts = bday.split('/');
                    if (parts.length === 3) {
                        monthStr = parts[1]; // assuming DD/MM/YYYY
                    }
                }
                
                if (!monthStr) return false;

                const m = parseInt(monthStr, 10);
                return m >= startM && m <= endM;
            });

            if (filteredData.length === 0) {
                alert('Nenhum aniversariante encontrado neste período.');
                setLoading(false);
                return;
            }

            const doc = new jsPDF('landscape');

            doc.setFontSize(18);
            doc.text('Relatório de Aniversariantes', 14, 22);

            doc.setFontSize(11);
            doc.setTextColor(100);
            const now = new Date();
            doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 30);
            doc.text(`Filtro: Meses de ${startMonth.padStart(2, '0')} a ${endMonth.padStart(2, '0')} | Total de clientes: ${filteredData.length}`, 14, 36);

            const tableColumn = ["Dia/Mês", "Ano", "Cód.", "Nome", "Telefone", "Celular", "Pontos", "Carimbos", "Tot. Pts.", "Últ. Mov.", "Endereço"];
            const tableRows = [];

            filteredData.forEach(client => {
                let diaMes = '';
                let ano = '';
                
                const bday = client.aniversario;
                if (bday) {
                    if (bday.includes('-')) {
                        const parts = bday.split('-');
                        if (parts.length === 3) {
                            diaMes = `${parts[2]}/${parts[1]}`;
                            ano = parts[0];
                        }
                    } else if (bday.includes('/')) {
                        const parts = bday.split('/');
                        if (parts.length === 3) {
                            diaMes = `${parts[0]}/${parts[1]}`;
                            ano = parts[2];
                        }
                    }
                }

                // Format ultmov
                let ultMovFmt = client.ultmov || '';
                if (ultMovFmt && ultMovFmt.includes('-')) {
                    const [y, m, d] = ultMovFmt.split('-');
                    ultMovFmt = `${d}/${m}/${y}`;
                }

                const clientData = [
                    diaMes,
                    ano,
                    client.codigo || '',
                    client.nome || '',
                    client.telefone || '',
                    client.celular || '',
                    client.folha || '',
                    client.carimbos !== null ? client.carimbos : '',
                    client.total_pontos !== null ? client.total_pontos : '',
                    ultMovFmt,
                    client.endereco || ''
                ];
                tableRows.push(clientData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 42,
                styles: { fontSize: 8 },
                columnStyles: {
                    10: { cellWidth: 50 }, // make address column slightly wider if needed or let autoTable handle
                },
                headStyles: { fillColor: [99, 102, 241] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 40, left: 10, right: 10 }
            });

            window.open(URL.createObjectURL(doc.output("blob")));

        } catch (err) {
            console.error('Erro ao gerar relatório', err);
            alert('Erro ao gerar relatório: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const months = [
        { val: 1, label: 'Janeiro' },
        { val: 2, label: 'Fevereiro' },
        { val: 3, label: 'Março' },
        { val: 4, label: 'Abril' },
        { val: 5, label: 'Maio' },
        { val: 6, label: 'Junho' },
        { val: 7, label: 'Julho' },
        { val: 8, label: 'Agosto' },
        { val: 9, label: 'Setembro' },
        { val: 10, label: 'Outubro' },
        { val: 11, label: 'Novembro' },
        { val: 12, label: 'Dezembro' }
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', color: '#1e293b', margin: 0 }}>Relatório de Aniversariantes</h1>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Geração de listagem de clientes aniversariantes por período</p>
                </div>
            </header>

            <div style={{ background: 'white', padding: '3rem 2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center' }}>
                <FiGift style={{ fontSize: '4rem', color: '#cbd5e1', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', color: '#334155', marginBottom: '0.5rem' }}>Listagem de Aniversariantes</h2>
                <p style={{ color: '#64748b', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.5' }}>
                    Selecione o Mês Inicial e Mês Final para gerar o relatório em PDF com os dados dos aniversariantes do período.
                </p>
                
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
                    <div style={{ textAlign: 'left', width: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}>
                            Mês Inicial
                        </label>
                        <select 
                            value={startMonth} 
                            onChange={e => setStartMonth(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                        >
                            <option value="">Selecione...</option>
                            {months.map(m => (
                                <option key={`start-${m.val}`} value={m.val}>{String(m.val).padStart(2, '0')} - {m.label}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ textAlign: 'left', width: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}>
                            Mês Final
                        </label>
                        <select 
                            value={endMonth} 
                            onChange={e => setEndMonth(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                        >
                            <option value="">Selecione...</option>
                            {months.map(m => (
                                <option key={`end-${m.val}`} value={m.val}>{String(m.val).padStart(2, '0')} - {m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

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
                    <FiDownload /> {loading ? 'Processando...' : 'Gerar Relatório em PDF'}
                </button>
            </div>
        </div>
    );
};

export default BirthdayReport;
