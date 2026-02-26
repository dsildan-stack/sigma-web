import React, { useState, useEffect, useRef } from 'react';
import './MassageVoucher.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiUser, FiPackage, FiDollarSign, FiCalendar,
    FiFileText, FiDownload, FiCheckCircle
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const MassageVoucher = ({ session }) => {
    // --- State Management ---
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('Criar'); // Criar | Editar
    const [searchMode, setSearchMode] = useState(null); // product | client_buy | client_use | therapist
    const [results, setResults] = useState([]);
    const [currencies, setCurrencies] = useState([]);

    // --- Form Data ---
    const [formData, setFormData] = useState({
        num_ctr: '',
        produto_codigo: '',
        produto_nome: '',
        currency_code: '',
        valor: '0.00',
        data_vencimento: '',
        status_baixado: 'Não',
        cliente_compra: '',
        cliente_massagem: '',
        pix_therapist_code: '',
        pix_therapist_name: '',
        tipo_venda: 'Venda Massagem'
    });

    // --- Refs ---
    const clientBuyRef = useRef(null);
    const therapistRef = useRef(null);

    // --- Initialization ---
    useEffect(() => {
        initializeForm();
    }, []);

    // --- Monitor Product Change ---
    useEffect(() => {
        if (formData.produto_codigo) {
            loadCurrencies(formData.produto_codigo);
        } else {
            setCurrencies([]);
            setFormData(prev => ({ ...prev, currency_code: '', valor: '0.00' }));
        }
    }, [formData.produto_codigo]);

    const initializeForm = async () => {
        // Generate next control number
        const { data, error } = await supabase
            .from('massage_vouchers')
            .select('num_ctr')
            .order('created_at', { ascending: false })
            .limit(1);

        let nextNum = '1';
        if (data && data.length > 0) {
            const lastNum = parseInt(data[0].num_ctr) || 0;
            nextNum = (lastNum + 1).toString();
        }

        // Set expiration date to +2 months
        const today = new Date();
        const expirationDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
        const expirationStr = expirationDate.toISOString().split('T')[0];

        setFormData(prev => ({
            ...prev,
            num_ctr: nextNum,
            data_vencimento: expirationStr,
            status_baixado: 'Não'
        }));
    };

    // --- Load Currencies ---
    const loadCurrencies = async (productCode) => {
        if (!productCode) return;
        try {
            const { data, error } = await supabase
                .from('product_currencies')
                .select('currency_code, currency_name, valor')
                .eq('product_code', productCode)
                .order('currency_name');

            if (error) throw error;
            setCurrencies(data || []);
        } catch (err) {
            console.error('Erro ao carregar moedas:', err);
        }
    };

    // --- Search Handlers ---
    const handleSearch = async (type, term) => {
        if (type !== 'therapist' && (!term || term.length < 2)) {
            setResults([]);
            return;
        }

        setSearchMode(type);
        let data = [];

        if (type === 'product') {
            const { data: d } = await supabase
                .from('products')
                .select('codigo, nome, preco')
                .or(`codigo.eq.${term},nome.ilike.%${term}%`)
                .limit(50);
            data = d || [];
        } else if (type === 'client_buy' || type === 'client_use') {
            const { data: d } = await supabase
                .from('customers')
                .select('codigo, nome')
                .ilike('nome', `%${term}%`)
                .limit(20);
            data = d || [];
        } else if (type === 'therapist') {
            let query = supabase
                .from('therapists')
                .select('codigo, nome')
                .limit(10);

            if (term) {
                query = query.ilike('nome', `%${term}%`);
            }

            const { data: d } = await query;
            data = d || [];
        }

        setResults(data);
    };

    const handleSelectResult = (item) => {
        if (searchMode === 'product') {
            setFormData(prev => ({
                ...prev,
                produto_codigo: item.codigo.toString(),
                produto_nome: item.nome
            }));
        } else if (searchMode === 'client_buy') {
            setFormData(prev => ({
                ...prev,
                cliente_compra: item.nome
            }));
        } else if (searchMode === 'client_use') {
            setFormData(prev => ({
                ...prev,
                cliente_massagem: item.nome
            }));
        } else if (searchMode === 'therapist') {
            setFormData(prev => ({
                ...prev,
                pix_therapist_code: item.codigo.toString(),
                pix_therapist_name: item.nome
            }));
        }

        setSearchMode(null);
        setResults([]);

    };

    // --- Calculation Helper (from TherapistDailyBalance) ---
    const calculateSaldoTotal = async (therapistCode, newSaldoDia) => {
        const { data } = await supabase
            .from('therapist_closings')
            .select('saldo_dia')
            .eq('terapeuta_codigo', therapistCode);

        const historicalSum = data ? data.reduce((acc, curr) => acc + (curr.saldo_dia || 0), 0) : 0;
        return historicalSum + newSaldoDia;
    };

    // --- Validation ---
    const validateForm = () => {
        // Check expiration date
        if (formData.data_vencimento < new Date().toISOString().split('T')[0]) {
            alert('A data selecionada é menor que a data atual do sistema!');
            return false;
        }

        // Check value
        if (parseFloat(formData.valor) === 0) {
            alert('Valor zerado, inválido!');
            return false;
        }

        // Check required fields
        if (!formData.produto_codigo || !formData.currency_code) {
            alert('Preencha o produto e a moeda!');
            return false;
        }

        if (formData.currency_code === 'PX' && !formData.pix_therapist_code) {
            alert('Para moeda Pix (PX), é obrigatório selecionar o Terapeuta!');
            return false;
        }

        return true;
    };

    // --- Save Handler ---
    const handleGravar = async () => {
        if (!validateForm()) return;

        if (!confirm('Confirma Gravação do Vale Massagem!')) return;

        setLoading(true);
        try {
            const record = {
                num_ctr: formData.num_ctr,
                produto_codigo: parseInt(formData.produto_codigo),
                produto_nome: formData.produto_nome,
                tipo_moeda: formData.currency_code,
                valor: parseFloat(formData.valor),
                data_vencimento: formData.data_vencimento,
                status_baixado: formData.status_baixado,
                cliente_compra: formData.cliente_compra,
                cliente_massagem: formData.cliente_massagem,
                data_venda: new Date().toISOString().split('T')[0]
            };

            const { error } = await supabase
                .from('massage_vouchers')
                .insert([record]);

            if (error) throw error;

            // --- Therapist Closing (if PX) ---
            if (formData.currency_code === 'PX') {
                const tPix = parseFloat(formData.valor);
                // Logic from Delphi: Comissao=0, Pix=Valor, Caixinha=0, SaldoDia = (0 - Pix)
                // Note: The prompt code says "SaldoDia := (tComissao - tPix)" where tComissao=0. So SaldoDia is negative.
                const saldoDia = -tPix;
                const saldoTotal = await calculateSaldoTotal(parseInt(formData.pix_therapist_code), saldoDia);
                const now = new Date();

                const closingRecord = {
                    terapeuta_codigo: parseInt(formData.pix_therapist_code),
                    terapeuta_nome: formData.pix_therapist_name,
                    comissao: 0,
                    pix: tPix,
                    caixinha: 0,
                    ajustes: 0,
                    saldo_dia: saldoDia,
                    saldo_total: saldoTotal,
                    data: now.toISOString().split('T')[0],
                    hora: now.toLocaleTimeString('pt-BR'),
                    observacao: 'Venda-Vale Massagem'
                };
                const { error: closingError } = await supabase.from('therapist_closings').insert([closingRecord]);
                if (closingError) throw closingError;
            }

            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Vale Massagem',
                    evento: 'Inclusão de Vale Massagem',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.num_ctr} - ${formData.cliente_compra} - ${formData.cliente_massagem} - ${formData.produto_codigo} - ${formData.produto_nome}`
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

            alert('Vale Massagem gravado com sucesso!');

            // Generate JPEG image (New functionality)
            try {
                await gerarImagemVoucher(
                    formData.cliente_compra,
                    formData.num_ctr,
                    formData.valor,
                    formData.tipo_venda
                );
            } catch (err) {
                console.error('Erro ao gerar imagem:', err);
                alert('Erro ao gerar imagem do voucher, mas os dados foram salvos.');
            }

            // Generate receipt
            generateReceipt();

            // Reset form
            handleLimpar();
            initializeForm();
        } catch (err) {
            alert('Erro ao gravar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Generate Voucher Image (Delphi Implementation) ---
    const gerarImagemVoucher = async (nomeCliente, numCtr, valorMas, tipoVenda) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            // Set source based on sale type
            let src = '/assets/vouchers/Massagem.jpg';
            if (tipoVenda === 'Promoção') {
                src = '/assets/vouchers/Promocao_Massagem.jpg';
            }

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // 1. Draw background
                ctx.drawImage(img, 0, 0);

                // 2. Configuration
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'left';

                // 3. Write Info (Offsets adapted for 800px width)
                ctx.fillText(`Nº : ${numCtr}`, 400, 120);
                ctx.fillText(`Para : ${nomeCliente}`, 400, 170);
                ctx.fillText(`Massagem de : ${valorMas}`, 400, 230);

                // 4. Save and Download
                const link = document.createElement('a');
                link.download = `Vale_${numCtr}_${nomeCliente.replace(/\s+/g, '_')}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.click();
                resolve();
            };

            img.onerror = () => {
                // Fallback: draw a basic voucher if image fails to load
                canvas.width = 800;
                canvas.height = 400;
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, 800, 400);
                ctx.strokeStyle = '#dee2e6';
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, 790, 390);

                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#333';
                ctx.fillText(`Nº : ${numCtr}`, 400, 120);
                ctx.fillText(`Para : ${nomeCliente}`, 400, 170);
                ctx.fillText(`Massagem de : ${valorMas}`, 400, 230);

                const link = document.createElement('a');
                link.download = `Vale_${numCtr}_${nomeCliente.replace(/\s+/g, '_')}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.click();
                resolve();
            };

            img.src = src;
        });
    };

    // --- Generate Receipt ---
    const generateReceipt = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');

        const receipt = `--------------------------------
ZEN ZEN MASSAGENS
CNPJ: 01.628.507/0001-68
Av. Ricardo Jafet 1501 - Loja 27
Chácara Klabin - São Paulo
--------------------------------
VALE MASSAGEM - Numero: ${formData.num_ctr}
--------------------------------
Data: ${dateStr}    Hora: ${timeStr}
Produto: ${formData.produto_nome}
Total: R$ ${formData.valor}
Data Vencimento: ${new Date(formData.data_vencimento).toLocaleDateString('pt-BR')}
--------------------------------
Obrigado volte sempre!
--------------------------------`;

        // Download as text file
        const blob = new Blob([receipt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ValeMassagem_${formData.num_ctr}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // --- Generate Report ---
    const handleRelatorio = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('massage_vouchers')
                .select('*')
                .order('num_ctr', { ascending: true });

            if (error) throw error;

            let report = `Relatório de Vale Massagem\n`;
            report += `----------------------------------------------------------------------------------------------------------------------------------------------------------------\n`;
            report += `NumCtr | Nome                 | Moeda    | Valor      | Data_Venc  | Baixado    | Status     | Cliente Venda                  | Cliente Massagem               |\n`;
            report += `-------+----------------------+----------+------------+------------+------------+------------+--------------------------------+--------------------------------\n`;

            data.forEach(voucher => {
                const vencDate = new Date(voucher.data_vencimento);
                const today = new Date();
                let statusVenc = '';
                if (vencDate < today) {
                    statusVenc = 'Vencido';
                }

                const line = `${String(voucher.num_ctr).padEnd(6)} | ${String(voucher.produto_nome || '').substring(0, 20).padEnd(20)} | ${String(voucher.tipo_moeda || '').padEnd(8)} | ${String(voucher.valor || '').padEnd(10)} | ${String(voucher.data_vencimento || '').padEnd(10)} | ${String(voucher.status_baixado || '').padEnd(10)} | ${statusVenc.padEnd(10)} | ${String(voucher.cliente_compra || '').substring(0, 30).padEnd(30)} | ${String(voucher.cliente_massagem || '').substring(0, 30).padEnd(30)} |\n`;
                report += line;
            });

            // Download report
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Relatorio_Vale_Massagens.txt';
            a.click();
            URL.revokeObjectURL(url);

            alert('Relatório gerado com sucesso!');
        } catch (err) {
            alert('Erro ao gerar relatório: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Clear Form ---
    const handleLimpar = () => {
        setFormData(prev => ({
            ...prev,
            produto_codigo: '',
            produto_nome: '',
            currency_code: '',
            valor: '0.00',
            cliente_compra: '',
            valor: '0.00',
            cliente_compra: '',
            cliente_massagem: '',
            pix_therapist_code: '',
            pix_therapist_name: ''
        }));
        setStatus('Criar');
    };

    return (
        <div className="massage-voucher-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Cadastro de Vale Massagem</h1>
                    <p className="subtitle">Gestão de vales-massagem e controle de vencimento</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={handleGravar}
                        disabled={loading}
                    >
                        <FiSave /> {loading ? 'Gravando...' : 'Gravar'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Limpar
                    </button>
                    <button className="btn btn-info" onClick={handleRelatorio}>
                        <FiFileText /> Relatório
                    </button>
                </div>
            </header>

            <div className="main-grid">
                {/* Control Number */}
                <div className="form-card">
                    <div className="form-section-title">Número de Controle</div>
                    <div className="form-row">
                        <div className="form-group span-4">
                            <label>Número</label>
                            <input
                                type="text"
                                value={formData.num_ctr}
                                readOnly
                                className="readonly-field"
                                style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#6366f1' }}
                            />
                        </div>
                        <div className="form-group span-4">
                            <label>Status</label>
                            <input
                                type="text"
                                value={formData.status_baixado}
                                readOnly
                                className="readonly-field"
                            />
                        </div>
                        <div className="form-group span-4">
                            <label>Data Vencimento</label>
                            <input
                                type="date"
                                value={formData.data_vencimento}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_vencimento: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group span-6">
                            <label>Tipo de Venda</label>
                            <div className="radio-group" style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="tipo_venda"
                                        value="Venda Massagem"
                                        checked={formData.tipo_venda === 'Venda Massagem'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tipo_venda: e.target.value }))}
                                    />
                                    Venda Normal
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="tipo_venda"
                                        value="Promoção"
                                        checked={formData.tipo_venda === 'Promoção'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tipo_venda: e.target.value }))}
                                    />
                                    Promoção
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Clients */}
                <div className="form-card">
                    <div className="form-section-title">Clientes</div>
                    <div className="form-row">
                        <div className="form-group span-6 lookup-container">
                            <label>Cliente Compra</label>
                            <input
                                ref={clientBuyRef}
                                type="text"
                                value={formData.cliente_compra}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, cliente_compra: e.target.value }));
                                    handleSearch('client_buy', e.target.value);
                                }}
                                placeholder="Digite o nome..."
                            />
                            {searchMode === 'client_buy' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group span-6 lookup-container">
                            <label>Cliente Massagem</label>
                            <input
                                type="text"
                                value={formData.cliente_massagem}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, cliente_massagem: e.target.value }));
                                    handleSearch('client_use', e.target.value);
                                }}
                                placeholder="Digite o nome..."
                            />
                            {searchMode === 'client_use' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Product and Payment */}
                <div className="form-card">
                    <div className="form-section-title">Produto e Pagamento</div>
                    <div className="form-row">
                        <div className="form-group span-3 lookup-container">
                            <label>Cód. Produto</label>
                            <input
                                type="number"
                                value={formData.produto_codigo}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, produto_codigo: e.target.value }));
                                    handleSearch('product', e.target.value);
                                }}
                            />
                            {searchMode === 'product' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome}</span>
                                            <span className="extra">R$ {r.preco.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group span-9">
                            <label>Nome do Produto</label>
                            <input
                                type="text"
                                value={formData.produto_nome}
                                readOnly
                                className="readonly-field"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group span-6">
                            <label>Tipo Moeda</label>
                            <select
                                value={formData.currency_code}
                                onChange={(e) => {
                                    const selectedCurrency = currencies.find(c => c.currency_code === e.target.value);
                                    setFormData(prev => ({
                                        ...prev,
                                        currency_code: e.target.value,
                                        valor: selectedCurrency ? selectedCurrency.valor.toFixed(2) : prev.valor
                                    }));

                                    if (e.target.value === 'PX') {
                                        if (window.confirm('Para qual colaborador vai o Pix?')) {
                                            handleSearch('therapist', '');
                                            setTimeout(() => {
                                                if (therapistRef.current) {
                                                    therapistRef.current.focus();
                                                }
                                            }, 100);
                                        }
                                    } else {
                                        setFormData(prev => ({ ...prev, pix_therapist_code: '', pix_therapist_name: '' }));
                                    }
                                }}
                            >
                                <option value="">Selecione uma moeda...</option>
                                {currencies.map((currency) => (
                                    <option key={currency.currency_code} value={currency.currency_code}>
                                        {currency.currency_code} - {currency.currency_name} (R$ {currency.valor.toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group span-6">
                            <label>Valor</label>
                            <input
                                type="number"
                                value={formData.valor}
                                readOnly
                                className="readonly-field"
                                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                                step="0.01"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Therapist Pix Section */}
            {formData.currency_code === 'PX' && (
                <div className="form-card animate-fade-in">
                    <div className="form-section-title">Terapeuta do Pix</div>
                    <div className="form-row">
                        <div className="form-group span-4 lookup-container">
                            <label>Cód. Terapeuta</label>
                            <input
                                ref={therapistRef}
                                type="text"
                                value={formData.pix_therapist_code}
                                readOnly
                                className="readonly-field"
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, pix_therapist_code: e.target.value }));
                                    handleSearch('therapist', e.target.value);
                                }}
                                placeholder="Nome..."
                            />
                            {searchMode === 'therapist' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo.toString()}</span>
                                            <span className="name">{r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group span-8">
                            <label>Nome Terapeuta</label>
                            <input
                                type="text"
                                value={formData.pix_therapist_name}
                                readOnly
                                className="readonly-field"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MassageVoucher;
