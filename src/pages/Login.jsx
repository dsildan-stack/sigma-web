import React, { useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import { supabase } from '../utils/supabase';
import './Login.css';

const Login = ({ onNavigate, onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (onLoginSuccess) onLoginSuccess(data.session);
        } catch (err) {
            setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-brand-group">
                        <FiGrid className="login-brand-icon" />
                        <h1 className="login-brand">SIGMA</h1>
                    </div>
                    <h2>Bem-vindo de volta</h2>
                    <p>Acesse sua conta para continuar</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">E-mail</label>
                        <div className="input-wrapper">
                            <input
                                id="email"
                                type="email"
                                placeholder="exemplo@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Senha</label>
                        <div className="input-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="login-footer">
                    Não tem uma conta?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('signup'); }}>
                        Cadastre-se
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Login;
