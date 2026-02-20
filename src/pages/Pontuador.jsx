import React, { useState, useEffect } from 'react';
import './Pontuador.css';
import {
    FiSave, FiRefreshCw, FiSearch, FiArrowLeft, FiAlertTriangle, FiCheckCircle
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Pontuador = ({ session }) => {
    const [loading, setLoading] = useState(false);
    const [loja, setLoja] = useState('02');
    const [lojaNome, setLojaNome] = useState('');
    const [dataMovimento, setDataMovimento] = useState(new Date().toISOString().split('T')[0]);
    const [diaSemana, setDiaSemana] = useState('');
    const [nomeDia, setNomeDia] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [redirectInfo, setRedirectInfo] = useState(null);

    const [pointsPos, setPointsPos] = useState('0');
    const [pointsNeg, setPointsNeg] = useState('0');

    const weekdayNames = ["", "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    useEffect(() => {
        calculateDateInfo();
        fetchLojaName();
    }, [dataMovimento, loja]);

    const calculateDateInfo = () => {
        const d = new Date(dataMovimento + 'T12:00:00');
        const dow = d.getDay() + 1; // 1=Sun, 7=Sat
        setDiaSemana(dow.toString());
        setNomeDia(weekdayNames[dow]);
    };

    const fetchLojaName = async () => {
        const { data } = await supabase.from('stores').select('nome').eq('codigo', parseInt(loja)).single();
        if (data) setLojaNome(data.nome);
        else setLojaNome('Loja não cadastrada');
    };

    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (!term) {
            setCustomers([]);
            return;
        }

        let query = supabase.from('customers').select('*');
        if (!isNaN(term)) {
            query = query.or(`codigo.eq.${term},telefone.ilike.%${term}%,celular.ilike.%${term}%`);
        } else {
            query = query.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,celular.ilike.%${term}%`);
        }

        const { data } = await query.limit(10);
        if (data) setCustomers(data);
    };

    const handleSelectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setSearchTerm('');
        setCustomers([]);
        setRedirectInfo(null);

        // Check if accumulates for another client
        if (customer.acumula_pontos_codigo && customer.acumula_pontos_codigo !== customer.codigo) {
            const { data: target } = await supabase
                .from('customers')
                .select('nome, carimbos')
                .eq('codigo', customer.acumula_pontos_codigo)
                .single();

            if (target) {
                setRedirectInfo({
                    codigo: customer.acumula_pontos_codigo,
                    nome: target.nome,
                    carimbos: target.carimbos
                });
            }
        }
    };

    const handleLimpar = () => {
        setSelectedCustomer(null);
        setRedirectInfo(null);
        setPointsPos('0');
        setPointsNeg('0');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        if (!selectedCustomer) return alert('Selecione um cliente!');

        const pos = parseInt(pointsPos) || 0;
        const neg = parseInt(pointsNeg) || 0;

        if (pos === 0 && neg === 0) return alert('Informe a pontuação (Positiva ou Negativa)!');
        if (pos !== 0 && neg !== 0) return alert('Preencha apenas UM dos campos de pontuação!');
        if (pos > 20 || neg > 20) return alert('Pontuação máxima permitida é 20!');

        // Delphi logic: check if client points < negative to subtract
        const currentPoints = redirectInfo ? redirectInfo.carimbos : selectedCustomer.carimbos;
        if (neg > 0 && currentPoints < neg) {
            return alert('Não é permitido subtrair pontos: saldo insuficiente!');
        }

        if (!confirm('Confirma a gravação da pontuação?')) return;

        setLoading(true);
        try {
            // 1. Get Sequence Faturamento - Robust lookup (same as Billing.jsx)
            let dateRec = null;

            // Try Standard 'YYYY-MM-DD'
            const { data: dStandard, error: eStandard } = await supabase
                .from('dates_calendar')
                .select('id, sequencia_faturamento')
                .eq('loja_codigo', parseInt(loja))
                .eq('data', dataMovimento)
                .maybeSingle();

            if (dStandard) {
                dateRec = dStandard;
            } else {
                // Try Legacy 'YYYYMMDD' (just in case)
                const legacyDate = dataMovimento.replace(/-/g, '');
                const { data: dLegacy } = await supabase
                    .from('dates_calendar')
                    .select('id, sequencia_faturamento')
                    .eq('loja_codigo', parseInt(loja))
                    .eq('data', legacyDate)
                    .maybeSingle();

                if (dLegacy) dateRec = dLegacy;
            }

            if (!dateRec) {
                throw new Error(`Data ${dataMovimento.split('-').reverse().join('/')} não encontrada no calendário da loja ${loja}! Verifique se o ano foi gerado no cadastro de Datas.`);
            }

            const nextSeq = (dateRec.sequencia_faturamento || 0) + 1;
            await supabase.from('dates_calendar').update({ sequencia_faturamento: nextSeq }).eq('id', dateRec.id);

            // 2. Record Movement (Billing transaction)
            const movement = {
                data: dataMovimento,
                cliente_codigo: selectedCustomer.codigo,
                cliente_nome: selectedCustomer.nome,
                sequencia: nextSeq,
                terapeuta_codigo: 888888, // Special for manual points
                terapeuta_nome: 'Soma-Subtrai',
                produto_codigo: 888888,
                produto_descricao: 'Pontuador Manual',
                pontos_pos: pos,
                pontos_neg: neg,
                loja_codigo: parseInt(loja),
                hora_inicio: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };

            const { error: moveError } = await supabase.from('billing_transactions').insert([movement]);
            if (moveError) throw moveError;

            // 3. Update Customer Points
            const clientCode = selectedCustomer.codigo;
            const accumCode = redirectInfo ? redirectInfo.codigo : clientCode;

            // Update original client's total_pontos (historical)
            const { error: updClient1 } = await supabase.from('customers')
                .update({
                    total_pontos: (selectedCustomer.total_pontos || 0) + pos,
                    ultmov: dataMovimento
                })
                .eq('codigo', clientCode);
            if (updClient1) throw updClient1;

            // Update accumulation target's carimbos (current points)
            const targetPoints = redirectInfo ? redirectInfo.carimbos : selectedCustomer.carimbos;
            const { error: updClient2 } = await supabase.from('customers')
                .update({
                    carimbos: (targetPoints || 0) + pos - neg,
                    ultmov: dataMovimento
                })
                .eq('codigo', accumCode);
            if (updClient2) throw updClient2;

            // 4. Audit Log
            if (session?.user) {
                const now = new Date();
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();

                await supabase.from('auditoria').insert([{
                    usuario: profile?.full_name || session.user.email,
                    processo: 'Pontuador Manual',
                    evento: 'Manutenção de Pontos',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `Cliente: ${selectedCustomer.codigo} (${selectedCustomer.nome}) - Ptos: +${pos}/-${neg}`
                }]);
            }

            alert('Pontuação gravada com sucesso!');
            handleLimpar();
        } catch (err) {
            alert('Erro ao gravar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pontuador-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Pontuador de Clientes</h1>
                    <p className="subtitle">Manutenção manual de pontuação e histórico</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleGravar} disabled={loading}>
                        <FiSave /> Gravar Pontuação
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiRefreshCw /> Limpar
                    </button>
                </div>
            </header>

            <div className="form-card">
                <div className="form-grid">
                    <div className="form-section-title span-12">Contexto de Movimentação</div>

                    <div className="form-group sm">
                        <label>Loja</label>
                        <input type="text" value={loja} onChange={(e) => setLoja(e.target.value)} maxLength="2" />
                    </div>
                    <div className="form-group lg">
                        <label>Unidade</label>
                        <input type="text" value={lojaNome} disabled />
                    </div>
                    <div className="form-group md">
                        <label>Data Movimento</label>
                        <input type="date" value={dataMovimento} onChange={(e) => setDataMovimento(e.target.value)} />
                    </div>
                    <div className="form-group sm">
                        <label>Dia Semana</label>
                        <input type="text" value={diaSemana} disabled />
                    </div>
                    <div className="form-group sm">
                        <label>Nome Dia</label>
                        <input type="text" value={nomeDia} disabled />
                    </div>

                    <div className="form-section-title span-12">Busca e Seleção de Cliente</div>

                    <div className="span-12 search-bar">
                        <div className="search-input-wrapper">
                            <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar por código, nome, telefone ou celular..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                        {customers.length > 0 && (
                            <div className="search-results">
                                {customers.map(c => (
                                    <div key={c.codigo} className="result-item" onClick={() => handleSelectCustomer(c)}>
                                        <span className="res-code">{c.codigo}</span>
                                        <span className="res-name">{c.nome}</span>
                                        <span className="res-phone">{c.telefone || c.celular}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedCustomer && (
                        <>
                            <div className="form-group sm">
                                <label>Código</label>
                                <input type="text" value={selectedCustomer.codigo} disabled />
                            </div>
                            <div className="form-group xl">
                                <label>Nome</label>
                                <input type="text" value={selectedCustomer.nome} disabled />
                            </div>
                            <div className="form-group lg">
                                <label>Telefone/Celular</label>
                                <input type="text" value={selectedCustomer.telefone || selectedCustomer.celular} disabled />
                            </div>

                            <div className="points-card">
                                <div className="point-stat">
                                    <label>Pontos Atuais</label>
                                    <span className="value">{selectedCustomer.carimbos || 0}</span>
                                </div>
                                <div className="point-stat">
                                    <label>Pontos Históricos</label>
                                    <span className="value">{selectedCustomer.total_pontos || 0}</span>
                                </div>
                                <div className="point-stat">
                                    <label>Último Movimento</label>
                                    <span className="value">{selectedCustomer.ultmov ? selectedCustomer.ultmov.split('-').reverse().join('/') : '-'}</span>
                                </div>
                            </div>

                            {redirectInfo && (
                                <div className="redirect-banner">
                                    <FiAlertTriangle />
                                    <div>
                                        <strong>Atenção:</strong> Este cliente acumula pontos em:
                                        <strong> {redirectInfo.codigo} - {redirectInfo.nome} </strong>
                                        (Saldo Atual: {redirectInfo.carimbos})
                                    </div>
                                </div>
                            )}

                            <div className="points-inputs">
                                <div className="input-points-group pos">
                                    <label>PONTOS POSITIVOS (+)</label>
                                    <input
                                        type="number"
                                        value={pointsPos}
                                        onChange={(e) => { setPointsPos(e.target.value); setPointsNeg('0'); }}
                                        min="0" max="20"
                                    />
                                </div>
                                <div className="input-points-group neg">
                                    <label>PONTOS NEGATIVOS (-)</label>
                                    <input
                                        type="number"
                                        value={pointsNeg}
                                        onChange={(e) => { setPointsNeg(e.target.value); setPointsPos('0'); }}
                                        min="0" max="20"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pontuador;
