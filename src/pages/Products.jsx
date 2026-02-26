import React, { useState, useEffect } from 'react';
import './Products.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight,
    FiStar, FiZap, FiBarChart2,
    FiSettings, FiClock, FiCheckSquare
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Products = ({ session }) => {
    const [status, setStatus] = useState('Criar');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);

    const [formData, setFormData] = useState({
        codigo: '0000',
        nome: '',
        nome_abrev: '',
        tipo: 'P',
        preco: '0.00',
        pontos: '0.00',
        controla_estoque: 'S',
        tipo_comissao: 'F',
        valor_comissao: '0.00',
        ponto_negativo: '0.00',
        tempo_pagou: '0.00',
        tempo_duracao: '0',
        percentual_faturamento: '0.00',
        calcula_comissao: 'S',
        comissao_tipo_a: '0.00',
        comissao_tipo_b: '0.00',
        comissao_tipo_c: '0.00',
        comissao_tipo_d: '0.00',
        moedas_selecionadas: []
    });

    const currencyOptions = [
        { code: 'CC', name: 'CARTAO DE CREDITO' },
        { code: 'CD', name: 'CARTAO DEBITO' },
        { code: 'CH', name: 'CHEQUE' },
        { code: 'DD', name: 'DUPLA MOEDA' },
        { code: 'DN', name: 'DINHEIRO' },
        { code: 'PX', name: 'PIX' },
        { code: 'VM', name: 'VALE MASSAGEM' }
    ];

    useEffect(() => {
        fetchProducts();
    }, [searchTerm]);

    const fetchProducts = async () => {
        let query = supabase.from('products').select('*');
        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`codigo.eq.${searchTerm},nome.ilike.%${searchTerm}%`);
            } else {
                query = query.ilike('nome', `%${searchTerm}%`);
            }
        }
        const { data } = await query.limit(50).order('nome');
        if (data) setProducts(data);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Logical rules from Delphi
        if (name === 'tipo') {
            const isMassage = value === 'M';
            setFormData(prev => ({
                ...prev,
                tipo: value,
                controla_estoque: isMassage ? 'N' : 'S'
            }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleCurrency = (code) => {
        setFormData(prev => {
            const isSelected = prev.moedas_selecionadas.includes(code);
            const newList = isSelected
                ? prev.moedas_selecionadas.filter(c => c !== code)
                : [...prev.moedas_selecionadas, code];
            return { ...prev, moedas_selecionadas: newList };
        });
    };

    const handleLimpar = async () => {
        const { data } = await supabase.from('products').select('codigo').order('codigo', { ascending: false }).limit(1);
        const nextIdx = data && data[0] ? (data[0].codigo + 1).toString() : '1';

        setFormData({
            codigo: nextIdx,
            nome: '', nome_abrev: '', tipo: 'P',
            preco: '0.00', pontos: '0.00', controla_estoque: 'S',
            tipo_comissao: 'F', valor_comissao: '0.00', ponto_negativo: '0.00',
            tempo_pagou: '0.00', tempo_duracao: '0',
            percentual_faturamento: '0.00', calcula_comissao: 'S',
            comissao_tipo_a: '0.00', comissao_tipo_b: '0.00',
            comissao_tipo_c: '0.00', comissao_tipo_d: '0.00',
            moedas_selecionadas: []
        });
        setStatus('Criar');
        setSearchTerm('');
    };

    const handleSelectProduct = (p) => {
        setFormData({
            ...p,
            codigo: p.codigo.toString(),
            preco: p.preco.toString(),
            pontos: p.pontos.toString(),
            valor_comissao: p.valor_comissao.toString(),
            ponto_negativo: p.ponto_negativo.toString(),
            tempo_pagou: p.tempo_pagou.toString(),
            tempo_duracao: p.tempo_duracao.toString(),
            percentual_faturamento: p.percentual_faturamento.toString(),
            comissao_tipo_a: p.comissao_tipo_a.toString(),
            comissao_tipo_b: p.comissao_tipo_b.toString(),
            comissao_tipo_c: p.comissao_tipo_c.toString(),
            comissao_tipo_d: p.comissao_tipo_d.toString(),
            moedas_selecionadas: p.moedas_string ? p.moedas_string.split('-') : []
        });
        setStatus('Editar');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        // Validations
        if (!formData.nome) return alert('Nome em branco inválido !');
        if (parseFloat(formData.preco) <= 0) return alert('Preço deve ser maior que 0 !');
        if (parseFloat(formData.pontos) > 40) return alert('Pontos não podem exceder 40 !');
        if (parseFloat(formData.valor_comissao) > 100) return alert('Valor de Comissão não pode exceder R$ 100,00 !');
        if (!['S', 'N'].includes(formData.calcula_comissao)) return alert('Cálculo de Comissão Inválido !');

        if (!confirm('Confirma Gravação do Produto ?')) return;

        setLoading(true);
        const { id, created_at, moedas_selecionadas, ...rawPayload } = formData;

        const payload = {
            ...rawPayload,
            codigo: parseInt(formData.codigo),
            preco: parseFloat(formData.preco),
            pontos: parseFloat(formData.pontos),
            valor_comissao: parseFloat(formData.valor_comissao),
            ponto_negativo: parseFloat(formData.ponto_negativo),
            tempo_pagou: parseFloat(formData.tempo_pagou),
            tempo_duracao: parseInt(formData.tempo_duracao),
            percentual_faturamento: parseFloat(formData.percentual_faturamento),
            comissao_tipo_a: parseFloat(formData.comissao_tipo_a),
            comissao_tipo_b: parseFloat(formData.comissao_tipo_b),
            comissao_tipo_c: parseFloat(formData.comissao_tipo_c),
            comissao_tipo_d: parseFloat(formData.comissao_tipo_d),
            moedas_string: moedas_selecionadas.join('-')
        };

        const { error } = status === 'Criar'
            ? await supabase.from('products').insert([payload])
            : await supabase.from('products').update(payload).eq('id', formData.id);

        if (!error) {
            // SYNC Currencies list (as Delphi does)
            const syncPayload = currencyOptions.map(c => ({
                product_code: payload.codigo,
                currency_code: c.code,
                currency_name: c.name,
                valor: 0,
                product_name: payload.nome
            }));
            await supabase.from('product_currencies').upsert(syncPayload, { onConflict: 'product_code, currency_code' });

            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Produtos',
                    evento: status === 'Criar' ? 'Inclusão de Produtos' : 'Alteração de Produtos',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.codigo} - ${formData.nome}`
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

            alert(`Produto ${status === 'Criar' ? 'gravado' : 'atualizado'} com sucesso!`);
            handleLimpar();
            fetchProducts();
        } else {
            alert('Erro ao gravar: ' + error.message);
        }
        setLoading(false);
    };

    const handleDeletar = async () => {
        if (!confirm('Deseja excluir este produto?')) return;
        setLoading(true);
        const { error } = await supabase.from('products').delete().eq('id', formData.id);
        if (!error) {
            alert('Produto excluído!');
            handleLimpar();
            fetchProducts();
        } else {
            alert('Erro ao excluir: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="products-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Produtos e Massagens</h1>
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
                        placeholder="Pesquisar por nome ou código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && products.length > 0 && (
                        <div className="search-results">
                            {products.map(p => (
                                <div key={p.id} className="result-item" onClick={() => handleSelectProduct(p)}>
                                    <span className="res-code">{p.codigo}</span>
                                    <span className="res-name">{p.nome}</span>
                                    <span className="res-price">R$ {p.preco.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="form-card main-form">
                <div className="form-grid">
                    <div className="form-section-title span-12">Informações Básicas</div>

                    <div className="form-group sm">
                        <label>Código</label>
                        <input type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} disabled={status === 'Editar'} />
                    </div>
                    <div className="form-group lg">
                        <label>Nome do Produto</label>
                        <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} autoFocus />
                    </div>
                    <div className="form-group md">
                        <label>Nome Abreviado</label>
                        <input type="text" name="nome_abrev" value={formData.nome_abrev} onChange={handleInputChange} />
                    </div>

                    <div className="form-group sm">
                        <label>Tipo</label>
                        <select name="tipo" value={formData.tipo} onChange={handleInputChange}>
                            <option value="M">M - Massagem</option>
                            <option value="P">P - Produto</option>
                            <option value="V">V - Vale</option>
                        </select>
                    </div>
                    <div className="form-group md">
                        <label>Preço de Venda (R$)</label>
                        <input type="number" name="preco" value={formData.preco} onChange={handleInputChange} step="0.01" />
                    </div>
                    <div className="form-group sm">
                        <label>Pontos</label>
                        <input
                            type="number"
                            name="pontos"
                            value={formData.pontos}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group sm">
                        <label>Estoque (S/N)</label>
                        <select name="controla_estoque" value={formData.controla_estoque} onChange={handleInputChange} disabled={formData.tipo === 'M'}>
                            <option value="S">S - Sim</option>
                            <option value="N">N - Não</option>
                        </select>
                    </div>

                    <div className="form-section-title span-12">Comissões e Valores Técnicos</div>

                    <div className="form-group sm">
                        <label>Tip. Comis. (F/V)</label>
                        <select name="tipo_comissao" value={formData.tipo_comissao} onChange={handleInputChange}>
                            <option value="F">F - Fixo</option>
                            <option value="V">V - Variável</option>
                        </select>
                    </div>
                    <div className="form-group sm">
                        <label>Val. Comissao</label>
                        <input type="number" name="valor_comissao" value={formData.valor_comissao} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>Ponto Neg.</label>
                        <input type="number" name="ponto_negativo" value={formData.ponto_negativo} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>Calc. Comis.</label>
                        <select name="calcula_comissao" value={formData.calcula_comissao} onChange={handleInputChange}>
                            <option value="S">S - Sim</option>
                            <option value="N">N - Não</option>
                        </select>
                    </div>
                    <div className="form-group sm">
                        <label>Duração (min)</label>
                        <input type="number" name="tempo_duracao" value={formData.tempo_duracao} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>% Fat.</label>
                        <input type="number" name="percentual_faturamento" value={formData.percentual_faturamento} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>Tempo Pagou</label>
                        <input type="number" name="tempo_pagou" value={formData.tempo_pagou} onChange={handleInputChange} step="0.01" />
                    </div>

                    <div className="form-section-title span-12">Comissão por Tipo de Profissional</div>
                    <div className="form-row span-12 comissao-grid">
                        <div className="form-group sm">
                            <label>Tipo A</label>
                            <input type="number" name="comissao_tipo_a" value={formData.comissao_tipo_a} onChange={handleInputChange} />
                        </div>
                        <div className="form-group sm">
                            <label>Tipo B</label>
                            <input type="number" name="comissao_tipo_b" value={formData.comissao_tipo_b} onChange={handleInputChange} />
                        </div>
                        <div className="form-group sm">
                            <label>Tipo C</label>
                            <input type="number" name="comissao_tipo_c" value={formData.comissao_tipo_c} onChange={handleInputChange} />
                        </div>
                        <div className="form-group sm">
                            <label>Tipo D</label>
                            <input type="number" name="comissao_tipo_d" value={formData.comissao_tipo_d} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="form-section-title span-12">Moedas Aceitas</div>
                    <div className="span-12 moedas-selector">
                        {currencyOptions.map(currency => (
                            <label key={currency.code} className={`currency-tag ${formData.moedas_selecionadas.includes(currency.code) ? 'active' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={formData.moedas_selecionadas.includes(currency.code)}
                                    onChange={() => toggleCurrency(currency.code)}
                                />
                                <FiCheckSquare className="icon" />
                                <span>{currency.name} ({currency.code})</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Products;
