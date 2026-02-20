import React, { useState, useEffect, useRef } from 'react';
import './ParkingCoupon.css';
import { supabase } from '../utils/supabase';
import { FiPrinter, FiSearch, FiX, FiInfo, FiPlus } from 'react-icons/fi';

const ParkingCoupon = ({ session }) => {
    const [loading, setLoading] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const dropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        produto_codigo: '0',
        descricao: '',
        valor: '0.00',
        moeda: ''
    });

    const [printData, setPrintData] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCodeChange = async (value) => {
        setFormData(p => ({ ...p, produto_codigo: value }));

        if (value.length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        let query = supabase
            .from('product_currencies')
            .select('product_code, currency_name, valor, product_name');

        if (!isNaN(value) && value.trim() !== '') {
            query = query.or(`product_code.eq.${value},product_name.ilike.%${value}%`);
        } else {
            query = query.or(`product_name.ilike.%${value}%,currency_name.ilike.%${value}%`);
        }

        const { data, error } = await query.limit(5);

        if (error) console.error('Error in suggestions:', error);

        if (data && data.length > 0) {
            setSuggestions(data);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (item) => {
        setFormData({
            produto_codigo: item.product_code.toString(),
            descricao: item.product_name,
            valor: item.valor.toFixed(2),
            moeda: item.currency_name
        });
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleLookup = async (code) => {
        if (!code || code === '0') return;

        setLoading(true);
        const { data, error } = await supabase
            .from('product_currencies')
            .select('product_code, product_name, currency_name, valor')
            .eq('product_code', parseInt(code))
            .limit(1)
            .single();

        if (data) {
            setFormData({
                produto_codigo: data.product_code.toString(),
                descricao: data.product_name,
                valor: data.valor.toFixed(2),
                moeda: data.currency_name
            });
        } else {
            alert('Produto/Moeda não cadastrado, inválido !');
            setFormData({
                produto_codigo: '0',
                descricao: '',
                valor: '0.00',
                moeda: ''
            });
        }
        setLoading(false);
    };

    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (term.length < 1) {
            setSearchResults([]);
            return;
        }

        let query = supabase
            .from('product_currencies')
            .select('product_code, product_name, currency_code, currency_name, valor');

        if (!isNaN(term) && term.trim() !== '') {
            query = query.or(`product_code.eq.${term},product_name.ilike.%${term}%`);
        } else {
            query = query.or(`product_name.ilike.%${term}%,product_name.ilike.%${term}%,currency_name.ilike.%${term}%`);
        }

        const { data, error } = await query
            .order('product_name')
            .limit(50);

        if (error) console.error('Error in search:', error);
        setSearchResults(data || []);
    };

    const handleSelectProduct = (item) => {
        setFormData({
            produto_codigo: item.product_code.toString(),
            descricao: item.product_name,
            valor: item.valor.toFixed(2),
            moeda: item.currency_name
        });
        setShowSearch(false);
        setSearchTerm('');
    };

    const generateTextCoupon = (data) => {
        return `--------------------------------\r\n` +
            `ZEN ZEN MASSAGENS\r\n` +
            `CNPJ: 01.628.507/0001-68\r\n` +
            `Av. Ricardo Jafet 1501 - Loja 27\r\n` +
            `Chácara Kablin - São Paulo\r\n` +
            `--------------------------------\r\n` +
            `CONTROLE DE SERVICOS\r\n` +
            `--------------------------------\r\n` +
            `Data:${data.data}    Hora:${data.hora}\r\n` +
            `Produto:${data.produto} Total:${data.valor},00\r\n` +
            `--------------------------------\r\n` +
            `Obrigado volte sempre!\r\n`;
    };

    const downloadTxtCoupon = (text) => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cupom_${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImprimir = () => {
        // Delphi-style validations
        if (!formData.produto_codigo || formData.produto_codigo === '0' || formData.produto_codigo.trim() === '') {
            alert('Produto em branco inválido !');
            return;
        }

        if (parseFloat(formData.valor) <= 0 || !formData.valor || formData.valor.trim() === '') {
            alert('Valor em branco ou zerado inválido !');
            return;
        }

        const now = new Date();
        const dataStr = now.toLocaleDateString('pt-BR');
        const horaStr = now.toLocaleTimeString('pt-BR');

        const dataToPrint = {
            data: dataStr,
            hora: horaStr,
            produto: formData.descricao,
            valor: formData.valor
        };

        const choice = window.confirm(
            "Deseja Imprimir o Cupom (OK) ou Gerar Arquivo Texto (Cancelar)?"
        );

        if (choice) {
            // Browser Print
            setPrintData(dataToPrint);
            setTimeout(() => {
                window.print();
                handleLimpar();
                setPrintData(null);
            }, 100);
        } else {
            // TXT File as Delphi's ImprimirEmArquivo
            const textContent = generateTextCoupon(dataToPrint);
            downloadTxtCoupon(textContent);
            handleLimpar();
        }
    };

    const handleLimpar = () => {
        setFormData({
            produto_codigo: '0',
            descricao: '',
            valor: '0.00',
            moeda: ''
        });
    };

    return (
        <div className="parking-coupon-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Emissão de Cupom de Estacionamento</h1>
                    <p className="subtitle">Módulo operacional para controle de serviços</p>
                </div>
            </header>

            <div className="coupon-form-card">
                <div className="form-header">
                    <p className="subtitle"><FiInfo /> Preencha o código do produto ou use a pesquisa</p>
                </div>

                <div className="coupon-grid">
                    <div className="form-group span-4 autocomplete-container" ref={dropdownRef}>
                        <label>Código do Produto</label>
                        <input
                            type="text"
                            value={formData.produto_codigo}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            onBlur={(e) => {
                                // Small delay to allow click on suggestion
                                setTimeout(() => {
                                    if (!showSuggestions) handleLookup(e.target.value);
                                }, 200);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookup(e.target.value)}
                            autoFocus
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="autocomplete-dropdown">
                                {suggestions.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="suggestion-item"
                                        onClick={() => handleSelectSuggestion(item)}
                                    >
                                        <div className="item-main">
                                            <span className="code">{item.product_code}</span>
                                            <span className="currency">{item.currency_name}</span>
                                        </div>
                                        <div className="item-meta">
                                            <span className="name">{item.product_name}</span>
                                            <span className="price">R$ {item.valor.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group span-8">
                        <label>Descrição do Produto</label>
                        <input
                            type="text"
                            value={formData.descricao}
                            readOnly
                            className="readonly-field"
                            placeholder="Descrição abreviada"
                        />
                    </div>

                    <div className="form-group span-4">
                        <label>Valor (R$)</label>
                        <input
                            type="text"
                            value={formData.valor}
                            readOnly
                            className="readonly-field"
                        />
                    </div>

                    <div className="form-group span-4">
                        <label>Moeda</label>
                        <input
                            type="text"
                            value={formData.moeda}
                            readOnly
                            className="readonly-field"
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button className="btn btn-primary" onClick={handleImprimir} disabled={loading}>
                        <FiPrinter /> Imprimir
                    </button>
                    <button className="btn btn-search" onClick={() => setShowSearch(true)}>
                        <FiSearch /> Pesquisar
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Novo
                    </button>
                </div>
            </div>

            {/* Product Search Modal */}
            {showSearch && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Pesquisar Produto</h2>
                            <button className="close-btn" onClick={() => setShowSearch(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Digite o nome ou código..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="search-results-list" style={{ marginTop: '1rem' }}>
                            {searchResults.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="search-item"
                                    onClick={() => handleSelectProduct(item)}
                                >
                                    <div className="item-info">
                                        <div className="item-row">
                                            <span className="item-code">{item.product_code}</span>
                                            <span className="item-currency-code">{item.currency_code}</span>
                                        </div>
                                        <span className="item-name">{item.product_name} ({item.currency_name})</span>
                                    </div>
                                    <span className="item-price">R$ {item.valor.toFixed(2)}</span>
                                </div>
                            ))}
                            {searchTerm && searchResults.length === 0 && (
                                <p className="text-center">Nenhum produto encontrado.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal Coupon for Printing (Hidden on screen) */}
            {printData && (
                <div id="thermal-coupon">
                    <div className="coupon-header">
                        ZEN ZEN MASSAGENS<br />
                        CNPJ: 01.628.507/0001-68<br />
                        Av. Ricardo Jafet 1501 - Loja 27<br />
                        Chácara Kablin - São Paulo
                    </div>
                    <div className="coupon-divider"></div>
                    <div className="coupon-header">CONTROLE DE SERVICOS</div>
                    <div className="coupon-divider"></div>
                    <div className="coupon-info-row">
                        <span>Data: {printData.data}</span>
                        <span>Hora: {printData.hora}</span>
                    </div>
                    <div className="coupon-info-row">
                        <span>Produto:</span>
                        <span>{printData.produto}</span>
                    </div>
                    <div className="coupon-info-row text-bold">
                        <span>Total:</span>
                        <span>R$ {printData.valor}</span>
                    </div>
                    <div className="coupon-divider"></div>
                    <div className="coupon-footer">
                        Obrigado volte sempre!
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParkingCoupon;
