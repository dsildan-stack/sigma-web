import React, { useState, useEffect } from 'react';
import './Dates.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiChevronLeft, FiChevronRight, FiCalendar,
    FiClock, FiRefreshCw, FiAlertCircle, FiCheckCircle
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Dates = ({ session }) => {
    const [loja, setLoja] = useState('02');
    const [ano, setAno] = useState(new Date().getFullYear().toString());
    const [local, setLocal] = useState('');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dates, setDates] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [updateMode, setUpdateMode] = useState('Especifica'); // Geral | Especifica

    const [batchSettings, setBatchSettings] = useState({
        dataIni: '',
        dataFin: '',
        tipoDia: 'Normal'
    });

    const [defaultHours, setDefaultHours] = useState({
        1: { ini: '09:00', fin: '18:00', name: 'Domingo' },
        2: { ini: '09:00', fin: '18:00', name: 'Segunda' },
        3: { ini: '09:00', fin: '18:00', name: 'Terça' },
        4: { ini: '09:00', fin: '18:00', name: 'Quarta' },
        5: { ini: '09:00', fin: '18:00', name: 'Quinta' },
        6: { ini: '09:00', fin: '18:00', name: 'Sexta' },
        7: { ini: '09:00', fin: '18:00', name: 'Sábado' }
    });

    const [currentRecord, setCurrentRecord] = useState({
        data: '',
        dia_semana: 0,
        nome_dia: '',
        tipo_dia: 'Normal',
        hora_inicio: '00:00',
        hora_fim: '00:00'
    });

    useEffect(() => {
        if (loja) fetchLojaName();
    }, [loja]);

    const fetchLojaName = async () => {
        const { data } = await supabase.from('stores').select('nome').eq('codigo', parseInt(loja)).single();
        if (data) setLocal(data.nome);
        else setLocal('Loja não encontrada');
    };

    const fetchDates = async () => {
        if (!loja || !ano) return alert('Loja e Ano são obrigatórios!');

        setLoading(true);
        const startDate = `${ano}-01-01`;
        const endDate = `${ano}-12-31`;

        const { data, error } = await supabase
            .from('dates_calendar')
            .select('*')
            .eq('loja_codigo', parseInt(loja))
            .gte('data', startDate)
            .lte('data', endDate)
            .order('data');

        if (error) {
            alert('Erro ao buscar datas: ' + error.message);
        } else if (data.length === 0) {
            if (confirm('Loja/Ano não encontrados. Deseja criar o calendário para este ano?')) {
                handleGenerateYear();
            }
        } else {
            setDates(data);
            setCurrentIndex(0);
            updateCurrentRecord(data[0]);
        }
        setLoading(false);
    };

    const updateCurrentRecord = (record) => {
        setCurrentRecord({
            ...record,
            data: record.data,
            hora_inicio: record.hora_inicio || '00:00',
            hora_fim: record.hora_fim || '00:00'
        });
    };

    const handleGenerateYear = async () => {
        setGenerating(true);
        setProgress(0);

        const year = parseInt(ano);
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        const daysInYear = isLeap ? 366 : 365;

        const payload = [];
        let d = new Date(year, 0, 1);

        for (let i = 0; i < daysInYear; i++) {
            // JS getDay() 0=Sun, 6=Sat. Delphi/SIGMA 1=Sun, 7=Sat
            const dow = d.getDay() + 1;
            const hours = defaultHours[dow];

            payload.push({
                loja_codigo: parseInt(loja),
                ano: year,
                data: d.toISOString().split('T')[0],
                dia_semana: dow,
                nome_dia: hours.name,
                tipo_dia: 'Normal',
                hora_inicio: hours.ini,
                hora_fim: hours.fin
            });

            d.setDate(d.getDate() + 1);
        }

        // Chunk insert for better performance/reliability
        const chunkSize = 50;
        for (let i = 0; i < payload.length; i += chunkSize) {
            const chunk = payload.slice(i, i + chunkSize);
            const { error } = await supabase.from('dates_calendar').insert(chunk);
            if (error) {
                alert('Erro na geração: ' + error.message);
                setGenerating(false);
                return;
            }
            setProgress(Math.round(((i + chunk.length) / payload.length) * 100));
        }

        // Audit Log
        if (session?.user) {
            const now = new Date();
            const auditData = {
                usuario: session.user.email,
                processo: 'Cadastro de Datas',
                evento: 'Inclusão de Datas',
                data: now.toISOString().split('T')[0],
                hora: now.toTimeString().split(' ')[0],
                referencia: `${loja} - ${local} - ${ano}`
            };

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', session.user.id)
                .single();

            if (profile?.full_name) auditData.usuario = profile.full_name;
            await supabase.from('auditoria').insert([auditData]);
        }

        alert('Calendário gerado com sucesso!');
        setGenerating(false);
        fetchDates();
    };

    const handleUpdate = async () => {
        setLoading(true);
        if (updateMode === 'Especifica') {
            const { error } = await supabase
                .from('dates_calendar')
                .update({
                    tipo_dia: currentRecord.tipo_dia,
                    hora_inicio: currentRecord.hora_inicio,
                    hora_fim: currentRecord.hora_fim
                })
                .eq('id', currentRecord.id);

            if (!error) {
                // Audit Log (Alteração)
                if (session?.user) {
                    const now = new Date();
                    const auditData = {
                        usuario: session.user.email,
                        processo: 'Cadastro de Datas',
                        evento: 'Alteração de Datas',
                        data: now.toISOString().split('T')[0],
                        hora: now.toTimeString().split(' ')[0],
                        referencia: `${loja} - ${local} - ${ano}`
                    };

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', session.user.id)
                        .single();

                    if (profile?.full_name) auditData.usuario = profile.full_name;
                    await supabase.from('auditoria').insert([auditData]);
                }

                alert('Registro atualizado!');
                fetchDates();
            } else {
                alert('Erro ao atualizar: ' + error.message);
            }
        } else {
            // Geral
            if (!batchSettings.dataIni || !batchSettings.dataFin) {
                alert('Datas inicial e final são obrigatórias para atualização geral!');
                setLoading(false);
                return;
            }

            // Logic to update hours based on the WEEKDAY settings for the range
            // This is a bit complex in Supabase, might need multiple updates or a smarter query
            // SIGMA Delphi loops through days. We'll do a batch update for the range

            const { error } = await supabase
                .from('dates_calendar')
                .update({ tipo_dia: batchSettings.tipoDia })
                .eq('loja_codigo', parseInt(loja))
                .gte('data', batchSettings.dataIni)
                .lte('data', batchSettings.dataFin);

            if (!error) {
                // Now update hours per weekday for that range
                for (let dow = 1; dow <= 7; dow++) {
                    await supabase
                        .from('dates_calendar')
                        .update({
                            hora_inicio: defaultHours[dow].ini,
                            hora_fim: defaultHours[dow].fin
                        })
                        .eq('loja_codigo', parseInt(loja))
                        .eq('dia_semana', dow)
                        .gte('data', batchSettings.dataIni)
                        .lte('data', batchSettings.dataFin);
                }

                // Audit Log (Alteração)
                if (session?.user) {
                    const now = new Date();
                    const auditData = {
                        usuario: session.user.email,
                        processo: 'Cadastro de Datas',
                        evento: 'Alteração de Datas',
                        data: now.toISOString().split('T')[0],
                        hora: now.toTimeString().split(' ')[0],
                        referencia: `${loja} - ${local} - ${ano}`
                    };

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', session.user.id)
                        .single();

                    if (profile?.full_name) auditData.usuario = profile.full_name;
                    await supabase.from('auditoria').insert([auditData]);
                }

                alert('Atualização geral concluída!');
                fetchDates();
            } else {
                alert('Erro na atualização geral: ' + error.message);
            }
        }
        setLoading(false);
    };

    const handleDeletar = async () => {
        if (!confirm(`Deseja REALMENTE excluir TODOS os registros da Loja ${loja} para o ano ${ano}?`)) return;

        setLoading(true);
        const { error } = await supabase
            .from('dates_calendar')
            .delete()
            .eq('loja_codigo', parseInt(loja))
            .eq('ano', parseInt(ano));

        if (!error) {
            alert('Registros excluídos!');
            setDates([]);
            setCurrentIndex(-1);
        } else {
            alert('Erro ao excluir: ' + error.message);
        }
        setLoading(false);
    };

    const handleNext = () => {
        if (currentIndex < dates.length - 1) {
            const newIdx = currentIndex + 1;
            setCurrentIndex(newIdx);
            updateCurrentRecord(dates[newIdx]);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            const newIdx = currentIndex - 1;
            setCurrentIndex(newIdx);
            updateCurrentRecord(dates[newIdx]);
        }
    };

    const handleDefaultHourChange = (dow, field, value) => {
        setDefaultHours(prev => ({
            ...prev,
            [dow]: { ...prev[dow], [field]: value }
        }));
    };

    return (
        <div className="dates-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Datas e Horários</h1>
                    <p className="subtitle">Gestão de calendário e funcionamento da unidade</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={handleUpdate} disabled={loading || generating || currentIndex === -1}>
                        <FiSave /> Gravar Alteração
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setDates([]); setCurrentIndex(-1); setAno(new Date().getFullYear().toString()); }}>
                        <FiPlus /> Novo/Limpar
                    </button>
                    <button className="btn btn-danger-outline" onClick={handleDeletar} disabled={loading || generating || dates.length === 0}>
                        <FiTrash2 /> Excluir Ano
                    </button>
                </div>
            </header>

            <div className="form-card">
                <div className="form-grid">
                    <div className="form-section-title span-12">Selecione a Unidade e o Ano</div>

                    <div className="form-group sm">
                        <label>Loja</label>
                        <input type="text" value={loja} onChange={(e) => setLoja(e.target.value)} />
                    </div>
                    <div className="form-group lg">
                        <label>Local / Unidade</label>
                        <input type="text" value={local} disabled />
                    </div>
                    <div className="form-group sm">
                        <label>Ano</label>
                        <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
                    </div>
                    <div className="form-group sm" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={fetchDates} disabled={loading || generating}>
                            <FiSearch /> Pesquisar
                        </button>
                    </div>

                    {generating && (
                        <div className="span-12">
                            <div className="generation-info">
                                <FiRefreshCw className="spinning" />
                                <div>
                                    <p>Gerando calendário para o ano <strong>{ano}</strong>... Isso pode levar alguns segundos.</p>
                                    <div className="progress-bar-container">
                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-section-title span-12">Horário Padrão de Funcionamento</div>

                    <div className="span-12 hours-grid">
                        {[1, 2, 3, 4, 5, 6, 7].map(dow => (
                            <div key={dow} className="day-row">
                                <span className="day-name">{defaultHours[dow].name}</span>
                                <div className="time-inputs">
                                    <input
                                        type="time"
                                        value={defaultHours[dow].ini}
                                        onChange={(e) => handleDefaultHourChange(dow, 'ini', e.target.value)}
                                    />
                                    <span>às</span>
                                    <input
                                        type="time"
                                        value={defaultHours[dow].fin}
                                        onChange={(e) => handleDefaultHourChange(dow, 'fin', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {currentIndex !== -1 && (
                        <>
                            <div className="form-section-title span-12">
                                <span>Edição de Registros</span>
                                <select value={updateMode} onChange={(e) => setUpdateMode(e.target.value)}>
                                    <option value="Especifica">Individual (Data Selecionada)</option>
                                    <option value="Geral">Geral (Intervalo de Datas)</option>
                                </select>
                            </div>

                            {updateMode === 'Geral' ? (
                                <div className="span-12 batch-update-panel">
                                    <div className="form-grid">
                                        <div className="form-group md">
                                            <label>Data Inicial</label>
                                            <input
                                                type="date"
                                                value={batchSettings.dataIni}
                                                onChange={(e) => setBatchSettings(prev => ({ ...prev, dataIni: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group md">
                                            <label>Data Final</label>
                                            <input
                                                type="date"
                                                value={batchSettings.dataFin}
                                                onChange={(e) => setBatchSettings(prev => ({ ...prev, dataFin: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group md">
                                            <label>Tipo do Dia</label>
                                            <select
                                                value={batchSettings.tipoDia}
                                                onChange={(e) => setBatchSettings(prev => ({ ...prev, tipoDia: e.target.value }))}
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="Feriado">Feriado</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="subtitle" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
                                        * Ao gravar no modo Geral, os horários configurados acima (Horário Padrão) serão aplicados a todas as datas no intervalo.
                                    </p>
                                </div>
                            ) : (
                                <div className="span-12">
                                    <div className="form-grid">
                                        <div className="form-group md">
                                            <label>Tipo de Dia</label>
                                            <select
                                                value={currentRecord.tipo_dia}
                                                onChange={(e) => setCurrentRecord(prev => ({ ...prev, tipo_dia: e.target.value }))}
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="Feriado">Feriado</option>
                                            </select>
                                        </div>
                                        <div className="form-group md">
                                            <label>Início</label>
                                            <input
                                                type="time"
                                                value={currentRecord.hora_inicio}
                                                onChange={(e) => setCurrentRecord(prev => ({ ...prev, hora_inicio: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-group md">
                                            <label>Término</label>
                                            <input
                                                type="time"
                                                value={currentRecord.hora_fim}
                                                onChange={(e) => setCurrentRecord(prev => ({ ...prev, hora_fim: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="navigation-bar">
                                        <button className="nav-btn" onClick={handlePrev} disabled={currentIndex === 0}>
                                            <FiChevronLeft /> Anterior
                                        </button>
                                        <div className="current-date-info">
                                            <h2 className="current-date-display">{new Date(currentRecord.data + 'T12:00:00').toLocaleDateString('pt-BR')}</h2>
                                            <p className="current-day-name">{currentRecord.nome_dia}</p>
                                        </div>
                                        <button className="nav-btn" onClick={handleNext} disabled={currentIndex === dates.length - 1}>
                                            Próximo <FiChevronRight />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dates;
