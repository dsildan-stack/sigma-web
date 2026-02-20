import React, { useState, useEffect } from 'react';
import './AuditReport.css';
import { FiFilter, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const AuditReport = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        usuario: '',
        data: ''
    });

    useEffect(() => {
        fetchLogs();
    }, [filters.usuario, filters.data]);

    const fetchLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('auditoria')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters.usuario) {
            query = query.ilike('usuario', `%${filters.usuario}%`);
        }

        if (filters.data) {
            query = query.eq('data', filters.data);
        }

        const { data, error } = await query.limit(100);

        if (error) {
            console.error('Error fetching logs:', error);
            alert('Erro ao buscar auditoria: ' + error.message);
        } else {
            console.log('Logs fetched:', data);
            setLogs(data || []);
        }
        setLoading(false);
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const getEventBadgeClass = (evento) => {
        const lower = evento.toLowerCase();
        if (lower.includes('inclusão')) return 'inclusao';
        if (lower.includes('alteração')) return 'alteracao';
        if (lower.includes('exclusão')) return 'exclusao';
        return '';
    };

    return (
        <div className="audit-report-container">
            <header className="audit-header">
                <div className="header-title">
                    <h1>Relatório de Auditoria</h1>
                </div>
                <div className="audit-filters">
                    <div className="filter-group">
                        <label>Filtrar por Usuário</label>
                        <input
                            type="text"
                            name="usuario"
                            placeholder="Nome do usuário..."
                            value={filters.usuario}
                            onChange={handleFilterChange}
                        />
                    </div>
                    <div className="filter-group">
                        <label>Filtrar por Data</label>
                        <input
                            type="date"
                            name="data"
                            value={filters.data}
                            onChange={handleFilterChange}
                        />
                    </div>
                    <button className="btn btn-secondary" onClick={fetchLogs} title="Atualizar">
                        <FiRefreshCw className={loading ? 'spinning' : ''} />
                    </button>
                </div>
            </header>

            <div className="audit-table-card">
                <div className="table-responsive">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Usuário</th>
                                <th>Processo</th>
                                <th>Evento</th>
                                <th>Data</th>
                                <th>Hora</th>
                                <th>Referência</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7">
                                        <div className="loading-state">Carregando auditoria...</div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="7">
                                        <div className="empty-state">Nenhum registro encontrado.</div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id}>
                                        <td>{log.id}</td>
                                        <td><strong>{log.usuario}</strong></td>
                                        <td>{log.processo}</td>
                                        <td>
                                            <span className={`event-badge ${getEventBadgeClass(log.evento)}`}>
                                                {log.evento}
                                            </span>
                                        </td>
                                        <td>{log.data.split('-').reverse().join('/')}</td>
                                        <td>{log.hora}</td>
                                        <td>{log.referencia}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {logs.length > 0 && (
                    <div className="audit-footer">
                        Exibindo os últimos {logs.length} registros
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditReport;
