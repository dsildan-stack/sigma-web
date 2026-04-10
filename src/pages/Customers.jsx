import React, { useState, useEffect } from 'react';
import './Customers.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight, FiMapPin,
    FiUser, FiAward, FiMail, FiPhone, FiClock, FiDollarSign
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Customers = ({ session }) => {
    const [status, setStatus] = useState('Criar'); // 'Criar' | 'Editar'
    const [activeTab, setActiveTab] = useState('geral');
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        codigo: '',
        nome: '',
        endereco: '',
        bairro: '',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '',
        aniversario: '',
        sexo: 'M',
        telefone: '',
        celular: '',
        email: '',
        ficticio: 'F',
        acumula_pontos_codigo: '',
        folha: '',
        data_cadastro: new Date().toISOString().split('T')[0],
        ultmov: '',
        carimbos: '0',
        total_pontos: '0',
        // Premiações
        premio1_check: false, premio1_data: '', premio1_cliente_codigo: '',
        premio2_check: false, premio2_data: '', premio2_cliente_codigo: '',
        premio3_check: false, premio3_data: '', premio3_cliente_codigo: '',
    });

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (status === 'Criar' && !formData.codigo) {
            handleLimpar();
        }
        fetchCustomers();
    }, [searchTerm]);

    const fetchCustomers = async () => {
        const trimmedTerm = searchTerm.trim();

        if (!trimmedTerm) {
            setCustomers([]);
            return;
        }

        let queryStr = "";
        if (!isNaN(trimmedTerm)) {
            // Se for número, busca por código exato ou telefone/celular parcial
            queryStr = `codigo.eq.${trimmedTerm},telefone.ilike.%${trimmedTerm}%,celular.ilike.%${trimmedTerm}%`;
        } else {
            // Se for texto, busca por nome, telefone ou celular parcial
            queryStr = `nome.ilike.%${trimmedTerm}%,telefone.ilike.%${trimmedTerm}%,celular.ilike.%${trimmedTerm}%`;
        }

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .or(queryStr)
            .limit(100);

        if (error) {
            console.error('Erro ao buscar clientes:', error);
            alert('Erro na pesquisa: ' + error.message);
            return;
        }

        if (data) setCustomers(data);
    };

    const handleInputChange = (e) => {
        let { name, value, type, checked } = e.target;

        if (name === 'telefone' || name === 'celular') {
            let v = value.replace(/\D/g, '');
            let isCelular = name === 'celular';
            let hasZero = v.startsWith('0');
            let dddLen = hasZero ? 3 : 2;
            
            let maxLen = dddLen + (isCelular ? 9 : 8);
            if (v.length > maxLen) v = v.substring(0, maxLen);
            
            if (v.length > dddLen) {
                let ddd = v.substring(0, dddLen);
                let rest = v.substring(dddLen);
                let prefixLen = isCelular ? 5 : 4;
                if (rest.length > prefixLen) {
                    value = `(${ddd})${rest.substring(0, prefixLen)}-${rest.substring(prefixLen)}`;
                } else {
                    value = `(${ddd})${rest}`;
                }
            } else if (v.length > 0) {
                value = `(${v}`;
            } else {
                value = '';
            }
        } else if (name === 'cep') {
            let v = value.replace(/\D/g, '');
            if (v.length > 8) v = v.substring(0, 8);
            if (v.length > 5) {
                value = `${v.substring(0, 5)}-${v.substring(5)}`;
            } else {
                value = v;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSelectCustomer = (customer) => {
        setFormData({
            ...customer,
            codigo: customer.codigo.toString(),
            aniversario: customer.aniversario || '',
            ultmov: customer.ultmov || '',
            carimbos: customer.carimbos?.toString() || '0',
            total_pontos: customer.total_pontos?.toString() || '0',
            acumula_pontos_codigo: customer.acumula_pontos_codigo?.toString() || customer.codigo.toString()
        });
        setStatus('Editar');
        setActiveTab('geral');
    };

    const handleLimpar = async () => {
        // Get last code
        const { data } = await supabase.from('customers').select('codigo').order('codigo', { ascending: false }).limit(1);
        const nextCodigo = data && data[0] ? (data[0].codigo + 1).toString() : '1';

        setFormData({
            codigo: nextCodigo,
            nome: '', endereco: '', bairro: '', cidade: 'São Paulo', estado: 'SP',
            cep: '', aniversario: '', sexo: 'M', telefone: '', celular: '',
            email: '', ficticio: 'F', acumula_pontos_codigo: nextCodigo, folha: '',
            data_cadastro: new Date().toISOString().split('T')[0],
            ultmov: '',
            carimbos: '0', total_pontos: '0',
            premio1_check: false, premio1_data: '', premio1_cliente_codigo: '',
            premio2_check: false, premio2_data: '', premio2_cliente_codigo: '',
            premio3_check: false, premio3_data: '', premio3_cliente_codigo: '',
        });
        setStatus('Criar');
        setActiveTab('geral');
    };

    const handleGravar = async () => {
        if (!formData.nome) return alert('Campo Nome é obrigatório!');
        if (!formData.endereco) return alert('Endereço é obrigatório!');
        if (!formData.codigo) return alert('Erro: Código do cliente não gerado.');

        setLoading(true);
        const { id, created_at, ...cleanFormData } = formData;

        const payload = {
            ...cleanFormData,
            codigo: parseInt(formData.codigo),
            carimbos: parseFloat(formData.carimbos || '0'),
            total_pontos: parseFloat(formData.total_pontos || '0'),
            acumula_pontos_codigo: (formData.acumula_pontos_codigo && parseInt(formData.acumula_pontos_codigo) > 0)
                ? parseInt(formData.acumula_pontos_codigo)
                : parseInt(formData.codigo),
            premio1_cliente_codigo: (formData.premio1_cliente_codigo && parseInt(formData.premio1_cliente_codigo) > 0) ? parseInt(formData.premio1_cliente_codigo) : null,
            premio2_cliente_codigo: (formData.premio2_cliente_codigo && parseInt(formData.premio2_cliente_codigo) > 0) ? parseInt(formData.premio2_cliente_codigo) : null,
            premio3_cliente_codigo: (formData.premio3_cliente_codigo && parseInt(formData.premio3_cliente_codigo) > 0) ? parseInt(formData.premio3_cliente_codigo) : null,
            aniversario: formData.aniversario || null,
            premio1_data: formData.premio1_data || null,
            premio2_data: formData.premio2_data || null,
            premio3_data: formData.premio3_data || null,
            data_cadastro: formData.data_cadastro,
            ultmov: formData.ultmov || null
        };

        const { error } = status === 'Criar'
            ? await supabase.from('customers').insert([payload])
            : await supabase.from('customers').update(payload).eq('id', formData.id);

        setLoading(false);
        if (error) {
            alert('Erro ao gravar: ' + error.message);
        } else {
            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email, // Or fetch name from profile if available in session metadata
                    processo: 'Cadastro de Clientes',
                    evento: status === 'Criar' ? 'Inclusão de Clientes' : 'Alteração de Clientes',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.codigo} - ${formData.nome}`
                };

                // Get user name from profile if possible, otherwise fallback to email
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.full_name) {
                    auditData.usuario = profile.full_name;
                }

                const { error: auditError } = await supabase.from('auditoria').insert([auditData]);
                if (auditError) {
                    console.error('Erro ao gravar auditoria:', auditError);
                    alert('Erro ao gravar auditoria: ' + auditError.message);
                }
            }

            alert(`Cliente ${status === 'Criar' ? 'gravado' : 'atualizado'} com sucesso!`);
            handleLimpar();
            fetchCustomers();
        }
    };

    const handleDeletar = async () => {
        if (!window.confirm('Confirma a exclusão deste cliente?')) return;
        setLoading(true);
        const { error } = await supabase.from('customers').delete().eq('id', formData.id);
        setLoading(false);
        if (error) {
            alert('Erro ao deletar: ' + error.message);
        } else {
            handleLimpar();
            fetchCustomers();
        }
    };

    const fetchCustomerHistory = async () => {
        if (!formData.codigo) return alert('Selecione um cliente primeiro!');

        setLoadingHistory(true);
        setShowHistory(true);

        const { data, error } = await supabase
            .from('billing_transactions')
            .select('*')
            .eq('cliente_codigo', parseInt(formData.codigo))
            .order('data', { ascending: false });

        setLoadingHistory(false);
        if (error) {
            alert('Erro ao buscar histórico: ' + error.message);
        } else {
            setHistoryData(data || []);
        }
    };

    const handleOpenBilling = () => {
        if (!formData.codigo) return alert('Selecione um cliente primeiro!');
        const url = `${window.location.origin}${window.location.pathname}?page=faturamento&client_code=${formData.codigo}`;
        window.open(url, '_blank');
    };

    return (
        <div className="customers-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Clientes</h1>
                    <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleGravar} title="Gravar (F10)">
                        <FiSave /> Gravar
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Novo
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={fetchCustomerHistory}
                        disabled={!formData.codigo || status === 'Criar'}
                        title="Ver histórico de transações"
                    >
                        <FiClock /> Histórico
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleOpenBilling}
                        disabled={!formData.codigo || status === 'Criar'}
                        title="Abrir faturamento para este cliente"
                        style={{ backgroundColor: '#10b981' }}
                    >
                        <FiDollarSign /> Faturamento
                    </button>
                    {status === 'Editar' && (
                        <button className="btn btn-danger" onClick={handleDeletar} disabled={loading}>
                            <FiTrash2 /> {loading ? 'Deletando...' : 'Deletar'}
                        </button>
                    )}
                </div>
            </header>

            <div className="search-bar">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome, telefone, celular ou código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && customers.length > 0 && (
                        <div className="search-results">
                            {customers.map(c => (
                                <div key={c.id} className="result-item" onClick={() => { handleSelectCustomer(c); setSearchTerm(''); }}>
                                    <span className="res-code">{c.codigo}</span>
                                    <span className="res-name">{c.nome}</span>
                                    <span className="res-phone">{c.telefone || c.celular}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="navigation-controls">
                    <button className="nav-btn"><FiChevronLeft /></button>
                    <button className={`nav-btn ${loading ? 'spinning' : ''}`}><FiChevronRight /></button>
                </div>
            </div>

            <div className="form-card">
                <div className="form-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'geral' ? 'active' : ''}`}
                        onClick={() => setActiveTab('geral')}
                    >
                        <FiUser /> Dados Gerais
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'endereco' ? 'active' : ''}`}
                        onClick={() => setActiveTab('endereco')}
                    >
                        <FiMapPin /> Endereço & Contato
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'premios' ? 'active' : ''}`}
                        onClick={() => setActiveTab('premios')}
                    >
                        <FiAward /> Pontos & Prêmios
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'geral' && (
                        <div className="form-grid">
                            <div className="form-group sm">
                                <label>Código</label>
                                <input type="text" name="codigo" value={formData.codigo} disabled />
                            </div>
                            <div className="form-group xl-8">
                                <label>Nome Completo</label>
                                <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} autoFocus />
                            </div>
                            <div className="form-group sm">
                                <label>Sexo (M/F)</label>
                                <select name="sexo" value={formData.sexo} onChange={handleInputChange}>
                                    <option value="M">Masculino</option>
                                    <option value="F">Feminino</option>
                                </select>
                            </div>
                            <div className="form-group md">
                                <label>Data de Aniversário</label>
                                <input type="date" name="aniversario" value={formData.aniversario} onChange={handleInputChange} />
                            </div>
                            <div className="form-group lg">
                                <label>V/F (Fictício)</label>
                                <select name="ficticio" value={formData.ficticio} onChange={handleInputChange}>
                                    <option value="V">Verdadeiro</option>
                                    <option value="F">Fictício</option>
                                </select>
                            </div>
                            <div className="form-group lg">
                                <label>E-mail</label>
                                <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
                            </div>
                            <div className="form-group md">
                                <label>Mês Aniv (Folha)</label>
                                <input type="text" value={formData.folha} disabled />
                            </div>
                            <div className="form-group md">
                                <label>Data Último Mov</label>
                                <input type="date" name="ultmov" value={formData.ultmov} disabled />
                            </div>
                            <div className="form-group md">
                                <label>Cliente Desde</label>
                                <input
                                    type="text"
                                    value={formData.data_cadastro ? formData.data_cadastro.split('-').reverse().join('/') : ''}
                                    disabled
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'endereco' && (
                        <div className="form-grid">
                            <div className="form-group sm">
                                <label>CEP</label>
                                <input type="text" name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00000-000" />
                            </div>
                            <div className="form-group lg">
                                <label>Endereço</label>
                                <input type="text" name="endereco" value={formData.endereco} onChange={handleInputChange} />
                            </div>
                            <div className="form-group md">
                                <label>Bairro</label>
                                <input type="text" name="bairro" value={formData.bairro} onChange={handleInputChange} />
                            </div>
                            <div className="form-group md">
                                <label>Cidade</label>
                                <input type="text" name="cidade" value={formData.cidade} onChange={handleInputChange} />
                            </div>
                            <div className="form-group sm">
                                <label>Estado</label>
                                <input type="text" name="estado" value={formData.estado} onChange={handleInputChange} maxLength="2" />
                            </div>
                            <div className="form-group md">
                                <label>Telefone</label>
                                <input type="text" name="telefone" value={formData.telefone} onChange={handleInputChange} />
                            </div>
                            <div className="form-group md">
                                <label>Celular</label>
                                <input type="text" name="celular" value={formData.celular} onChange={handleInputChange} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'premios' && (
                        <div className="premios-section">
                            <div className="points-overview">
                                <div className="stat-card">
                                    <label>Acumula Pontos em (ID)</label>
                                    <input type="number" name="acumula_pontos_codigo" value={formData.acumula_pontos_codigo} onChange={handleInputChange} />
                                </div>
                                <div className="stat-card">
                                    <label>Total de Pontos</label>
                                    <span className="value">{formData.total_pontos}</span>
                                </div>
                                <div className="stat-card">
                                    <label>PONTOS HISTORICOS</label>
                                    <input type="number" name="carimbos" value={formData.carimbos} disabled />
                                </div>
                            </div>

                            <div className="premios-list">
                                <h3>Histórico de Premiações</h3>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`premio-item ${formData[`premio${i}_check`] ? 'checked' : ''}`}>
                                        <input
                                            type="checkbox"
                                            name={`premio${i}_check`}
                                            checked={formData[`premio${i}_check`]}
                                            onChange={handleInputChange}
                                        />
                                        <div className="premio-fields">
                                            <div className="form-group sm">
                                                <label>Data</label>
                                                <input type="date" name={`premio${i}_data`} value={formData[`premio${i}_data`]} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group sm">
                                                <label>ID Cliente</label>
                                                <input type="number" name={`premio${i}_cliente_codigo`} value={formData[`premio${i}_cliente_codigo`]} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showHistory && (
                <div className="modal-overlay">
                    <div className="history-modal">
                        <header className="modal-header">
                            <h2>Histórico de Transações - {formData.nome}</h2>
                            <button className="close-btn" onClick={() => setShowHistory(false)}><FiX /></button>
                        </header>
                        <div className="modal-body">
                            {loadingHistory ? (
                                <div className="loading-state">Carregando histórico...</div>
                            ) : historyData.length === 0 ? (
                                <div className="empty-state">Nenhuma transação encontrada para este cliente.</div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="history-table">
                                        <thead>
                                            <tr>
                                                <th>Cód. Cliente</th>
                                                <th>Nome Cliente</th>
                                                <th>Data</th>
                                                <th>Dia Semana</th>
                                                <th>Seq.</th>
                                                <th>Terapeuta</th>
                                                <th>Produto</th>
                                                <th>Hora Início</th>
                                                <th>Ptos (+)</th>
                                                <th>Ptos (-)</th>
                                                <th>Vlr Original</th>
                                                <th>Vlr Pago</th>
                                                <th>Moeda</th>
                                                <th>Moeda 1</th>
                                                <th>Vlr Pago 1</th>
                                                <th>Moeda 2</th>
                                                <th>Vlr Pago 2</th>
                                                <th>Acumula ID</th>
                                                <th>Pref.</th>
                                                <th>Agendou</th>
                                                <th>Controle Venda</th>
                                                <th>Caixinha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.cliente_codigo}</td>
                                                    <td>{item.cliente_nome}</td>
                                                    <td>{item.data ? item.data.split('-').reverse().join('/') : '-'}</td>
                                                    <td>{item.dia_semana}</td>
                                                    <td>{item.sequencia}</td>
                                                    <td>{item.terapeuta_nome}</td>
                                                    <td>{item.produto_descricao}</td>
                                                    <td>{item.hora_inicio}</td>
                                                    <td>{item.pontos_pos}</td>
                                                    <td>{item.pontos_neg}</td>
                                                    <td>{item.valor_original ? parseFloat(item.valor_original).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                    <td>{item.valor_pagamento ? parseFloat(item.valor_pagamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                    <td>{item.tipo_moeda}</td>
                                                    <td>{item.tipo_moeda1}</td>
                                                    <td>{item.valor_pagamento1 ? parseFloat(item.valor_pagamento1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                    <td>{item.tipo_moeda2}</td>
                                                    <td>{item.valor_pagamento2 ? parseFloat(item.valor_pagamento2).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                    <td>{item.acumula_cliente_codigo}</td>
                                                    <td>{item.preferencia}</td>
                                                    <td>{item.agendou}</td>
                                                    <td>{item.num_controle_venda}</td>
                                                    <td>{item.caixinha ? parseFloat(item.caixinha).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Customers;
