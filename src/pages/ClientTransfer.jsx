import React, { useState, useEffect } from 'react';
import './ClientTransfer.css';
import {
    FiArrowRight, FiSearch, FiRefreshCw, FiTrash2,
    FiUserMinus, FiUserPlus, FiAlertCircle, FiCheckCircle
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const ClientTransfer = ({ session }) => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');

    // --- Search States ---
    const [searchSource, setSearchSource] = useState('');
    const [resultsSource, setResultsSource] = useState([]);
    const [selectedSource, setSelectedSource] = useState(null);

    const [searchDest, setSearchDest] = useState('');
    const [resultsDest, setResultsDest] = useState([]);
    const [selectedDest, setSelectedDest] = useState(null);

    // --- Context States ---
    const [loja, setLoja] = useState('02');
    const [lojaNome, setLojaNome] = useState('');
    const [dataMovimento, setDataMovimento] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchLojaName();
    }, [loja]);

    const fetchLojaName = async () => {
        const { data } = await supabase.from('stores').select('nome').eq('codigo', parseInt(loja)).single();
        if (data) setLojaNome(data.nome);
    };

    const handleSearch = async (term, side) => {
        if (side === 'source') setSearchSource(term);
        else setSearchDest(term);

        if (!term || term.length < 2) {
            if (side === 'source') setResultsSource([]);
            else setResultsDest([]);
            return;
        }

        let query = supabase.from('customers').select('*');
        if (!isNaN(term)) {
            query = query.or(`codigo.eq.${term},telefone.ilike.%${term}%,celular.ilike.%${term}%`);
        } else {
            query = query.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,celular.ilike.%${term}%`);
        }

        const { data } = await query.limit(5);
        if (side === 'source') setResultsSource(data || []);
        else setResultsDest(data || []);
    };

    const selectClient = (client, side) => {
        if (side === 'source') {
            setSelectedSource(client);
            setSearchSource('');
            setResultsSource([]);
        } else {
            setSelectedDest(client);
            setSearchDest('');
            setResultsDest([]);
        }
    };

    const handleLimpar = () => {
        setSelectedSource(null);
        setSelectedDest(null);
        setProgress(0);
        setStatusText('');
        setSearchSource('');
        setSearchDest('');
    };

    const handleProcessar = async () => {
        if (!selectedSource || !selectedDest) return alert('Selecione ambos os clientes (Origem e Destino)!');
        if (selectedSource.codigo === selectedDest.codigo) return alert('Os clientes de Origem e Destino não podem ser os mesmos!');

        if (!confirm(`Deseja REALMENTE transferir todo o histórico de [${selectedSource.nome}] para [${selectedDest.nome}]?\n\nO cliente de origem será EXCLUÍDO após a transferência.`)) return;

        setLoading(true);
        setProgress(0);
        setStatusText('Iniciando transferência...');

        try {
            // 1. Fetch all transactions for source client to calculate balance and count
            setStatusText('Calculando pontos a transferir...');
            const { data: transactions, error: fetchErr } = await supabase
                .from('billing_transactions')
                .select('*')
                .eq('cliente_codigo', selectedSource.codigo);

            if (fetchErr) throw fetchErr;

            const totalTransactions = transactions?.length || 0;
            let totalPointsToTransfer = 0;

            if (totalTransactions > 0) {
                // Delphi logic: check if client is the one accumulating points (or no special relation)
                // We'll calculate based on the specific movements
                totalPointsToTransfer = transactions.reduce((acc, t) => acc + (t.pontos_pos || 0) - (t.pontos_neg || 0), 0);
            }

            // 2. Update Destination Client Points
            setStatusText('Atualizando pontos no destino...');
            const { error: updDestErr } = await supabase
                .from('customers')
                .update({
                    carimbos: (selectedDest.carimbos || 0) + totalPointsToTransfer,
                    total_pontos: (selectedDest.total_pontos || 0) + (selectedSource.total_pontos || 0),
                    ultmov: dataMovimento
                })
                .eq('codigo', selectedDest.codigo);

            if (updDestErr) throw updDestErr;
            setProgress(30);

            // 3. Update Transactions (The "Processamento 2" from Delphi)
            if (totalTransactions > 0) {
                setStatusText(`Processando ${totalTransactions} transações...`);

                // Chunk updates if many transactions
                const chunkSize = 50;
                for (let i = 0; i < totalTransactions; i += chunkSize) {
                    const chunk = transactions.slice(i, i + chunkSize);
                    const ids = chunk.map(t => t.id);

                    const { error: updTransErr } = await supabase
                        .from('billing_transactions')
                        .update({
                            cliente_codigo: selectedDest.codigo,
                            cliente_nome: selectedDest.nome
                        })
                        .in('id', ids);

                    if (updTransErr) throw updTransErr;

                    const currentProgress = 30 + Math.round(((i + chunk.length) / totalTransactions) * 60);
                    setProgress(currentProgress);
                }
            } else {
                setProgress(90);
            }

            // 4. Delete Source Client
            setStatusText('Excluindo registro de origem...');
            const { error: delErr } = await supabase
                .from('customers')
                .delete()
                .eq('codigo', selectedSource.codigo);

            if (delErr) throw delErr;

            // 5. Audit Log
            setStatusText('Gravando auditoria...');
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
            await supabase.from('auditoria').insert([{
                usuario: profile?.full_name || session.user.email,
                processo: 'Transferência de Clientes',
                evento: 'Transferência Completa',
                data: new Date().toISOString().split('T')[0],
                hora: new Date().toTimeString().split(' ')[0],
                referencia: `De: ${selectedSource.codigo} (${selectedSource.nome}) -> Para: ${selectedDest.codigo} (${selectedDest.nome}) | Pontos: ${totalPointsToTransfer}`
            }]);

            setProgress(100);
            setStatusText('Sucesso! Transferência concluída.');
            alert('Processamento completado, Pontos Transferidos e Cliente Origem Excluído!');
            handleLimpar();

        } catch (err) {
            alert('Erro no processamento: ' + err.message);
            setStatusText('Falha na transferência.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="transfer-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Transferência de Clientes</h1>
                    <p className="subtitle">Mover histórico e pontuação entre cadastros</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleProcessar}
                        disabled={loading || !selectedSource || !selectedDest}
                    >
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                        {loading ? 'Processando...' : 'Processar Transferência'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiTrash2 /> Limpar Campos
                    </button>
                </div>
            </header>

            <div className="context-bar">
                <div className="context-item">
                    <label>Loja/Unidade</label>
                    <span>{loja} - {lojaNome}</span>
                </div>
                <div className="context-item">
                    <label>Data de Movimento</label>
                    <span>{dataMovimento.split('-').reverse().join('/')}</span>
                </div>
            </div>

            <div className="transfer-grid">
                {/* SOURCE CLIENT */}
                <div className="transfer-card source">
                    <div className="card-title">
                        <FiUserMinus style={{ color: '#ef4444' }} /> Cliente de Origem (A SER EXCLUÍDO)
                    </div>

                    <div className="search-section">
                        <div className="search-input-wrapper">
                            <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar cliente origem..."
                                value={searchSource}
                                onChange={(e) => handleSearch(e.target.value, 'source')}
                            />
                        </div>
                        {resultsSource.length > 0 && (
                            <div className="search-results">
                                {resultsSource.map(c => (
                                    <div key={c.codigo} className="result-item" onClick={() => selectClient(c, 'source')}>
                                        <span className="res-code">{c.codigo}</span>
                                        <span className="res-name">{c.nome}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedSource ? (
                        <div className="client-details">
                            <div className="detail-row">
                                <label>Nome Completo</label>
                                <span>{selectedSource.nome}</span>
                            </div>
                            <div className="detail-row">
                                <label>Endereço</label>
                                <span>{selectedSource.endereco || 'Não informado'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Telefone / Celular</label>
                                <span>{selectedSource.telefone || selectedSource.celular || '-'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Data de Cadastro</label>
                                <span>{selectedSource.data_cadastro?.split('-').reverse().join('/') || '-'}</span>
                            </div>
                            <div className="points-badge">
                                <span className="label">Saldo de Pontos</span>
                                <span className="value">{selectedSource.carimbos || 0}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-card-state">
                            <FiUserMinus />
                            <p>Pesquise e selecione o cliente que <br /> terá seus dados transferidos.</p>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#cbd5e1' }}>
                    <FiArrowRight />
                </div>

                {/* DESTINATION CLIENT */}
                <div className="transfer-card destination">
                    <div className="card-title">
                        <FiUserPlus style={{ color: '#10b981' }} /> Cliente de Destino (RECEPTOR)
                    </div>

                    <div className="search-section">
                        <div className="search-input-wrapper">
                            <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Pesquisar cliente destino..."
                                value={searchDest}
                                onChange={(e) => handleSearch(e.target.value, 'dest')}
                            />
                        </div>
                        {resultsDest.length > 0 && (
                            <div className="search-results">
                                {resultsDest.map(c => (
                                    <div key={c.codigo} className="result-item" onClick={() => selectClient(c, 'dest')}>
                                        <span className="res-code">{c.codigo}</span>
                                        <span className="res-name">{c.nome}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedDest ? (
                        <div className="client-details">
                            <div className="detail-row">
                                <label>Nome Completo</label>
                                <span>{selectedDest.nome}</span>
                            </div>
                            <div className="detail-row">
                                <label>Endereço</label>
                                <span>{selectedDest.endereco || 'Não informado'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Telefone / Celular</label>
                                <span>{selectedDest.telefone || selectedDest.celular || '-'}</span>
                            </div>
                            <div className="detail-row">
                                <label>Data de Cadastro</label>
                                <span>{selectedDest.data_cadastro?.split('-').reverse().join('/') || '-'}</span>
                            </div>
                            <div className="points-badge">
                                <span className="label">Saldo de Pontos</span>
                                <span className="value">{selectedDest.carimbos || 0}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-card-state">
                            <FiUserPlus />
                            <p>Pesquise e selecione o cliente que <br /> receberá o histórico e pontos.</p>
                        </div>
                    )}
                </div>

                {loading && (
                    <div className="progress-section">
                        <div className="progress-info">
                            <span>{statusText}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientTransfer;
