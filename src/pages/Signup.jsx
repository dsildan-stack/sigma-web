import React, { useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import { supabase } from '../utils/supabase';
import './Signup.css';

const Signup = ({ onNavigate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.name,
                        phone: formData.phone,
                    }
                }
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => onNavigate('login'), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <div className="signup-header">
                    <div className="signup-brand-group">
                        <FiGrid className="signup-brand-icon" />
                        <h1 className="signup-brand">SIGMA</h1>
                    </div>
                    <h2>Crie sua conta</h2>
                    <p>Preencha os dados abaixo para se cadastrar</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">Conta criada com sucesso! Redirecionando...</div>}

                <form className="signup-form" onSubmit={handleSignup}>
                    <div className="form-group">
                        <label htmlFor="name">Nome Completo</label>
                        <div className="input-wrapper">
                            <input
                                id="name"
                                type="text"
                                placeholder="Seu nome"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">E-mail</label>
                        <div className="input-wrapper">
                            <input
                                id="email"
                                type="email"
                                placeholder="exemplo@email.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Celular</label>
                        <div className="input-wrapper">
                            <input
                                id="phone"
                                type="tel"
                                placeholder="(00) 00000-0000"
                                value={formData.phone}
                                onChange={handleChange}
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
                                placeholder="Mínimo 6 caracteres"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength="6"
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

                    <button type="submit" className="signup-button" disabled={loading || success}>
                        {loading ? 'Cadastrando...' : 'Cadastrar'}
                    </button>
                </form>

                <div className="signup-footer">
                    Já tem uma conta?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }}>
                        Faça login
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Signup;
