import React, { useState, useEffect } from 'react';
import './TherapistsSchedule.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight,
    FiClock, FiBriefcase, FiHash,
    FiRefreshCw
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const TherapistsSchedule = ({ session }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [therapists, setTherapists] = useState([]);
    const [showTherapistPicker, setShowTherapistPicker] = useState(false);

    const [formData, setFormData] = useState({
        dia_semana: (new Date().getDay() + 1).toString(), // 1-7
        dt_inicio: new Date().toISOString().split('T')[0],
        dt_termino: new Date().toISOString().split('T')[0],
        therapist_code: '00000',
        therapist_name: '',
        cargo: 'T',
        tipo: 'F',
        status: 'A',
        hora_inicio: '09:00',
        hora_termino: '18:00',
        comissao_percentual: '0',
        loja_codigo: '02',
        observacao: ''
    });

    const weekdayNames = [
        "", "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
    ];

    useEffect(() => {
        fetchTherapists();
    }, [searchTerm]);

    const fetchTherapists = async () => {
        let query = supabase.from('therapists').select('codigo, nome, nome_abrev');
        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`codigo.eq.${searchTerm}`);
            } else {
                query = query.ilike('nome', `%${searchTerm}%`);
            }
        }
        const { data } = await query.limit(10).order('nome');
        if (data) setTherapists(data);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectTherapist = (t) => {
        setFormData(prev => ({
            ...prev,
            therapist_code: t.codigo.toString(),
            therapist_name: t.nome_abrev || t.nome
        }));
        setShowTherapistPicker(false);
        setSearchTerm('');
    };

    const handleLimpar = () => {
        setFormData({
            dia_semana: (new Date().getDay() + 1).toString(),
            dt_inicio: new Date().toISOString().split('T')[0],
            dt_termino: new Date().toISOString().split('T')[0],
            therapist_code: '00000',
            therapist_name: '',
            cargo: 'T', tipo: 'F', status: 'A',
            hora_inicio: '09:00', hora_termino: '18:00',
            comissao_percentual: '0', loja_codigo: '01',
            observacao: ''
        });
    };

    const handleGravar = async () => {
        // Validations
        if (formData.therapist_code === '00000') return alert('Selecione um terapeuta!');
        if (!formData.hora_inicio || !formData.hora_termino) return alert('Horários são obrigatórios!');
        if (parseFloat(formData.comissao_percentual) > 60) return alert('Comissão não pode exceder 60%!');

        const start = new Date(formData.dt_inicio + 'T12:00:00');
        const end = new Date(formData.dt_termino + 'T12:00:00');
        const targetDOW = parseInt(formData.dia_semana);

        if (confirm(`Gerar horários para ${formData.therapist_name} em todos os ${weekdayNames[targetDOW]}s entre ${formData.dt_inicio} e ${formData.dt_termino}?`)) {
            setGenerating(true);
            const payload = [];
            let current = new Date(start);

            // Process up to 365 days loop
            for (let i = 0; i < 366; i++) {
                if (current > end) break;

                // getDay() is 0 (Sun) to 6 (Sat). Delphi 1 (Sun) to 7 (Sat)
                if ((current.getDay() + 1) === targetDOW) {
                    payload.push({
                        data: current.toISOString().split('T')[0],
                        therapist_code: parseInt(formData.therapist_code),
                        status: formData.status,
                        hora_inicio: formData.hora_inicio,
                        hora_termino: formData.hora_termino,
                        tipo: formData.tipo,
                        dia_semana: targetDOW === 1 ? 8 : targetDOW, // Delphi logic mapping
                        cargo: formData.cargo,
                        comissao_percentual: parseFloat(formData.comissao_percentual),
                        loja_codigo: parseInt(formData.loja_codigo),
                        ano: current.getFullYear(),
                        observacao: formData.observacao
                    });
                }
                current.setDate(current.getDate() + 1);
            }

            if (payload.length === 0) {
                alert('Nenhuma data encontrada no intervalo para este dia da semana!');
                setGenerating(false);
                return;
            }

            // Determine Audit Event (Inclusão vs Alteração)
            // We'll check if any record existed for this therapist in this range/weekday before upserting (approximate)
            // Ideally we'd check before upsert, but for audit purposes, let's assume if there are records it might be an update.
            // A better approach for "Inclusão vs Alteração" in bulk is tricky. 
            // Let's check count before upsert.

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            // Check existence
            const { count } = await supabase
                .from('therapists_schedule')
                .select('*', { count: 'exact', head: true })
                .eq('therapist_code', parseInt(formData.therapist_code))
                .gte('data', startStr)
                .lte('data', endStr)
                .eq('dia_semana', targetDOW === 1 ? 8 : targetDOW);

            const eventType = (count && count > 0) ? 'Alteração de Colaboradores/Dia' : 'Inclusão de Colaboradores/Dia';

            const { error } = await supabase.from('therapists_schedule').upsert(payload, { onConflict: 'data, therapist_code' });

            setGenerating(false);
            if (error) {
                alert('Erro ao gravar: ' + error.message);
            } else {
                // Audit Log
                if (session?.user) {
                    const now = new Date();
                    const auditData = {
                        usuario: session.user.email,
                        processo: 'Cadastro de Colaboradores/Dia',
                        evento: eventType,
                        data: now.toISOString().split('T')[0],
                        hora: now.toTimeString().split(' ')[0],
                        referencia: `${formData.therapist_code} - ${formData.therapist_name} - ${formData.dt_inicio} - ${formData.dt_termino}`
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

                alert(`${payload.length} registros processados com sucesso!`);
                handleLimpar();
            }
        }
    };

    const handleLimpezaTotal = async () => {
        if (!confirm('Deseja REALMENTE excluir TODOS os horários de colaboradores? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        const { error } = await supabase.from('therapists_schedule').delete().neq('data', '1900-01-01'); // Delete all
        setLoading(false);
        if (error) alert('Erro ao limpar: ' + error.message);
        else alert('Banco de horários limpo!');
    };

    return (
        <div className="schedule-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Schedules: Colaboradores/Dia</h1>
                    <p className="subtitle">Configuração de disponibilidade e escalas recorrentes</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleGravar} disabled={generating}>
                        <FiSave /> {generating ? 'Processando...' : 'Gravar Escala'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiRefreshCw /> Limpar
                    </button>
                    <button className="btn btn-danger-outline" onClick={handleLimpezaTotal}>
                        <FiTrash2 /> Limpeza Total
                    </button>
                </div>
            </header>

            <div className="form-card">
                <div className="form-grid">
                    {/* Linha 1: Seleção de Dia e Intervalo */}
                    <div className="form-section-title span-12">Recorrência e Período</div>

                    <div className="form-group md">
                        <label>Dia da Semana (1-7)</label>
                        <select name="dia_semana" value={formData.dia_semana} onChange={handleInputChange}>
                            <option value="1">1 - Domingo</option>
                            <option value="2">2 - Segunda</option>
                            <option value="3">3 - Terça</option>
                            <option value="4">4 - Quarta</option>
                            <option value="5">5 - Quinta</option>
                            <option value="6">6 - Sexta</option>
                            <option value="7">7 - Sábado</option>
                        </select>
                    </div>
                    <div className="form-group md">
                        <label>Data Início</label>
                        <input type="date" name="dt_inicio" value={formData.dt_inicio} onChange={handleInputChange} />
                    </div>
                    <div className="form-group md">
                        <label>Data Término</label>
                        <input type="date" name="dt_termino" value={formData.dt_termino} onChange={handleInputChange} />
                    </div>

                    {/* Linha 2: Colaborador */}
                    <div className="form-section-title span-12">Colaborador</div>

                    <div className="form-group sm therapist-input-container">
                        <label>Cód. Terapeuta</label>
                        <input
                            type="text"
                            name="therapist_code"
                            value={formData.therapist_code}
                            onClick={() => setShowTherapistPicker(true)}
                            onFocus={() => setShowTherapistPicker(true)}
                            readOnly
                        />
                        {showTherapistPicker && (
                            <div className="therapist-picker-dropdown">
                                <div className="picker-search">
                                    <FiSearch />
                                    <input
                                        type="text"
                                        placeholder="Filtrar por nome..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                    <FiX onClick={() => setShowTherapistPicker(false)} />
                                </div>
                                <div className="picker-list">
                                    {therapists.map(t => (
                                        <div key={t.codigo} className="picker-item" onClick={() => handleSelectTherapist(t)}>
                                            <span className="p-code">{t.codigo}</span>
                                            <span className="p-name">{t.nome_abrev || t.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="form-group xl-7">
                        <label>Nome do Colaborador</label>
                        <input type="text" value={formData.therapist_name} disabled placeholder="Selecione um código..." />
                    </div>
                    <div className="form-group sm">
                        <label>Loja</label>
                        <input type="text" name="loja_codigo" value={formData.loja_codigo} onChange={handleInputChange} />
                    </div>

                    {/* Linha 3: Detalhes da Escala */}
                    <div className="form-section-title span-12">Configuração da Escala</div>

                    <div className="form-group sm">
                        <label>Cargo (T/F)</label>
                        <select name="cargo" value={formData.cargo} onChange={handleInputChange}>
                            <option value="T">T - Terapeuta</option>
                            <option value="F">F - Funcionário</option>
                        </select>
                    </div>
                    <div className="form-group sm">
                        <label>Tipo</label>
                        <select name="tipo" value={formData.tipo} onChange={handleInputChange}>
                            <option value="F">F - Fixo</option>
                            <option value="S">S - Substituto</option>
                            <option value="E">E - Extra</option>
                        </select>
                    </div>
                    <div className="form-group sm">
                        <label>Status</label>
                        <select name="status" value={formData.status} onChange={handleInputChange}>
                            <option value="A">A - Ativo</option>
                            <option value="I">I - Inativo</option>
                        </select>
                    </div>
                    <div className="form-group md">
                        <label>Horas (Início - Fim)</label>
                        <div className="time-group">
                            <input type="time" name="hora_inicio" value={formData.hora_inicio} onChange={handleInputChange} />
                            <span>às</span>
                            <input type="time" name="hora_termino" value={formData.hora_termino} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="form-group sm">
                        <label>% Comissao</label>
                        <input type="number" name="comissao_percentual" value={formData.comissao_percentual} onChange={handleInputChange} />
                    </div>

                    <div className="form-group xl">
                        <label>Observações</label>
                        <input type="text" name="observacao" value={formData.observacao} onChange={handleInputChange} placeholder="Ex: Cobre folga de..." />
                    </div>
                </div>
            </div>

            <div className="generation-info">
                <FiRefreshCw className={generating ? 'spinning' : ''} />
                <p>O sistema irá varrer o calendário entre as datas informadas, localizando todos os <strong>{weekdayNames[parseInt(formData.dia_semana)]}s</strong> e criando os registros individuais de escala no banco de dados.</p>
            </div>
        </div>
    );
};

export default TherapistsSchedule;
