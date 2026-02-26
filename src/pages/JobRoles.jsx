import React, { useState, useEffect } from 'react';
import './JobRoles.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const JobRoles = ({ session }) => {
    const [status, setStatus] = useState('Criar');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState([]);
    const [formData, setFormData] = useState({
        codigo: '',
        descricao: ''
    });

    useEffect(() => {
        if (status === 'Criar' && !formData.codigo) {
            handleLimpar();
        }
        fetchRoles();
    }, [searchTerm]);

    const fetchRoles = async () => {
        let query = supabase.from('job_roles').select('*');
        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`codigo.eq.${searchTerm},descricao.ilike.%${searchTerm}%`);
            } else {
                query = query.ilike('descricao', `%${searchTerm}%`);
            }
        }
        const { data } = await query.order('codigo', { ascending: true }).limit(50);
        if (data) setRoles(data);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLimpar = async () => {
        const { data } = await supabase.from('job_roles').select('codigo').order('codigo', { ascending: false }).limit(1);
        const nextCodigo = data && data[0] ? (data[0].codigo + 1).toString() : '1';

        setFormData({
            codigo: nextCodigo,
            descricao: ''
        });
        setStatus('Criar');
        setSearchTerm('');
    };

    const handleSelectRole = (role) => {
        setFormData({
            ...role,
            codigo: role.codigo.toString()
        });
        setStatus('Editar');
        setSearchTerm('');
    };

    const handleGravar = async () => {
        if (!formData.descricao) return alert('Campo Descrição é obrigatório!');
        if (!formData.codigo) return alert('Campo Código é obrigatório!');

        if (!window.confirm('Confirma Gravação da Função?')) return;

        setLoading(true);
        const { id, created_at, ...payload } = {
            ...formData,
            codigo: parseInt(formData.codigo)
        };

        const { error } = status === 'Criar'
            ? await supabase.from('job_roles').insert([payload])
            : await supabase.from('job_roles').update(payload).eq('id', id);

        setLoading(false);
        if (error) {
            alert('Erro ao gravar: ' + error.message);
        } else {
            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Funçoes',
                    evento: status === 'Criar' ? 'Inclusão de Funçoes' : 'Alteração de Funçoes',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.codigo} - ${formData.descricao}`
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

            alert(`Função ${status === 'Criar' ? 'gravada' : 'atualizada'} com sucesso!`);
            handleLimpar();
            fetchRoles();
        }
    };

    const handleDeletar = async () => {
        if (!formData.codigo) return;
        if (!window.confirm('Confirma a exclusão desta função?')) return;

        setLoading(true);
        const { error } = await supabase.from('job_roles').delete().eq('id', formData.id);
        setLoading(false);
        if (error) {
            alert('Erro ao deletar: ' + error.message);
        } else {
            handleLimpar();
            fetchRoles();
        }
    };

    return (
        <div className="job-roles-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Funções</h1>
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
                        placeholder="Pesquisar por descrição ou código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && roles.length > 0 && (
                        <div className="search-results">
                            {roles.map(r => (
                                <div key={r.id} className="result-item" onClick={() => handleSelectRole(r)}>
                                    <span className="res-code">{r.codigo}</span>
                                    <span className="res-name">{r.descricao}</span>
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
                <div className="form-grid">
                    <div className="form-group sm">
                        <label>Código</label>
                        <input
                            type="text"
                            name="codigo"
                            value={formData.codigo}
                            onChange={handleInputChange}
                            disabled={status === 'Editar'}
                        />
                    </div>
                    <div className="form-group xl-10">
                        <label>Descrição da Função</label>
                        <input
                            type="text"
                            name="descricao"
                            value={formData.descricao}
                            onChange={handleInputChange}
                            autoFocus
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobRoles;
