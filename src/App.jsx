import React, { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import SigmaMenu from './components/SigmaMenu'
import Customers from './pages/Customers'
import Therapists from './pages/Therapists'
import JobRoles from './pages/JobRoles'
import TherapistsSchedule from './pages/TherapistsSchedule'
import Products from './pages/Products'
import Currencies from './pages/Currencies'
import Dates from './pages/Dates'
import Stores from './pages/Stores'
import Billing from './pages/Billing'
import MassageVoucher from './pages/MassageVoucher'
import TherapistDailyBalance from './pages/TherapistDailyBalance'
import ParkingCoupon from './pages/ParkingCoupon'
import AuditReport from './pages/AuditReport'
import Pontuador from './pages/Pontuador'
import ClientTransfer from './pages/ClientTransfer'
import Login from './pages/Login'
import Signup from './pages/Signup'

function App() {
    const [session, setSession] = useState(null);
    const [currentPage, setCurrentPage] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('page') || 'dashboard';
    });
    const [authPage, setAuthPage] = useState('login'); // 'login' or 'signup'

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'clientes': return <Customers session={session} />;
            case 'terapeutas': return <Therapists session={session} />;
            case 'funcoes': return <JobRoles session={session} />;
            case 'colaboradores-dia': return <TherapistsSchedule session={session} />;
            case 'produtos': return <Products session={session} />;
            case 'moedas': return <Currencies session={session} />;
            case 'datas': return <Dates session={session} />;
            case 'lojas': return <Stores session={session} />;
            case 'faturamento': return <Billing session={session} />;
            case 'vale-massagem': return <MassageVoucher session={session} />;
            case 'saldo-dia': return <TherapistDailyBalance session={session} />;
            case 'estacionamento': return <ParkingCoupon session={session} />;
            case 'auditoria': return <AuditReport />;
            case 'pontuador': return <Pontuador session={session} />;
            case 'transferencia': return <ClientTransfer session={session} />;
            default: return (
                <div style={{ padding: '2rem' }}>
                    <h1>Painel SIGMA</h1>
                    <p>Bem-vindo ao sistema de gestão modernizado. Selecione uma opção no menu lateral.</p>
                </div>
            );
        }
    }

    // If not logged in, show Auth pages
    if (!session) {
        if (authPage === 'signup') {
            return <Signup onNavigate={(page) => setAuthPage(page)} />;
        }
        return <Login onNavigate={(page) => setAuthPage(page)} onLoginSuccess={(session) => setSession(session)} />;
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <SigmaMenu session={session} onNavigate={(page) => setCurrentPage(page)} onLogout={handleLogout} />
            <main style={{ flex: 1 }}>
                {renderPage()}
            </main>
        </div>
    )
}

export default App
