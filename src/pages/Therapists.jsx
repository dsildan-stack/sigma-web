import React, { useState, useEffect } from 'react';
import './Therapists.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight, FiMapPin,
    FiUser, FiMail, FiPhone, FiBriefcase, FiTag
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Therapists = ({ session }) => {
    const [status, setStatus] = useState('Criar');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [therapists, setTherapists] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [formData, setFormData] = useState({
        codigo: '00000',
        nome: '',
        nome_abrev: '',
        endereco: '',
        bairro: '',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '',
        funcao: '',
        cod_funcao: '00',
        telefone: '',
        celular: '',
        email: '',
        aniversario: '',
        banco_caixa: 'Não',
        tipo_a: false,
        tipo_b: false,
        tipo_c: false,
        tipo_d: false
    });

    useEffect(() => {
        if (status === 'Criar' && formData.codigo === '00000') {
            handleLimpar();
        }
        fetchTherapists();
        fetchAllRoles();
    }, [searchTerm]);

    const fetchAllRoles = async () => {
        const { data } = await supabase.from('job_roles').select('*').order('codigo', { ascending: true });
        if (data) setAllRoles(data);
    };

    const fetchTherapists = async () => {
        let query = supabase.from('therapists').select('*');
        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`codigo.eq.${searchTerm},telefone.ilike.%${searchTerm}%,celular.ilike.%${searchTerm}%`);
            } else {
                query = query.or(`nome.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%,celular.ilike.%${searchTerm}%`);
            }
        }
        const { data } = await query.limit(100);
        if (data) setTherapists(data);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleExclusiveCheckbox = (type) => {
        setFormData(prev => ({
            ...prev,
            tipo_a: type === 'a',
            tipo_b: type === 'b',
            tipo_c: type === 'c',
            tipo_d: type === 'd'
        }));
    };

    const handleLimpar = async () => {
        const { data } = await supabase.from('therapists').select('codigo').order('codigo', { ascending: false }).limit(1);
        const nextCodigo = data && data[0] ? (data[0].codigo + 1).toString() : '1';

        setFormData({
            codigo: nextCodigo,
            nome: '', nome_abrev: '', endereco: '', bairro: '',
            cidade: 'São Paulo', estado: 'SP', cep: '',
            funcao: '', cod_funcao: '00',
            telefone: '', celular: '', email: '', aniversario: '',
            banco_caixa: 'Não',
            tipo_a: false, tipo_b: false, tipo_c: false, tipo_d: false
        });
        setStatus('Criar');
        setSearchTerm('');
        setShowRolePicker(false);
    };

    const handleRoleSelect = (role) => {
        setFormData(prev => ({
            ...prev,
            cod_funcao: role.codigo.toString(),
            funcao: role.descricao
        }));
        setShowRolePicker(false);
    };

    const handleSelectTherapist = (t) => {
        setFormData({
            ...t,
            codigo: t.codigo.toString(),
            aniversario: t.aniversario || ''
        });
        setStatus('Editar');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        // Delphi-style validations
        if (!formData.nome) return alert('Campo Nome em branco , invalido !');
        if (!formData.nome_abrev) return alert('Campo Nome Abreviado em branco , invalido !');
        if (!formData.codigo || formData.codigo === '00000') return alert('Campo Codigo em branco , invalido !');
        if (!formData.endereco) return alert('Endereço em branco , inválido !');
        if (!formData.bairro) return alert('Bairro em branco , inválido !');
        if (!formData.cidade) return alert('Cidade em branco , inválido !');
        if (!formData.estado) return alert('Estado em branco , inválido !');
        if (!formData.funcao) return alert('Função em branco , inválido !');

        if (!window.confirm('Confirma Gravação do Terapeuta !')) return;

        setLoading(true);
        const { id, created_at, ...payload } = {
            ...formData,
            codigo: parseInt(formData.codigo),
            aniversario: formData.aniversario || null
        };

        const { error } = status === 'Criar'
            ? await supabase.from('therapists').insert([payload])
            : await supabase.from('therapists').update(payload).eq('id', id);

        setLoading(false);
        if (error) {
            alert('Erro ao gravar: ' + error.message);
        } else {
            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Terapeutas/Assistentes',
                    evento: status === 'Criar' ? 'Inclusão de Terapeutas/Assistentes' : 'Alteração de Terapeutas/Assistentes',
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

            alert(`Terapeuta ${status === 'Criar' ? 'gravado' : 'atualizado'} com sucesso!`);
            handleLimpar();
            fetchTherapists();
        }
    };

    const handleDeletar = async () => {
        if (!formData.codigo || formData.codigo === '00000') return alert('Campo Codigo em branco , invalido !');
        if (!window.confirm('Confirma deleção do registro !')) return;

        setLoading(true);
        const { error } = await supabase.from('therapists').delete().eq('id', formData.id);
        setLoading(false);
        if (error) {
            alert('Erro ao deletar: ' + error.message);
        } else {
            handleLimpar();
            fetchTherapists();
        }
    };

    return (
        <div className="therapists-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Terapeutas/Assistentes</h1>
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
                        placeholder="Pesquisar por nome, telefone ou celular..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="navigation-controls">
                    <button className="nav-btn"><FiChevronLeft /></button>
                    <button className={`nav-btn ${loading ? 'spinning' : ''}`}><FiChevronRight /></button>
                </div>
            </div>

            {searchTerm && therapists.length > 0 && (
                <div className="search-results">
                    {therapists.map(t => (
                        <div key={t.id} className="result-item" onClick={() => handleSelectTherapist(t)}>
                            <span className="res-code">{t.codigo}</span>
                            <span className="res-name">{t.nome}</span>
                            <span className="res-phone">{t.celular || t.telefone}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="form-card">
                <div className="form-grid">
                    <div className="form-group sm">
                        <label>Código</label>
                        <input type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} disabled={status === 'Editar'} />
                    </div>
                    <div className="form-group xl-7">
                        <label>Nome Completo</label>
                        <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} autoFocus />
                    </div>
                    <div className="form-group md">
                        <label>Nome Abreviado</label>
                        <input type="text" name="nome_abrev" value={formData.nome_abrev} onChange={handleInputChange} />
                    </div>

                    <div className="form-group xl-7">
                        <label>Endereço</label>
                        <input type="text" name="endereco" value={formData.endereco} onChange={handleInputChange} />
                    </div>
                    <div className="form-group md">
                        <label>Bairro</label>
                        <input type="text" name="bairro" value={formData.bairro} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>CEP</label>
                        <input type="text" name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00000-000" />
                    </div>

                    <div className="form-group lg">
                        <label>Cidade</label>
                        <input type="text" name="cidade" value={formData.cidade} onChange={handleInputChange} />
                    </div>
                    <div className="form-group sm">
                        <label>Estado</label>
                        <input type="text" name="estado" value={formData.estado} onChange={handleInputChange} maxLength="2" />
                    </div>
                    <div className="form-group md">
                        <label>Aniversário</label>
                        <input type="date" name="aniversario" value={formData.aniversario} onChange={handleInputChange} />
                    </div>

                    <div className="form-group sm role-input-container">
                        <label>Cód. Função</label>
                        <input
                            type="text"
                            name="cod_funcao"
                            value={formData.cod_funcao}
                            onChange={handleInputChange}
                            onClick={() => setShowRolePicker(true)}
                            onFocus={() => setShowRolePicker(true)}
                            autoComplete="off"
                        />
                        {showRolePicker && allRoles.length > 0 && (
                            <div className="role-picker-dropdown">
                                <div className="role-picker-header">
                                    <span>Selecione a Função</span>
                                    <FiX onClick={() => setShowRolePicker(false)} />
                                </div>
                                <div className="role-list">
                                    {allRoles.map(role => (
                                        <div
                                            key={role.id}
                                            className="role-item"
                                            onClick={() => handleRoleSelect(role)}
                                        >
                                            <span className="role-code">{role.codigo}</span>
                                            <span className="role-name">{role.descricao}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="form-group xl-4">
                        <label>Função (Descrição)</label>
                        <input
                            type="text"
                            name="funcao"
                            value={formData.funcao}
                            onChange={handleInputChange}
                            disabled
                            placeholder="Selecione no código..."
                        />
                    </div>

                    <div className="form-group md">
                        <label>Telefone</label>
                        <input type="text" name="telefone" value={formData.telefone} onChange={handleInputChange} />
                    </div>
                    <div className="form-group md">
                        <label>Celular</label>
                        <input type="text" name="celular" value={formData.celular} onChange={handleInputChange} />
                    </div>
                    <div className="form-group md">
                        <label>Banco/Caixa</label>
                        <select name="banco_caixa" value={formData.banco_caixa} onChange={handleInputChange} className="form-select">
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                        </select>
                    </div>
                    <div className="form-group lg">
                        <label>E-mail</label>
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} />
                    </div>

                    <div className="form-group xl checkboxes-row">
                        <label className="row-label">Tipo de Profissional (Exclusivo):</label>
                        <div className="checkboxes-group">
                            <label className="checkbox-item">
                                <input type="checkbox" checked={formData.tipo_a} onChange={() => handleExclusiveCheckbox('a')} />
                                <span>Tipo A</span>
                            </label>
                            <label className="checkbox-item">
                                <input type="checkbox" checked={formData.tipo_b} onChange={() => handleExclusiveCheckbox('b')} />
                                <span>Tipo B</span>
                            </label>
                            <label className="checkbox-item">
                                <input type="checkbox" checked={formData.tipo_c} onChange={() => handleExclusiveCheckbox('c')} />
                                <span>Tipo C</span>
                            </label>
                            <label className="checkbox-item">
                                <input type="checkbox" checked={formData.tipo_d} onChange={() => handleExclusiveCheckbox('d')} />
                                <span>Tipo D</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Therapists;
