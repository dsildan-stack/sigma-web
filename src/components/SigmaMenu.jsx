import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import './SigmaMenu.css';
import {
    FiUsers, FiCalendar, FiDollarSign, FiPieChart,
    FiLogOut, FiGrid, FiChevronRight, FiTrash2
} from 'react-icons/fi';

const SigmaMenu = ({ session, onNavigate, onLogout }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        if (session?.user?.id) {
            const fetchProfile = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', session.user.id)
                    .single();

                if (data?.full_name) {
                    setUserName(data.full_name);
                }
            };
            fetchProfile();
        }
    }, [session]);
    const [activeSubmenu, setActiveSubmenu] = useState(null);

    const handleItemClick = (e, target) => {
        e.preventDefault();
        const page = target.split('/').pop();
        if (onNavigate) onNavigate(page);
    };

    const menuStructure = [
        {
            title: 'Cadastros',
            icon: <FiUsers />,
            items: [
                { label: 'Clientes', target: '/clientes' },
                { label: 'Terapeutas/Assistentes', target: '/terapeutas' },
                { label: 'Colaboradores/Dia', target: '/colaboradores-dia' },
                { label: 'Produtos', target: '/produtos' },
                { label: 'Datas', target: '/datas' },
                { label: 'Funções', target: '/funcoes' },
                { label: 'Estados', target: '/estados' },
                { label: 'Lojas', target: '/lojas' },
                { label: 'Moedas', target: '/moedas' }
            ]
        },
        {
            title: 'Operacional',
            icon: <FiCalendar />,
            items: [
                { label: 'Pontuador', target: '/pontuador' },
                { label: 'Transfere Cliente', target: '/transferencia' },
                { label: 'Altera Data Fat.', target: '/altera-data' },
                { label: 'Saldo Colaborador Dias', target: '/saldo-dia' },
                { label: 'Cupom Estacionamento', target: '/estacionamento' }
            ]
        },
        {
            title: 'Financeiro',
            icon: <FiDollarSign />,
            items: [
                { label: 'Faturamento', target: '/faturamento' },
                { label: 'Vale Massagem', target: '/vale-massagem' },
                { label: 'Fechamento Diário', target: '/fechamento' }
            ]
        },
        {
            title: 'Relatórios',
            icon: <FiPieChart />,
            items: [
                { label: 'Aniversariantes', target: '/relatorios/aniversariantes' },
                { label: 'Apuração de Prêmios', target: '/relatorios/premios' },
                { label: 'Clientes Inativos', target: '/relatorios/inativos' },
                { label: 'Histórico Alt/Exc', target: '/relatorios/historico' },
                { label: 'Clientes', target: '/relatorios/clientes-relatorio' },
                { label: 'Produtos', target: '/relatorios/produtos-relatorio' },
                { label: 'Tipos de Pagamento', target: '/relatorios/pagamentos' },
                { label: 'Sumário Faturamento', target: '/relatorios/sumario-faturamento' },
                { label: 'Auditoria', target: '/relatorios/auditoria' }
            ]
        },
        {
            title: 'Rotinas Diárias',
            icon: <FiGrid />,
            items: [
                { label: 'Comissão Dia', target: '/rotinas/comissao-dia' },
                { label: 'Comissão Terapeuta', target: '/rotinas/comissao-terapeuta' }
            ]
        },
        {
            title: 'Rotinas de Limpeza',
            icon: <FiTrash2 />,
            items: [
                { label: 'Limpeza de Prêmios', target: '/limpeza/premios' },
                { label: 'Limpeza de Movimento', target: '/limpeza/movimento' },
                { label: 'Exclui Clientes Inativos', target: '/limpeza/clientes-inativos' }
            ]
        }
    ];

    const toggleSubmenu = (index) => {
        setActiveSubmenu(activeSubmenu === index ? null : index);
        if (isCollapsed) setIsCollapsed(false);
    };

    return (
        <nav className={`sigma-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="logo-container">
                    <FiGrid className="logo-icon" />
                    {!isCollapsed && <span className="logo-text">SIGMA {userName && `(${userName.split(' ')[0]})`}</span>}
                </div>
                <button
                    className="collapse-toggle"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <FiChevronRight className={`toggle-icon ${isCollapsed ? '' : 'rotated'}`} />
                </button>
            </div>

            <div className="menu-sections">
                {menuStructure.map((section, idx) => (
                    <div key={idx} className="menu-group">
                        <button
                            className={`menu-trigger ${activeSubmenu === idx ? 'active' : ''}`}
                            onClick={() => toggleSubmenu(idx)}
                            title={isCollapsed ? section.title : ''}
                        >
                            <span className="icon">{section.icon}</span>
                            {!isCollapsed && <span className="label">{section.title}</span>}
                            {!isCollapsed && (
                                <FiChevronRight className={`arrow ${activeSubmenu === idx ? 'rotated' : ''}`} />
                            )}
                        </button>

                        {!isCollapsed && activeSubmenu === idx && (
                            <div className="submenu">
                                {section.items.map((item, idy) => (
                                    <a
                                        key={idy}
                                        href={item.target}
                                        className="submenu-item"
                                        onClick={(e) => handleItemClick(e, item.target)}
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="sidebar-footer">
                <button
                    className="logout-btn"
                    title="Sair do Sistema"
                    onClick={onLogout}
                >
                    <FiLogOut />
                    {!isCollapsed && <span>Sair</span>}
                </button>
            </div>
        </nav>
    );
};

export default SigmaMenu;
