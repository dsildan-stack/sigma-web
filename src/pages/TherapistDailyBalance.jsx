import React, { useState, useEffect, useRef } from 'react';
import './TherapistDailyBalance.css';
import {
    FiSave, FiTrash2, FiSearch, FiPlus, FiX,
    FiUser, FiDollarSign, FiCalendar, FiFileText,
    FiCornerDownRight, FiInfo, FiLayers
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TherapistDailyBalance = ({ session }) => {
    // --- UI/Progress State ---
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [searchMode, setSearchMode] = useState(null); // T1 | T2 | T3 | T4
    const [closings, setClosings] = useState([]);

    // --- Report State ---
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [reportParams, setReportParams] = useState({
        terapeuta: '',
        terapeuta_nome: '',
        dataInicial: new Date().toISOString().split('T')[0],
        dataFinal: new Date().toISOString().split('T')[0]
    });

    // --- History Filter State ---
    const [historyFilterCode, setHistoryFilterCode] = useState('');
    const [historyFilterName, setHistoryFilterName] = useState('');

    // --- Core Form State ---
    const [formData, setFormData] = useState({
        data: new Date().toISOString().split('T')[0],

        // Therapist 1 (Origin)
        t1_codigo: '',
        t1_nome: '',
        t1_funcao: '',
        t1_banco_caixa: 'Não',

        // Finance Fields
        comissao: '0.00',
        pix: '0.00',
        caixinha: '0.00',
        ajustes: '0.00',

        // Therapist 2 (Destination - for adjustments)
        t2_codigo: '',
        t2_nome: '',
        t2_funcao: '',
        t2_banco_caixa: 'Não',

        observacao: ''
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // --- Data Fetching ---
    const fetchClosings = async () => {
        try {
            let query = supabase
                .from('therapist_closings')
                .select('*')
                .order('terapeuta_codigo', { ascending: true })
                .order('data', { ascending: true })
                .order('hora', { ascending: true });

            if (historyFilterCode) {
                query = query.eq('terapeuta_codigo', parseInt(historyFilterCode));
            }

            const { data, error } = await query;
            if (error) throw error;
            
            let therapistsData = [];
            const { data: tData, error: tErr } = await supabase
                .from('therapists')
                .select('codigo, nome, nome_abrev');
            if (!tErr && tData) therapistsData = tData;

            const mapped = (data || []).map(c => {
                const therapist = therapistsData.find(t => parseInt(t.codigo) === parseInt(c.terapeuta_codigo));
                return {
                    ...c,
                    dataStr: formatDate(c.data),
                    terapeuta_nome_display: therapist?.nome_abrev || therapist?.nome || c.terapeuta_nome
                };
            });
            setClosings(mapped);
        } catch (error) {
            console.error('Erro ao buscar fechamentos:', error);
        }
    };

    useEffect(() => {
        fetchClosings();
    }, [historyFilterCode]);

    const handleSearch = async (type, term) => {
        if (!term) {
            setResults([]);
            setSearchMode(null);
            return;
        }

        setSearchMode(type);
        let query = supabase.from('therapists').select('codigo, nome, nome_abrev, cod_funcao, banco_caixa');

        if (!isNaN(term)) {
            query = query.eq('codigo', parseInt(term));
        } else {
            query = query.or(`nome.ilike.%${term}%,nome_abrev.ilike.%${term}%`);
        }

        const { data } = await query.limit(10);
        setResults(data || []);
    };

    const handleSelectResult = (item) => {
        if (searchMode === 'T1') {
            setFormData(prev => ({
                ...prev,
                t1_codigo: item.codigo.toString(),
                t1_nome: item.nome_abrev || item.nome,
                t1_funcao: item.cod_funcao,
                t1_banco_caixa: item.banco_caixa || 'Não'
            }));
        } else if (searchMode === 'T2') {
            setFormData(prev => ({
                ...prev,
                t2_codigo: item.codigo.toString(),
                t2_nome: item.nome_abrev || item.nome,
                t2_funcao: item.cod_funcao,
                t2_banco_caixa: item.banco_caixa || 'Não'
            }));
        } else if (searchMode === 'T3') {
            setReportParams(prev => ({
                ...prev,
                terapeuta: item.codigo.toString(),
                terapeuta_nome: item.nome_abrev || item.nome
            }));
        } else if (searchMode === 'T4') {
            setHistoryFilterCode(item.codigo.toString());
            setHistoryFilterName(item.nome_abrev || item.nome);
        }
        setResults([]);
        setSearchMode(null);
    };

    const fetchTherapistByCode = async (type, code) => {
        if (!code) {
            if (type === 'T1') setFormData(p => ({...p, t1_nome: '', t1_funcao: '', t1_banco_caixa: 'Não'}));
            if (type === 'T2') setFormData(p => ({...p, t2_nome: '', t2_funcao: '', t2_banco_caixa: 'Não'}));
            if (type === 'T3') setReportParams(p => ({...p, terapeuta_nome: ''}));
            if (type === 'T4') {
                setHistoryFilterCode('');
                setHistoryFilterName('');
            }
            return;
        }
        const { data } = await supabase
            .from('therapists')
            .select('nome, nome_abrev, cod_funcao, banco_caixa')
            .eq('codigo', parseInt(code))
            .single();

        if (data) {
            if (type === 'T1') {
                setFormData(p => ({ ...p, t1_nome: data.nome_abrev || data.nome, t1_funcao: data.cod_funcao, t1_banco_caixa: data.banco_caixa || 'Não' }));
            } else if (type === 'T2') {
                setFormData(p => ({ ...p, t2_nome: data.nome_abrev || data.nome, t2_funcao: data.cod_funcao, t2_banco_caixa: data.banco_caixa || 'Não' }));
            } else if (type === 'T3') {
                setReportParams(p => ({ ...p, terapeuta_nome: data.nome_abrev || data.nome }));
            } else if (type === 'T4') {
                setHistoryFilterName(data.nome_abrev || data.nome);
            }
        }
    };

    // --- Calculation Logic (Delphi Migration) ---
    const calculateSaldoTotal = async (therapistCode, newSaldoDia) => {
        // Fetch all previous closings for this therapist to calc historical balance
        const { data } = await supabase
            .from('therapist_closings')
            .select('saldo_dia')
            .eq('terapeuta_codigo', therapistCode);

        const historicalSum = data ? data.reduce((acc, curr) => acc + (curr.saldo_dia || 0), 0) : 0;
        return historicalSum + newSaldoDia;
    };

    // --- Main Transaction Action ---
    const handleGravar = async () => {
        const tAjustes = parseFloat(formData.ajustes || 0);
        const tComissao = parseFloat(formData.comissao || 0);
        const tPix = parseFloat(formData.pix || 0);
        const tCaixinha = parseFloat(formData.caixinha || 0);

        // Validations
        if (!formData.t1_codigo) return alert('Código do Terapeuta em branco, inválido!');
        if (tAjustes > 0 && !formData.observacao) return alert('Observação em branco para Ajustes maior que zero!');
        if (tAjustes > 0 && (tComissao !== 0 || tPix !== 0 || tCaixinha !== 0)) {
            return alert('Comissão/Pix/Caixinha inválido quando Ajustes maior que zero!');
        }
        if (tAjustes > 0 && !formData.t2_codigo) return alert('Campo Terapeuta destino deve ser preenchido para Ajustes maior que zero!');

        if (!window.confirm('Confirma a gravação dos dados de fechamento?')) return;

        setLoading(true);
        try {
            // PART 1: Save First Therapist (Origin)
            let finalAjuste1 = tAjustes;
            let observacaoFinal = tAjustes !== 0 ? formData.observacao : 'Lançamento-Comissão Manual';

            // Special Signal Logic (Corrected: Origin is always negative adjustment for all scenarios)
            if (tAjustes > 0) {
                finalAjuste1 = tAjustes * -1;
            }

            const saldoDia1 = (tComissao - tPix + tCaixinha - finalAjuste1);
            const saldoTotal1 = await calculateSaldoTotal(parseInt(formData.t1_codigo), saldoDia1);

            const record1 = {
                terapeuta_codigo: parseInt(formData.t1_codigo),
                terapeuta_nome: formData.t1_nome,
                comissao: tComissao,
                pix: tPix,
                caixinha: tCaixinha,
                ajustes: finalAjuste1,
                saldo_dia: saldoDia1,
                saldo_total: saldoTotal1,
                data: formData.data,
                hora: new Date().toLocaleTimeString('pt-BR'),
                observacao: observacaoFinal
            };

            const { error: error1 } = await supabase.from('therapist_closings').insert([record1]);
            if (error1) throw error1;

            // PART 2: Save Second Therapist (Destination) if adjustment > 0
            if (tAjustes > 0) {
                let finalAjuste2 = tAjustes; // Always positive for destination

                const saldoDia2 = finalAjuste2 * -1; // Daily balance is negative
                const saldoTotal2 = await calculateSaldoTotal(parseInt(formData.t2_codigo), saldoDia2);

                const record2 = {
                    terapeuta_codigo: parseInt(formData.t2_codigo),
                    terapeuta_nome: formData.t2_nome,
                    comissao: 0,
                    pix: 0,
                    caixinha: 0,
                    ajustes: finalAjuste2,
                    saldo_dia: saldoDia2,
                    saldo_total: saldoTotal2,
                    data: formData.data,
                    hora: new Date().toLocaleTimeString('pt-BR'),
                    observacao: observacaoFinal
                };

                const { error: error2 } = await supabase.from('therapist_closings').insert([record2]);
                if (error2) throw error2;
            }

            // --- Audit Log Implementation ---
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Saldo Colaborador Dias',
                    evento: 'Inclusão de Saldo Colaborador Dias',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.data} - ${formData.t1_codigo} - ${formData.t1_nome} - ${formData.comissao} - ${formData.pix} - ${formData.caixinha} - ${formData.ajustes} - ${formData.observacao || (tAjustes !== 0 ? '' : 'Lançamento-Comissão Manual')}`
                };

                // Get user name from profile if possible
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.full_name) {
                    auditData.usuario = profile.full_name;
                }

                await supabase.from('auditoria').insert([auditData]);
            }
            // --------------------------------

            alert('Fechamento gravado com sucesso!');
            await fetchClosings();

            setFormData(prev => ({
                ...prev,
                comissao: '0.00', pix: '0.00', caixinha: '0.00', ajustes: '0.00',
                t2_codigo: '', t2_nome: '', t2_funcao: '', t2_banco_caixa: 'Não',
                observacao: ''
            }));
        } catch (err) {
            alert('Erro ao gravar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletar = async (id) => {
        if (!window.confirm('Deseja excluir este registro de fechamento?')) return;
        setLoading(true);
        const { error } = await supabase.from('therapist_closings').delete().eq('id', id);
        setLoading(false);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchClosings();
    };

    const handleLimpar = () => {
        setFormData(prev => ({
            ...prev,
            t1_codigo: '', t1_nome: '', t1_funcao: '', t1_banco_caixa: 'Não',
            comissao: '0.00', pix: '0.00', caixinha: '0.00', ajustes: '0.00',
            t2_codigo: '', t2_nome: '', t2_funcao: '', t2_banco_caixa: 'Não',
            observacao: ''
        }));
    };

    const handleGenerateReport = async () => {
        setReportLoading(true);
        try {
            let query = supabase
                .from('therapist_closings')
                .select('*')
                .gte('data', reportParams.dataInicial)
                .lte('data', reportParams.dataFinal)
                .order('data', { ascending: true })
                .order('hora', { ascending: true });

            if (reportParams.terapeuta) {
                if (!isNaN(reportParams.terapeuta)) {
                    query = query.eq('terapeuta_codigo', parseInt(reportParams.terapeuta));
                } else {
                    query = query.ilike('terapeuta_nome', `%${reportParams.terapeuta}%`);
                }
            }

            const { data, error } = await query;
            if (error) {
                alert('Erro ao gerar relatório (Banco): ' + error.message);
                return;
            }

            // GENERATE PDF
            const doc = new jsPDF('landscape');
            doc.setFontSize(14);
            doc.text('Relatório de Saldo Colaborador', 14, 15);
            doc.setFontSize(10);
            const periodStr = `Período: ${formatDate(reportParams.dataInicial)} a ${formatDate(reportParams.dataFinal)}`;
            const therapistStr = reportParams.terapeuta ? ` | Terapeuta: ${reportParams.terapeuta_nome || reportParams.terapeuta}` : '';
            doc.text(periodStr + therapistStr, 14, 22);

            if (data && data.length > 0) {
                const head = [['ID', 'Data', 'Hora', 'Cód.', 'Terapeuta/Assistente', 'Cliente', 'Serviço', 'Comissão', 'Pix', 'Caixinha', 'Ajustes', 'Saldo Dia', 'Saldo Tot.', 'Obs.']];
                
                let totComissao = 0; let totPix = 0; let totCaixinha = 0; let totAjustes = 0;

                const body = data.map(c => {
                    totComissao += c.comissao || 0;
                    totPix += c.pix || 0;
                    totCaixinha += c.caixinha || 0;
                    totAjustes += c.ajustes || 0;

                    return [
                        c.id ? String(c.id) : '',
                        c.data ? formatDate(c.data) : '',
                        c.hora || '',
                        c.terapeuta_codigo ? String(c.terapeuta_codigo) : '',
                        c.terapeuta_nome || '',
                        c.cliente || '',
                        c.servico || '',
                        `R$ ${(c.comissao || 0).toFixed(2)}`,
                        `R$ ${(c.pix || 0).toFixed(2)}`,
                        `R$ ${(c.caixinha || 0).toFixed(2)}`,
                        `R$ ${(c.ajustes || 0).toFixed(2)}`,
                        `R$ ${(c.saldo_dia || 0).toFixed(2)}`,
                        `R$ ${(c.saldo_total || 0).toFixed(2)}`,
                        c.observacao || ''
                    ];
                });

                body.push([
                    '', '', '', '', '', '', 'TOTAIS:', 
                    `R$ ${totComissao.toFixed(2)}`,
                    `R$ ${totPix.toFixed(2)}`,
                    `R$ ${totCaixinha.toFixed(2)}`,
                    `R$ ${totAjustes.toFixed(2)}`,
                    '', '', ''
                ]);

                autoTable(doc, {
                    head: head,
                    body: body,
                    startY: 28,
                    styles: { fontSize: 7, cellPadding: 1 },
                    headStyles: { fillColor: [99, 102, 241] },
                    didParseCell: function (dataInfo) {
                        if (dataInfo.row.index === body.length - 1) {
                            dataInfo.cell.styles.fontStyle = 'bold';
                            dataInfo.cell.styles.fillColor = [241, 245, 249];
                        }
                    }
                });
            } else {
                doc.text('Nenhum registro encontrado no período selecionado.', 14, 30);
            }

            doc.save(`Relatorio_Saldo_Colaborador_${new Date().getTime()}.pdf`);
            setShowReportModal(false);
        } catch (err) {
            console.error(err);
            alert('Erro ao gerar PDF: ' + (err.message || 'Erro inexperado.'));
        } finally {
            setReportLoading(false);
        }
    };

    return (
        <div className="daily-balance-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Saldo Colaborador Dias</h1>
                    <p className="subtitle">Lançamentos manuais, ajustes e fechamento financeiro</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleGravar} disabled={loading}>
                        <FiSave /> Gravar
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowReportModal(true)}>
                        <FiFileText /> Relatório
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Limpar
                    </button>
                </div>
            </header>

            <div className="tdb-main-grid">
                <div className="tdb-form-card">
                    <div className="tdb-form-section-title">Dados do Lançamento</div>

                    <div className="tdb-form-row">
                        <div className="tdb-form-group span-3">
                            <label>Data Movimento</label>
                            <div className="input-with-icon">
                                <input
                                    type="date"
                                    value={formData.data}
                                    onChange={(e) => setFormData(p => ({ ...p, data: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="tdb-form-group span-3 lookup-container">
                            <label>Filtrar Histórico (Cód.)</label>
                            <input
                                type="text"
                                value={historyFilterCode}
                                onChange={e => {
                                    setHistoryFilterCode(e.target.value);
                                    setHistoryFilterName('');
                                    handleSearch('T4', e.target.value);
                                }}
                                onBlur={(e) => fetchTherapistByCode('T4', e.target.value)}
                                placeholder="Colaborador..."
                            />
                            {searchMode === 'T4' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome_abrev || r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="tdb-form-group span-6">
                            <label>Nome (Filtro)</label>
                            <div className="input-with-icon" style={{ position: 'relative' }}>
                                <input 
                                    type="text" 
                                    value={historyFilterName} 
                                    readOnly 
                                    className="readonly-field" 
                                    placeholder="Todos selecionados..."
                                />
                                {historyFilterCode && (
                                     <button 
                                         className="btn-clear-filter" 
                                         title="Remover filtro"
                                         onClick={() => { setHistoryFilterCode(''); setHistoryFilterName(''); }}
                                         style={{ position:'absolute', right:10, top:8, background:'none', border:'none', color:'#ef4444', cursor:'pointer' }}>
                                         <FiX />
                                     </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="tdb-form-row">
                        <div className="tdb-form-group span-3 lookup-container">
                            <label>Cód. Terapeuta (Origem)</label>
                            <input
                                type="text"
                                value={formData.t1_codigo}
                                onChange={(e) => {
                                    setFormData(p => ({ ...p, t1_codigo: e.target.value }));
                                    handleSearch('T1', e.target.value);
                                }}
                                onBlur={(e) => fetchTherapistByCode('T1', e.target.value)}
                            />
                            {searchMode === 'T1' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome_abrev || r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="tdb-form-group span-9">
                            <label>Nome Abreviado</label>
                            <div className="input-with-icon">
                                <input type="text" value={formData.t1_nome} readOnly className="readonly-field" />
                            </div>
                        </div>
                    </div>

                    <div className="tdb-form-row">
                        <div className="tdb-form-group span-3">
                            <label>Comissão (R$)</label>
                            <div className="input-with-icon">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.comissao}
                                    onChange={(e) => setFormData(p => ({ ...p, comissao: e.target.value }))}
                                    disabled={parseFloat(formData.ajustes) > 0}
                                />
                            </div>
                        </div>
                        <div className="form-group span-3">
                            <label>Pix (R$)</label>
                            <div className="input-with-icon">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.pix}
                                    onChange={(e) => setFormData(p => ({ ...p, pix: e.target.value }))}
                                    disabled={parseFloat(formData.ajustes) > 0}
                                />
                            </div>
                        </div>
                        <div className="form-group span-3">
                            <label>Caixinha (R$)</label>
                            <div className="input-with-icon">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.caixinha}
                                    onChange={(e) => setFormData(p => ({ ...p, caixinha: e.target.value }))}
                                    disabled={parseFloat(formData.ajustes) > 0}
                                />
                            </div>
                        </div>
                        <div className="form-group span-3">
                            <label>Ajustes (Transferência)</label>
                            <div className="input-with-icon">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.ajustes}
                                    onChange={(e) => setFormData(p => ({ ...p, ajustes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {parseFloat(formData.ajustes) > 0 && (
                        <div className="adjustment-section animate-fade-in">
                            <div className="section-divider">
                                <span><FiCornerDownRight /> Dados do Destino do Ajuste</span>
                            </div>
                            <div className="tdb-form-row">
                                <div className="tdb-form-group span-3 lookup-container">
                                    <label>Cód. Terapeuta (Destino)</label>
                                    <input
                                        type="text"
                                        value={formData.t2_codigo}
                                        onChange={(e) => {
                                            setFormData(p => ({ ...p, t2_codigo: e.target.value }));
                                            handleSearch('T2', e.target.value);
                                        }}
                                        onBlur={(e) => fetchTherapistByCode('T2', e.target.value)}
                                    />
                                    {searchMode === 'T2' && results.length > 0 && (
                                        <div className="lookup-dropdown">
                                            {results.map(r => (
                                                <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                                    <span className="code">{r.codigo}</span>
                                                    <span className="name">{r.nome_abrev || r.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="tdb-form-group span-9">
                                    <label>Nome Abreviado (Destino)</label>
                                    <div className="input-with-icon">
                                        <input type="text" value={formData.t2_nome} readOnly className="readonly-field" />
                                    </div>
                                </div>
                            </div>
                            <div className="tdb-form-row">
                                <div className="tdb-form-group span-12">
                                    <label>Observação / Motivo do Ajuste</label>
                                    <div className="input-with-icon">
                                        <input
                                            type="text"
                                            placeholder="Descreva o motivo da transferência..."
                                            value={formData.observacao}
                                            onChange={(e) => setFormData(p => ({ ...p, observacao: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="tdb-form-card list-card">
                    <div className="tdb-form-section-title">Histórico do Dia</div>
                    <div className="table-responsive">
                        <table className="sigma-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Hora</th>
                                    <th>Cód.</th>
                                    <th>Nome Abreviado</th>
                                    <th>Cliente</th>
                                    <th>Serviço</th>
                                    <th>Comissão</th>
                                    <th>Pix</th>
                                    <th>Caixinha</th>
                                    <th>Ajustes</th>
                                    <th>Saldo Dia</th>
                                    <th>Saldo Total</th>
                                    <th>Observação</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closings.length === 0 ? (
                                    <tr>
                                        <td colSpan="14" className="text-center">Nenhum lançamento encontrado.</td>
                                    </tr>
                                ) : (
                                    closings.map((c) => (
                                        <tr key={c.id}>
                                            <td>{formatDate(c.data)}</td>
                                            <td>{c.hora}</td>
                                            <td>{c.terapeuta_codigo}</td>
                                            <td>{c.terapeuta_nome_display || c.terapeuta_nome}</td>
                                            <td>{c.cliente || '-'}</td>
                                            <td>{c.servico || '-'}</td>
                                            <td className="text-right">R$ {c.comissao?.toFixed(2)}</td>
                                            <td className="text-right">R$ {c.pix?.toFixed(2)}</td>
                                            <td className="text-right">R$ {c.caixinha?.toFixed(2)}</td>
                                            <td className={`text-right ${c.ajustes < 0 ? 'text-danger' : c.ajustes > 0 ? 'text-success' : ''}`}>
                                                R$ {c.ajustes?.toFixed(2)}
                                            </td>
                                            <td className="text-right font-bold">R$ {c.saldo_dia?.toFixed(2)}</td>
                                            <td className="text-right font-bold" style={{ color: '#6366f1' }}>R$ {c.saldo_total?.toFixed(2)}</td>
                                            <td className="text-small">{c.observacao}</td>
                                            <td>
                                                <button className="btn-icon btn-danger" onClick={() => handleDeletar(c.id)}>
                                                    <FiTrash2 />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showReportModal && (
                <div className="modal-overlay">
                    <div className="modal-content report-modal">
                        <div className="modal-header">
                            <h2>Relatório de Saldo Colaborador</h2>
                            <button className="btn-close" onClick={() => setShowReportModal(false)}><FiX /></button>
                        </div>
                        <div className="modal-body tdb-form-card" style={{ boxShadow: 'none', border: 'none', padding: '1.5rem', margin: 0 }}>
                            <div className="tdb-form-row">
                                <div className="tdb-form-group span-3 lookup-container">
                                    <label>Cód. Terapeuta</label>
                                    <input 
                                        type="text" 
                                        value={reportParams.terapeuta} 
                                        onChange={e => {
                                            setReportParams(p => ({...p, terapeuta: e.target.value, terapeuta_nome: ''}));
                                            handleSearch('T3', e.target.value);
                                        }}
                                        onBlur={(e) => fetchTherapistByCode('T3', e.target.value)}
                                        placeholder="Código..."
                                    />
                                    {searchMode === 'T3' && results.length > 0 && (
                                        <div className="lookup-dropdown">
                                            {results.map(r => (
                                                <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                                    <span className="code">{r.codigo}</span>
                                                    <span className="name">{r.nome_abrev || r.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="tdb-form-group span-9">
                                    <label>Nome do Terapeuta</label>
                                    <div className="input-with-icon">
                                        <input 
                                            type="text" 
                                            value={reportParams.terapeuta_nome} 
                                            readOnly 
                                            className="readonly-field" 
                                            placeholder="Todos se vazio..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="tdb-form-row">
                                <div className="tdb-form-group span-6">
                                    <label>Data Inicial</label>
                                    <input 
                                        type="date" 
                                        value={reportParams.dataInicial} 
                                        onChange={e => setReportParams(p => ({...p, dataInicial: e.target.value}))}
                                    />
                                </div>
                                <div className="tdb-form-group span-6">
                                    <label>Data Final</label>
                                    <input 
                                        type="date" 
                                        value={reportParams.dataFinal} 
                                        onChange={e => setReportParams(p => ({...p, dataFinal: e.target.value}))}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', marginBottom: '1rem' }}>
                                <button className="btn btn-primary" onClick={handleGenerateReport} disabled={reportLoading}>
                                    <FiFileText /> {reportLoading ? 'Gerando...' : 'Gerar e Baixar PDF'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TherapistDailyBalance;
