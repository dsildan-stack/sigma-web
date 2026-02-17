import React, { useState, useEffect, useRef } from 'react';
import './TherapistDailyBalance.css';
import {
    FiSave, FiTrash2, FiSearch, FiPlus,
    FiUser, FiDollarSign, FiCalendar, FiFileText,
    FiCornerDownRight, FiInfo, FiLayers
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const TherapistDailyBalance = () => {
    // --- UI/Progress State ---
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [searchMode, setSearchMode] = useState(null); // T1 | T2
    const [closings, setClosings] = useState([]);

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

    // --- Initialization ---
    useEffect(() => {
        fetchClosings();
    }, []);

    // --- Data Fetching ---
    const fetchClosings = async () => {
        const { data, error } = await supabase
            .from('therapist_closings')
            .select('*')
            .order('terapeuta_codigo', { ascending: true })
            .order('data', { ascending: true })
            .order('hora', { ascending: true });

        if (data) setClosings(data);
    };

    const handleSearch = async (type, term) => {
        if (!term) {
            setResults([]);
            setSearchMode(null);
            return;
        }

        setSearchMode(type);
        let query = supabase.from('therapists').select('codigo, nome, cod_funcao, banco_caixa');

        if (!isNaN(term)) {
            query = query.eq('codigo', parseInt(term));
        } else {
            query = query.ilike('nome', `%${term}%`);
        }

        const { data } = await query.limit(10);
        setResults(data || []);
    };

    const handleSelectResult = (item) => {
        if (searchMode === 'T1') {
            setFormData(prev => ({
                ...prev,
                t1_codigo: item.codigo.toString(),
                t1_nome: item.nome,
                t1_funcao: item.cod_funcao,
                t1_banco_caixa: item.banco_caixa || 'Não'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                t2_codigo: item.codigo.toString(),
                t2_nome: item.nome,
                t2_funcao: item.cod_funcao,
                t2_banco_caixa: item.banco_caixa || 'Não'
            }));
        }
        setResults([]);
        setSearchMode(null);
    };

    const fetchTherapistByCode = async (type, code) => {
        if (!code) return;
        const { data } = await supabase
            .from('therapists')
            .select('codigo, nome, cod_funcao, banco_caixa')
            .eq('codigo', parseInt(code))
            .single();

        if (data) {
            if (type === 'T1') {
                setFormData(p => ({ ...p, t1_nome: data.nome, t1_funcao: data.cod_funcao, t1_banco_caixa: data.banco_caixa || 'Não' }));
            } else {
                setFormData(p => ({ ...p, t2_nome: data.nome, t2_funcao: data.cod_funcao, t2_banco_caixa: data.banco_caixa || 'Não' }));
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

            // Special Signal Logic using banco_caixa
            if (tAjustes > 0) {
                // If origin is "Banco/Caixa" and dest is NOT "Banco/Caixa" -> AJUSTE IS NEGATIVE for origin
                if (formData.t1_banco_caixa === 'Sim' && formData.t2_banco_caixa !== 'Sim') {
                    finalAjuste1 = tAjustes * -1;
                } else if (formData.t1_banco_caixa !== 'Sim' && formData.t2_banco_caixa === 'Sim') {
                    finalAjuste1 = tAjustes;
                } else if (formData.t1_banco_caixa !== 'Sim' && formData.t2_banco_caixa !== 'Sim') {
                    // Both not "Banco/Caixa" -> Adjustment is negative for origin
                    finalAjuste1 = tAjustes * -1;
                }
            }

            const saldoDia1 = tAjustes !== 0 ? finalAjuste1 : (tComissao - tPix + tCaixinha);
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
                let finalAjuste2 = tAjustes;
                // In Delphi, the second passage sign logic:
                if (formData.t1_banco_caixa === 'Sim' && formData.t2_banco_caixa !== 'Sim') {
                    finalAjuste2 = tAjustes * -1; // Negative
                } else {
                    finalAjuste2 = tAjustes; // Positive
                }

                const saldoDia2 = finalAjuste2;
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

            alert('Fechamento gravado com sucesso!');
            // Refresh history for the current therapist BEFORE clearing if needed
            // or just clear but keep the grid populated for the last action
            await fetchClosings();

            // Delphi cleared everything, we will too, but carefully
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
        setClosings([]);
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
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Limpar
                    </button>
                </div>
            </header>

            <div className="tdb-main-grid">
                <div className="tdb-form-card">
                    <div className="tdb-form-section-title">Dados do Lançamento</div>

                    <div className="tdb-form-row">
                        <div className="tdb-form-group span-4">
                            <label>Data Movimento</label>
                            <div className="input-with-icon">
                                <input
                                    type="date"
                                    value={formData.data}
                                    onChange={(e) => setFormData(p => ({ ...p, data: e.target.value }))}
                                />
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
                                            <span className="name">{r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="tdb-form-group span-9">
                            <label>Nome do Terapeuta</label>
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
                                                    <span className="name">{r.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="tdb-form-group span-9">
                                    <label>Nome do Terapeuta Destino</label>
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
                                    <th>Nome</th>
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
                                        <td colSpan="12" className="text-center">Nenhum lançamento encontrado.</td>
                                    </tr>
                                ) : (
                                    closings.map((c) => (
                                        <tr key={c.id}>
                                            <td>{formatDate(c.data)}</td>
                                            <td>{c.hora}</td>
                                            <td>{c.terapeuta_codigo}</td>
                                            <td>{c.terapeuta_nome}</td>
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
        </div>
    );
};

export default TherapistDailyBalance;
