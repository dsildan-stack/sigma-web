import React, { useState, useEffect } from 'react';
import './Currencies.css';
import {
    FiSave, FiTrash2, FiPlus,
    FiChevronRight,
    FiCheckSquare, FiX
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Currencies = ({ session }) => {
    const [status, setStatus] = useState('Criar');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [currencies, setCurrencies] = useState([]);

    const [formData, setFormData] = useState({
        product_code: '',
        currency_code: '',
        currency_name: '',
        valor: '0.00',
        product_name: ''
    });

    useEffect(() => {
        fetchCurrencies();
    }, [searchTerm]);

    const fetchCurrencies = async () => {
        let query = supabase.from('product_currencies').select('*');
        if (searchTerm) {
            query = query.or(`currency_name.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%`);
        }
        const { data } = await query.limit(50).order('product_name');
        if (data) setCurrencies(data);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProductBlur = async () => {
        if (!formData.product_code) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('nome')
            .eq('codigo', formData.product_code)
            .single();

        if (data) {
            setFormData(prev => ({ ...prev, product_name: data.nome }));
        } else {
            alert('Produto não encontrado!');
            setFormData(prev => ({ ...prev, product_name: '', product_code: '' }));
        }
        setLoading(false);
    };

    const handleCurrencyBlur = async () => {
        if (!formData.product_code || !formData.currency_code) return;

        setLoading(true);
        const { data } = await supabase
            .from('product_currencies')
            .select('*')
            .eq('product_code', formData.product_code)
            .eq('currency_code', formData.currency_code)
            .single();

        if (data) {
            setFormData({
                ...data,
                valor: data.valor.toString()
            });
            setStatus('Editar');
        } else {
            setStatus('Criar');
        }
        setLoading(false);
    };

    const handleLimpar = () => {
        setFormData({
            product_code: '',
            currency_code: '',
            currency_name: '',
            valor: '0.00',
            product_name: ''
        });
        setStatus('Criar');
        setSearchTerm('');
    };

    const handleSelectCurrency = (c) => {
        setFormData({
            ...c,
            valor: c.valor.toString()
        });
        setStatus('Editar');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        if (!formData.product_code) return alert('Código do Produto em branco!');
        if (!formData.currency_code) return alert('Código da Moeda em branco!');
        if (!formData.currency_name) return alert('Nome da Moeda em branco!');
        if (isNaN(parseFloat(formData.valor))) return alert('Valor inválido!');

        if (!confirm('Confirma Gravação da Moeda?')) return;

        setLoading(true);
        const payload = {
            product_code: parseInt(formData.product_code),
            currency_code: formData.currency_code,
            currency_name: formData.currency_name,
            valor: parseFloat(formData.valor),
            product_name: formData.product_name
        };

        const { error } = await supabase
            .from('product_currencies')
            .upsert(payload, { onConflict: 'product_code, currency_code' });

        if (!error) {
            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Moedas',
                    evento: status === 'Criar' ? 'Inclusão de Moedas' : 'Alteração de Moedas',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.product_code} - ${formData.product_name} - ${formData.currency_name} - ${formData.valor}`
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

            alert('Moeda gravada com sucesso!');
            handleLimpar();
            fetchCurrencies();
        } else {
            alert('Erro ao gravar: ' + error.message);
        }
        setLoading(false);
    };

    const handleDeletar = async () => {
        if (!confirm('Deseja excluir este registro?')) return;
        setLoading(true);
        const { error } = await supabase
            .from('product_currencies')
            .delete()
            .eq('product_code', formData.product_code)
            .eq('currency_code', formData.currency_code);

        if (!error) {
            alert('Registro excluído!');
            handleLimpar();
            fetchCurrencies();
        } else {
            alert('Erro ao excluir: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="currencies-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Moedas</h1>
                    <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleGravar} disabled={loading}>
                        <FiSave /> Gravar
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Novo
                    </button>
                    {status === 'Editar' && (
                        <button className="btn btn-danger" onClick={handleDeletar} disabled={loading}>
                            <FiTrash2 /> Deletar
                        </button>
                    )}
                </div>
            </header>

            <div className="search-bar">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Pesquisar por moeda ou produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && currencies.length > 0 && (
                        <div className="search-results">
                            {currencies.map((c, idx) => (
                                <div key={`${c.product_code}-${c.currency_code}-${idx}`} className="result-item" onClick={() => handleSelectCurrency(c)}>
                                    <span className="res-code">{c.currency_code}</span>
                                    <span className="res-name">{c.currency_name} ({c.product_name})</span>
                                    <span className="res-val">R$ {c.valor.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="form-card">
                <div className="form-grid">
                    <div className="form-section-title span-12">Associação Produto x Moeda</div>

                    <div className="form-group sm">
                        <label>Cód. Produto</label>
                        <input
                            type="number"
                            name="product_code"
                            value={formData.product_code}
                            onChange={handleInputChange}
                            onBlur={handleProductBlur}
                            disabled={status === 'Editar'}
                        />
                    </div>

                    <div className="form-group lg">
                        <label>Descrição do Produto</label>
                        <input type="text" name="product_name" value={formData.product_name} disabled />
                    </div>

                    <div className="form-group sm">
                        <label>Cód. Moeda</label>
                        <input
                            type="text"
                            name="currency_code"
                            value={formData.currency_code}
                            onChange={handleInputChange}
                            onBlur={handleCurrencyBlur}
                            disabled={status === 'Editar'}
                        />
                    </div>

                    <div className="form-group md">
                        <label>Nome da Moeda</label>
                        <input type="text" name="currency_name" value={formData.currency_name} onChange={handleInputChange} />
                    </div>

                    <div className="form-group sm">
                        <label>Valor Unitário (R$)</label>
                        <input type="number" name="valor" value={formData.valor} onChange={handleInputChange} step="0.01" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Currencies;
