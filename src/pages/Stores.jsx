import React, { useState, useEffect } from 'react';
import './Stores.css';
import {
    FiSave, FiTrash2, FiPlus
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Stores = ({ session }) => {
    const [status, setStatus] = useState('Criar');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [stores, setStores] = useState([]);

    const [formData, setFormData] = useState({
        codigo: '',
        nome: '',
        endereco: '',
        bairro: '',
        cidade: '',
        estado: 'SP'
    });

    useEffect(() => {
        fetchStores();
    }, [searchTerm]);

    const fetchStores = async () => {
        let query = supabase.from('stores').select('*');
        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`codigo.eq.${searchTerm},nome.ilike.%${searchTerm}%`);
            } else {
                query = query.ilike('nome', `%${searchTerm}%`);
            }
        }
        const { data } = await query.limit(20).order('nome');
        if (data) setStores(data);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLimpar = async () => {
        const { data } = await supabase
            .from('stores')
            .select('codigo')
            .order('codigo', { ascending: false })
            .limit(1);

        const nextIdx = data && data[0] ? (parseInt(data[0].codigo) + 1).toString() : '1';

        setFormData({
            codigo: nextIdx,
            nome: '',
            endereco: '',
            bairro: '',
            cidade: '',
            estado: 'SP'
        });
        setStatus('Criar');
        setSearchTerm('');
    };

    const handleSelectStore = (store) => {
        setFormData({
            ...store,
            codigo: store.codigo.toString()
        });
        setStatus('Editar');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        if (!formData.nome) return alert('Local em branco inválido!');
        if (!formData.codigo) return alert('Código em branco inválido!');

        if (!confirm('Confirma Gravação da Loja?')) return;

        setLoading(true);
        const payload = {
            codigo: parseInt(formData.codigo),
            nome: formData.nome,
            endereco: formData.endereco,
            bairro: formData.bairro,
            cidade: formData.cidade,
            estado: formData.estado
        };

        const { error } = status === 'Criar'
            ? await supabase.from('stores').insert([payload])
            : await supabase.from('stores').update(payload).eq('codigo', parseInt(formData.codigo));

        if (!error) {
            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Lojas',
                    evento: status === 'Criar' ? 'Inclusão de Lojas' : 'Alteração de Lojas',
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

            alert(`Loja ${status === 'Criar' ? 'gravada' : 'atualizada'} com sucesso!`);
            handleLimpar();
            fetchStores();
        } else {
            alert('Erro ao gravar: ' + error.message);
        }
        setLoading(false);
    };

    const handleDeletar = async () => {
        if (!confirm('Deseja excluir esta loja? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        const { error } = await supabase.from('stores').delete().eq('codigo', parseInt(formData.codigo));
        if (!error) {
            alert('Loja excluída!');
            handleLimpar();
            fetchStores();
        } else {
            alert('Erro ao excluir: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="stores-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Lojas / Unidades</h1>
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
                    {searchTerm && stores.length > 0 && (
                        <div className="search-results">
                            {stores.map(store => (
                                <div key={store.codigo} className="result-item" onClick={() => handleSelectStore(store)}>
                                    <span className="res-code">{store.codigo}</span>
                                    <span className="res-name">{store.nome}</span>
                                    <span className="res-city">{store.cidade} - {store.estado}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="form-card">
                <div className="form-grid">
                    <div className="form-section-title span-12">Informações da Unidade</div>

                    <div className="form-group sm">
                        <label>Código</label>
                        <input
                            type="number"
                            name="codigo"
                            value={formData.codigo}
                            onChange={handleInputChange}
                            disabled={status === 'Editar'}
                        />
                    </div>
                    <div className="form-group xl">
                        <label>Local / Nome da Loja</label>
                        <input
                            type="text"
                            name="nome"
                            value={formData.nome}
                            onChange={handleInputChange}
                            placeholder="Ex: Unidade Centro"
                            autoFocus
                        />
                    </div>

                    <div className="form-group lg">
                        <label>Endereço</label>
                        <input
                            type="text"
                            name="endereco"
                            value={formData.endereco}
                            onChange={handleInputChange}
                            placeholder="Rua, Número, Complemento"
                        />
                    </div>
                    <div className="form-group lg">
                        <label>Bairro</label>
                        <input
                            type="text"
                            name="bairro"
                            value={formData.bairro}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div className="form-group lg">
                        <label>Cidade</label>
                        <input
                            type="text"
                            name="cidade"
                            value={formData.cidade}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group md">
                        <label>Estado</label>
                        <select name="estado" value={formData.estado} onChange={handleInputChange}>
                            <option value="AC">Acre</option>
                            <option value="AL">Alagoas</option>
                            <option value="AP">Amapá</option>
                            <option value="AM">Amazonas</option>
                            <option value="BA">Bahia</option>
                            <option value="CE">Ceará</option>
                            <option value="DF">Distrito Federal</option>
                            <option value="ES">Espírito Santo</option>
                            <option value="GO">Goiás</option>
                            <option value="MA">Maranhão</option>
                            <option value="MT">Mato Grosso</option>
                            <option value="MS">Mato Grosso do Sul</option>
                            <option value="MG">Minas Gerais</option>
                            <option value="PA">Pará</option>
                            <option value="PB">Paraíba</option>
                            <option value="PR">Paraná</option>
                            <option value="PE">Pernambuco</option>
                            <option value="PI">Piauí</option>
                            <option value="RJ">Rio de Janeiro</option>
                            <option value="RN">Rio Grande do Norte</option>
                            <option value="RS">Rio Grande do Sul</option>
                            <option value="RO">Rondônia</option>
                            <option value="RR">Roraima</option>
                            <option value="SC">Santa Catarina</option>
                            <option value="SP">São Paulo</option>
                            <option value="SE">Sergipe</option>
                            <option value="TO">Tocantins</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Stores;
