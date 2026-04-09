import React, { useState, useEffect, useRef } from 'react';
import './Billing.css';
import {
    FiSave, FiTrash2, FiSearch, FiX, FiPlus,
    FiUser, FiBriefcase, FiPackage, FiClock,
    FiDollarSign, FiTag, FiCalendar, FiAlertCircle,
    FiCheckSquare, FiLogOut
} from 'react-icons/fi';
import { supabase } from '../utils/supabase';

const Billing = ({ session }) => {
    // --- UI/Progress State ---
    const [loading, setLoading] = useState(false);
    const [saveDisabled, setSaveDisabled] = useState(false);

    // --- Refs for Focus Management ---
    const saveButtonRef = useRef(null);

    const currencyRef = useRef(null);
    const currencySecRef = useRef(null);
    const currencyExtraRef = useRef(null);
    const voucherRef = useRef(null);
    const valueSecRef = useRef(null);
    const tipRef = useRef(null);
    const [status, setStatus] = useState('Novo'); // Novo | Editando | Pago
    const [searchMode, setSearchMode] = useState(null); // client | therapist | product
    const [results, setResults] = useState([]);
    const [hasPayment, setHasPayment] = useState(false); // Track if payment will be made (Resposta from Delphi)
    const [showPixTherapistModal, setShowPixTherapistModal] = useState(false);
    const [pixTherapist, setPixTherapist] = useState(null);
    const [activeVoucherField, setActiveVoucherField] = useState(null); // 'primary' | 'sec' | 'extra'

    // --- Core Form State ---
    const [formData, setFormData] = useState({
        // Session Info
        loja_codigo: '2',
        data_movimento: new Date().toISOString().split('T')[0],
        dia_semana: (new Date().getDay() + 1).toString(),
        nome_dia_semana: '',

        // Client Info
        client_code: '',
        client_name: '',
        client_phone: '',
        client_points: 0,
        client_points_accum: 0, // Pontos do cliente acumulado
        accum_client_code: '',
        accum_client_name: '',

        // Extra Client Info (Display Only)
        client_address: '',
        client_total_points: 0,
        client_cellphone: '',
        // Extras
        client_last_mov: '',
        client_birthday: '',
        client_bday_month: '',
        client_registration_date: '',

        // Therapist Info
        therapist_code: '',
        therapist_name: '',
        start_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        preference: 'N',
        scheduled: 'N',

        // Product Info
        product_code: '',
        product_name: '',
        duration: 0,
        points_pos: 0,
        points_neg: 0,
        base_value: '0.00',

        // Payment Info
        currency_primary: '',
        value_primary: '0.00',
        currency_sec: '',
        value_sec: '0.00',
        currency_extra: '',
        value_extra: '0.00',
        tip: '0.00',
        voucher_code: '',
        service_value: '0.00'
    });

    const weekdayNames = ["", "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    // --- Initialization ---
    useEffect(() => {
        const dow = new Date().getDay() + 1;
        setFormData(prev => ({ ...prev, dia_semana: dow.toString(), nome_dia_semana: weekdayNames[dow] }));

        // Check for client_code in URL
        const params = new URLSearchParams(window.location.search);
        const clientCode = params.get('client_code');
        if (clientCode) {
            loadClientByCode(clientCode);
        }
    }, []);

    const loadClientByCode = async (code) => {
        const { data: fullClient } = await supabase.from('customers')
            .select('codigo, nome, telefone, celular, carimbos, endereco, total_pontos, acumula_pontos_codigo, ultmov, aniversario, folha, data_cadastro')
            .eq('codigo', parseInt(code))
            .single();

        if (fullClient) {
            setFormData(prev => ({
                ...prev,
                client_code: fullClient.codigo.toString(),
                client_name: fullClient.nome,
                client_phone: fullClient.telefone,
                client_cellphone: fullClient.celular,
                client_points: fullClient.carimbos,
                client_address: fullClient.endereco,
                client_total_points: fullClient.total_pontos,
                client_last_mov: fullClient.ultmov,
                client_birthday: fullClient.aniversario,
                client_bday_month: fullClient.folha,
                client_registration_date: fullClient.data_cadastro
            }));

            // Logic for accumulation
            if (fullClient.acumula_pontos_codigo && fullClient.acumula_pontos_codigo !== fullClient.codigo) {
                const { data: accum } = await supabase.from('customers')
                    .select('nome, carimbos')
                    .eq('codigo', fullClient.acumula_pontos_codigo)
                    .single();
                if (accum) {
                    setFormData(prev => ({
                        ...prev,
                        accum_client_code: fullClient.acumula_pontos_codigo.toString(),
                        accum_client_name: accum.nome,
                        client_points_accum: accum.carimbos
                    }));
                }
            }
        }
    };

    // --- Lookup Handlers ---

    const handleSelectVoucher = (voucher) => {
        const voucherVal = parseFloat(voucher.valor || 0).toFixed(2);

        setFormData(prev => {
            const updates = {
                ...prev,
                voucher_code: voucher.num_ctr
            };

            if (activeVoucherField === 'primary') {
                updates.service_value = '0.00';
                updates.value_primary = '0.00';
                updates.value_sec = voucherVal;
            } else if (activeVoucherField === 'sec') {
                updates.value_sec = voucherVal;
                // If in DD mode, recalculate Valor 2
                if (prev.currency_primary === 'DD') {
                    const valorServico = parseFloat(prev.service_value || 0);
                    const caixinha = parseFloat(prev.tip || 0);
                    const valor1 = parseFloat(voucherVal);
                    const wdifmoe = (valorServico + caixinha) - valor1;
                    updates.value_extra = wdifmoe.toFixed(2);
                }
            } else if (activeVoucherField === 'extra') {
                updates.value_extra = voucherVal;
            }

            return updates;
        });

        // Close the lookup grid
        setResults([]);
        setSearchMode(null);

        // Management of focus back to the trigger field
        setTimeout(() => {
            if (activeVoucherField === 'primary') currencyRef.current?.focus();
            else if (activeVoucherField === 'sec') currencySecRef.current?.focus();
            else if (activeVoucherField === 'extra') currencyExtraRef.current?.focus();
        }, 150);
    };

    const handleSearch = async (type, term) => {
        if (!term) {
            setResults([]);
            setSearchMode(null);
            return;
        }
        const isNumeric = !isNaN(term) && term.trim() !== '';
        if (!isNumeric && term.length < 2) {
            setResults([]);
            return;
        }

        setSearchMode(type);
        let data = [];

        if (type === 'client') {
            let q = supabase.from('customers').select('codigo, nome, telefone, celular, carimbos');
            if (!isNaN(term)) {
                q = q.or(`codigo.eq.${term},telefone.ilike.%${term}%,celular.ilike.%${term}%`);
            } else {
                q = q.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,celular.ilike.%${term}%`);
            }
            const { data: d } = await q.limit(10);
            data = d || [];
        } else if (type === 'therapist') {
            let q = supabase.from('therapists').select('codigo, nome, nome_abrev');
            if (!isNaN(term)) {
                q = q.or(`codigo.eq.${term},nome.ilike.%${term}%,nome_abrev.ilike.%${term}%`);
            } else {
                q = q.or(`nome.ilike.%${term}%,nome_abrev.ilike.%${term}%`);
            }
            const { data: d } = await q.limit(10);
            data = d || [];
        } else if (type === 'product') {
            let q = supabase.from('products').select('codigo, nome, tempo_duracao, pontos, ponto_negativo, preco');
            if (!isNaN(term)) {
                q = q.or(`codigo.eq.${term},nome.ilike.%${term}%`);
            } else {
                q = q.ilike('nome', `%${term}%`);
            }
            const { data: d } = await q.limit(100); // Increased limit to find more products
            data = d || [];
        } else if (type === 'pix_therapist') {
            let q = supabase.from('therapists').select('codigo, nome, nome_abrev');
            if (!isNaN(term)) {
                q = q.or(`codigo.eq.${term},nome.ilike.%${term}%,nome_abrev.ilike.%${term}%`);
            } else {
                q = q.or(`nome.ilike.%${term}%,nome_abrev.ilike.%${term}%`);
            }
            const { data: d } = await q.limit(10);
            data = d || [];
        } else if (type === 'voucher') {
            let q = supabase.from('massage_vouchers')
                .select('num_ctr, data_venda, produto_codigo, produto_nome, tipo_moeda, valor, status_baixado, cliente_compra, cliente_massagem')
                .eq('status_baixado', 'Não');

            if (term !== 'all' && term.length > 0) {
                if (!isNaN(term)) {
                    q = q.or(`num_ctr.ilike.%${term}%,cliente_compra.ilike.%${term}%,cliente_massagem.ilike.%${term}%`);
                } else {
                    q = q.or(`cliente_compra.ilike.%${term}%,cliente_massagem.ilike.%${term}%,produto_nome.ilike.%${term}%`);
                }
            }
            const { data: d } = await q.order('data_venda', { ascending: false }).limit(20);
            data = d || [];
        }
        setResults(data);
    };

    const handleSelectResult = async (item) => {
        if (searchMode === 'voucher') {
            handleSelectVoucher(item);
            setResults([]);
            setSearchMode(null);
            return;
        }
        if (searchMode === 'client') {
            // Fetch full details including address and historical points
            const { data: fullClient } = await supabase.from('customers')
                .select('codigo, nome, telefone, celular, carimbos, endereco, total_pontos, acumula_pontos_codigo, ultmov, aniversario, folha, data_cadastro')
                .eq('codigo', item.codigo)
                .single();

            if (fullClient) {
                setFormData(prev => ({
                    ...prev,
                    client_code: fullClient.codigo.toString(),
                    client_name: fullClient.nome,
                    client_phone: fullClient.telefone,
                    client_cellphone: fullClient.celular,
                    client_points: fullClient.carimbos,
                    client_address: fullClient.endereco,
                    client_total_points: fullClient.total_pontos,
                    client_last_mov: fullClient.ultmov,
                    client_birthday: fullClient.aniversario,
                    client_bday_month: fullClient.folha, // Assuming 'folha' is used for Month Anniversary as requested
                    client_registration_date: fullClient.data_cadastro
                }));

                // Logic for accumulation
                if (fullClient.acumula_pontos_codigo && fullClient.acumula_pontos_codigo !== fullClient.codigo) {
                    const { data: accum } = await supabase.from('customers')
                        .select('nome, carimbos')
                        .eq('codigo', fullClient.acumula_pontos_codigo)
                        .single();
                    if (accum) {
                        setFormData(prev => ({
                            ...prev,
                            accum_client_code: fullClient.acumula_pontos_codigo.toString(),
                            accum_client_name: accum.nome,
                            client_points_accum: accum.carimbos
                        }));
                    }
                }
            }
        } else if (searchMode === 'therapist') {
            setFormData(prev => ({
                ...prev,
                therapist_code: item.codigo.toString(),
                therapist_name: item.nome_abrev || item.nome
            }));
            // Delphi check for availability on that day
            const { data: sched } = await supabase.from('therapists_schedule')
                .select('*')
                .eq('therapist_code', item.codigo)
                .eq('data', formData.data_movimento)
                .single();
            if (!sched) {
                alert('AVISO: Colaborador não possui escala para este dia!');
                setSaveDisabled(true);
            } else {
                setSaveDisabled(false);
            }
        } else if (searchMode === 'product') {
            setFormData(prev => ({
                ...prev,
                product_code: item.codigo.toString(),
                product_name: item.nome,
                duration: item.tempo_duracao,
                points_pos: item.pontos,
                points_neg: item.ponto_negativo,
                base_value: item.preco.toFixed(2),
                value_primary: item.preco.toFixed(2),
                service_value: item.preco.toFixed(2)
            }));

            // Delphi Logic: "Havera Pagamento para este Faturamento?"
            setTimeout(() => {
                const paymentConfirmed = window.confirm('Havera Pagamento para este Faturamento ?');
                setHasPayment(paymentConfirmed); // Store payment confirmation (Resposta = 'S' or 'N')

                if (paymentConfirmed) {
                    // OK -> Focus Currency
                    if (currencyRef.current) currencyRef.current.focus();
                } else {
                    // Cancel -> Focus Save Button
                    if (saveButtonRef.current) saveButtonRef.current.focus();
                }
            }, 100);
        } else if (searchMode === 'pix_therapist') {
            setPixTherapist({
                codigo: item.codigo,
                nome: item.nome_abrev || item.nome
            });
            setShowPixTherapistModal(false);
        }
        setSearchMode(null);
        setResults([]);
    };

    const handlePixCheck = (value) => {
        if (value === 'PX') {
            const sameTherapist = window.confirm('O Pix é para o mesmo Terapeuta ?');
            if (!sameTherapist) {
                setShowPixTherapistModal(true);
            } else {
                setPixTherapist(null);
            }
        }
    };

    // --- Logic Utilities ---
    const handleLimpar = () => {
        setFormData(prev => ({
            ...prev,
            client_code: '', client_name: '', client_phone: '', client_cellphone: '',
            client_points: 0, client_total_points: 0, client_address: '',
            client_last_mov: '', client_birthday: '', client_bday_month: '', client_registration_date: '',
            accum_client_code: '', accum_client_name: '', client_points_accum: 0,
            therapist_code: '', therapist_name: '',
            product_code: '', product_name: '', duration: 0,
            points_pos: 0, points_neg: 0, base_value: '0.00',
            currency_primary: '', value_primary: '0.00',
            currency_sec: '', value_sec: '0.00',
            currency_extra: '', value_extra: '0.00',
            tip: '0.00', voucher_code: '', service_value: '0.00'
        }));
        setStatus('Novo');
        setSaveDisabled(false);
        setHasPayment(false); // Reset payment confirmation
    };



    // --- Detailed Payment Validations (Delphi Migration) ---
    const validatePaymentRules = () => {
        const {
            currency_primary, currency_sec, currency_extra,
            value_primary, value_sec, value_extra, tip,
            voucher_code, service_value
        } = formData;

        // Valid Currency Codes
        const validCodes = ['DN', 'CD', 'CH', 'CC', 'VM', 'VL', 'VO', 'DD', 'OM', 'VC', 'VR', 'PX'];

        // 1. Check if all currencies are empty
        if (!currency_primary && !currency_sec && !currency_extra) {
            alert('Tipo de Moeda em branco, inválido!');
            currencyRef.current?.focus();
            return false;
        }

        // 2. Validate Primary Currency
        if (currency_primary && !validCodes.includes(currency_primary)) {
            alert('Tipo de Moeda diferente de DN-CD-CH-CC-PX-VM-VL-VO-OM-VC-VR, inválido!');
            currencyRef.current?.focus();
            return false;
        }

        // 3. Validate Secondary Currency
        if (currency_sec && !validCodes.includes(currency_sec)) {
            alert('Tipo de Moeda 1 diferente de DN-CD-CH-CC-PX-VM-VL-VO-OM-VC-VR, inválido!');
            currencySecRef.current?.focus();
            return false;
        }

        // 4. Validate Extra Currency
        if (currency_extra && !validCodes.includes(currency_extra)) {
            alert('Tipo de Moeda 2 diferente de DN-CD-CH-CC-PX-VM-VL-VO-OM-VC-VR, inválido!');
            currencyExtraRef.current?.focus();
            return false;
        }

        // 5. Double Payment (DD) requires both secondary currencies
        if (currency_primary === 'DD' && (!currency_sec || !currency_extra)) {
            alert('Para pagamento duplo é necessário informar as duas Moedas, inválido!');
            if (!currency_sec) currencySecRef.current?.focus();
            else currencyExtraRef.current?.focus();
            return false;
        }

        // 6. VM requires Voucher Code
        if (currency_primary === 'VM' && !voucher_code) {
            alert('Para pagamento VM número de Controle não pode ser vazio, inválido!');
            voucherRef.current?.focus();
            return false;
        }

        // 7. Double Payment Total Check
        if (currency_primary === 'DD') {
            const totalPago = parseFloat(value_sec || 0) + parseFloat(value_extra || 0);
            const totalEsperado = parseFloat(service_value || 0) + parseFloat(tip || 0);

            if (Math.abs(totalPago - totalEsperado) > 0.01) {
                alert('Total dos dois Pagamentos diferente do Valor do Cadastro de Produto + Caixinha, inválido!');
                currencySecRef.current?.focus();
                return false;
            }
        }

        // 8. Invalid Combinations for DD
        if (currency_primary === 'DD') {
            if (
                (currency_sec === 'VR' && currency_extra === 'VC') ||
                (currency_sec === 'VC' && currency_extra === 'VR') ||
                (currency_sec === currency_extra)
            ) {
                alert('ERRO: Não é possível pagar com estas combinações, inválido!');
                currencySecRef.current?.focus();
                return false;
            }
        }

        // 9. Specific VM rules in DD
        if (currency_primary === 'DD' && currency_sec === 'VM') {
            if (!currency_extra) {
                alert('Para faturamento de VM moeda 2 não pode ser vazia!');
                currencyExtraRef.current?.focus();
                return false;
            }

            if (parseFloat(value_primary) === 0 || parseFloat(value_sec) === 0 || parseFloat(value_extra) === 0) {
                alert('Para faturamento de VM todos os campos Valor, Valor1 e Valor2 devem estar preenchidos!');
                return false;
            }
        }

        return true;
    };

    // --- Main Transaction Action ---
    const handleGravar = async () => {
        if (!formData.client_code || !formData.therapist_code || !formData.product_code) {
            return alert('Preencha os dados do cliente, colaborador e produto!');
        }



        // Run Payment Rules Validation
        if (!validatePaymentRules()) return;

        if (!confirm('Confirma a gravação deste faturamento?')) return;

        setLoading(true);
        try {
            // 1. Manage Sequence (Sequencia field from Delphi logic)
            // Robust lookup: Try standard format first, then legacy format (YYYYMMDD)
            let dateRecord = null;

            // Try Standard 'YYYY-MM-DD'
            const { data: dStandard } = await supabase
                .from('dates_calendar')
                .select('id, sequencia_faturamento')
                .eq('loja_codigo', parseInt(formData.loja_codigo))
                .eq('data', formData.data_movimento)
                .maybeSingle();

            if (dStandard) {
                dateRecord = dStandard;
            } else {
                // Try Legacy 'YYYYMMDD'
                const legacyDate = formData.data_movimento.replace(/-/g, '');
                const { data: dLegacy } = await supabase
                    .from('dates_calendar')
                    .select('id, sequencia_faturamento')
                    .eq('loja_codigo', parseInt(formData.loja_codigo))
                    .eq('data', legacyDate)
                    .maybeSingle();

                if (dLegacy) dateRecord = dLegacy;
            }

            if (!dateRecord) {
                throw new Error(`Não encontrou a data ${formData.data_movimento} (Loja ${formData.loja_codigo}) no calendário! Verifique se o ano foi gerado em Dates.`);
            }

            const nextSeq = (dateRecord.sequencia_faturamento || 0) + 1;
            await supabase.from('dates_calendar').update({ sequencia_faturamento: nextSeq }).eq('id', dateRecord.id);

            // 2. Prepare Transaction Payload
            const transactionRecord = {
                data: formData.data_movimento,
                cliente_codigo: parseInt(formData.client_code),
                cliente_nome: formData.client_name,
                sequencia: nextSeq,
                terapeuta_codigo: parseInt(formData.therapist_code),
                terapeuta_nome: formData.therapist_name,
                produto_codigo: parseInt(formData.product_code),
                produto_descricao: formData.product_name,
                valor_original: parseFloat(formData.base_value),
                hora_inicio: formData.start_time,
                pontos_pos: formData.points_pos,
                pontos_neg: formData.points_neg,
                tipo_moeda: formData.currency_primary,
                valor_pagamento: parseFloat(formData.value_primary),
                tipo_moeda1: formData.currency_sec,
                valor_pagamento1: parseFloat(formData.value_sec),
                tipo_moeda2: formData.currency_extra,
                valor_pagamento2: parseFloat(formData.value_extra),
                caixinha: parseFloat(formData.tip),
                preferencia: formData.preference,
                agendou: formData.scheduled,
                num_controle_venda: formData.voucher_code,
                loja_codigo: parseInt(formData.loja_codigo)
            };

            const { error: tError } = await supabase.from('billing_transactions').insert([transactionRecord]);
            if (tError) throw tError;

            // 3. Update Customer Points (Delphi Logic: only if Resposta = 'S')
            if (hasPayment) {
                // Check if client accumulates points for themselves or another client
                const clientCode = parseInt(formData.client_code);
                const accumCode = formData.accum_client_code ? parseInt(formData.accum_client_code) : null;

                if (!accumCode || clientCode === accumCode) {
                    // Case 1: Client accumulates points for themselves
                    // Update both historical points (total_pontos) and current points (carimbos)
                    const currentPoints = formData.client_points;
                    const currentTotalPoints = formData.client_total_points;

                    const newTotalPoints = currentTotalPoints + formData.points_pos;
                    const newPoints = currentPoints + formData.points_pos - formData.points_neg;

                    await supabase.from('customers')
                        .update({
                            total_pontos: newTotalPoints,
                            carimbos: newPoints,
                            ultmov: formData.data_movimento
                        })
                        .eq('codigo', clientCode);
                } else {
                    // Case 2: Client accumulates points for another client
                    // Update historical points for current client
                    const currentTotalPoints = formData.client_total_points;
                    const newTotalPoints = currentTotalPoints + formData.points_pos;

                    await supabase.from('customers')
                        .update({
                            total_pontos: newTotalPoints,
                            ultmov: formData.data_movimento
                        })
                        .eq('codigo', clientCode);

                    // Update current points (carimbos) for the accumulation target client
                    const accumCurrentPoints = formData.client_points_accum;
                    const newAccumPoints = accumCurrentPoints + formData.points_pos - formData.points_neg;

                    await supabase.from('customers')
                        .update({
                            carimbos: newAccumPoints,
                            ultmov: formData.data_movimento
                        })
                        .eq('codigo', accumCode);
                }
            }

            // 4. Handle Voucher Redemption (if needed)
            if (formData.voucher_code) {
                await supabase.from('massage_vouchers')
                    .update({ status_baixado: 'Sim' })
                    .eq('num_ctr', formData.voucher_code);
            }

            // 5. Therapist Closing / Commission Log
            // Fetch therapist type and product commission rates to calculate the correct commission
            let calcComissao = 0;
            const { data: therapistData } = await supabase
                .from('therapists')
                .select('tipo_a, tipo_b, tipo_c, tipo_d')
                .eq('codigo', parseInt(formData.therapist_code))
                .single();

            const { data: productData } = await supabase
                .from('products')
                .select('comissao_tipo_a, comissao_tipo_b, comissao_tipo_c, comissao_tipo_d')
                .eq('codigo', parseInt(formData.product_code))
                .single();

            if (therapistData && productData) {
                if (therapistData.tipo_a) calcComissao = productData.comissao_tipo_a || 0;
                else if (therapistData.tipo_b) calcComissao = productData.comissao_tipo_b || 0;
                else if (therapistData.tipo_c) calcComissao = productData.comissao_tipo_c || 0;
                else if (therapistData.tipo_d) calcComissao = productData.comissao_tipo_d || 0;
            }

            // Calculate PIX Total (across all payment fields)
            let pixTotal = 0;
            if (formData.currency_primary === 'PX') pixTotal += parseFloat(formData.value_primary || 0);
            if (formData.currency_sec === 'PX') pixTotal += parseFloat(formData.value_sec || 0);
            if (formData.currency_extra === 'PX') pixTotal += parseFloat(formData.value_extra || 0);

            const caixinha = parseFloat(formData.tip || 0);

            // PIX SPLIT LOGIC (Triggered by state from currency selection)
            let isPixForSameTherapist = pixTherapist ? false : true;

            // Proceed with records
            if (isPixForSameTherapist) {
                const saldoDia = (calcComissao - pixTotal) + caixinha;
                const { data: lastClosing } = await supabase
                    .from('therapist_closings')
                    .select('saldo_total')
                    .eq('terapeuta_codigo', parseInt(formData.therapist_code))
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const prevSaldoTotal = lastClosing ? parseFloat(lastClosing.saldo_total || 0) : 0;
                const newSaldoTotal = prevSaldoTotal + saldoDia;

                await supabase.from('therapist_closings').insert([{
                    terapeuta_codigo: parseInt(formData.therapist_code),
                    terapeuta_nome: formData.therapist_name,
                    comissao: calcComissao,
                    pix: pixTotal,
                    caixinha: caixinha,
                    saldo_dia: saldoDia,
                    saldo_total: newSaldoTotal,
                    data: formData.data_movimento,
                    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    observacao: 'Faturamento - Massagem',
                    cliente: formData.client_name,
                    servico: formData.product_name
                }]);
            } else {
                // Record 1: Original Therapist (Comissao + Caixinha, PIX = 0)
                const saldoDia1 = calcComissao + caixinha;
                const { data: lastClosing1 } = await supabase
                    .from('therapist_closings')
                    .select('saldo_total')
                    .eq('terapeuta_codigo', parseInt(formData.therapist_code))
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const prevSaldoTotal1 = lastClosing1 ? parseFloat(lastClosing1.saldo_total || 0) : 0;
                const newSaldoTotal1 = prevSaldoTotal1 + saldoDia1;

                await supabase.from('therapist_closings').insert([{
                    terapeuta_codigo: parseInt(formData.therapist_code),
                    terapeuta_nome: formData.therapist_name,
                    comissao: calcComissao,
                    pix: 0,
                    caixinha: caixinha,
                    saldo_dia: saldoDia1,
                    saldo_total: newSaldoTotal1,
                    data: formData.data_movimento,
                    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    observacao: 'Faturamento - Massagem (Split PIX)',
                    cliente: formData.client_name,
                    servico: formData.product_name
                }]);

                // Record 2: PIX Therapist (Comissao = 0, Caixinha = 0, PIX = Total PIX)
                const saldoDia2 = -pixTotal;
                const { data: lastClosing2 } = await supabase
                    .from('therapist_closings')
                    .select('saldo_total')
                    .eq('terapeuta_codigo', pixTherapist.codigo)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const prevSaldoTotal2 = lastClosing2 ? parseFloat(lastClosing2.saldo_total || 0) : 0;
                const newSaldoTotal2 = prevSaldoTotal2 + saldoDia2;

                await supabase.from('therapist_closings').insert([{
                    terapeuta_codigo: pixTherapist.codigo,
                    terapeuta_nome: pixTherapist.nome,
                    comissao: 0,
                    pix: pixTotal,
                    caixinha: 0,
                    saldo_dia: saldoDia2,
                    saldo_total: newSaldoTotal2,
                    data: formData.data_movimento,
                    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    observacao: `PIX Faturamento - Original: ${formData.therapist_code}`,
                    cliente: formData.client_name,
                    servico: formData.product_name
                }]);
            }

            // Audit Log
            if (session?.user) {
                const now = new Date();
                const auditData = {
                    usuario: session.user.email,
                    processo: 'Cadastro de Faturamento',
                    evento: 'Inclusão de Faturamento',
                    data: now.toISOString().split('T')[0],
                    hora: now.toTimeString().split(' ')[0],
                    referencia: `${formData.data_movimento} - ${formData.client_code} - ${formData.client_name} - ${formData.therapist_name} - ${formData.product_name}`
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

            alert('Faturamento gravado com sucesso!');
            handleLimpar();
            setPixTherapist(null);
            window.scrollTo(0, 0);
        } catch (err) {
            alert('Erro ao gravar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="billing-container">
            <header className="page-header">
                <div className="header-info">
                    <h1>Módulo de Faturamento</h1>
                    <p className="subtitle">Gestão de serviços, pagamentos e pontuação</p>
                </div>
                <div className="header-actions">
                    <button
                        ref={saveButtonRef}
                        className="btn btn-primary"
                        onClick={handleGravar}
                        disabled={loading || saveDisabled}
                    >
                        <FiSave /> {loading ? 'Gravando...' : 'Gravar Faturamento'}
                    </button>
                    <button className="btn btn-secondary" onClick={handleLimpar}>
                        <FiPlus /> Novo Cliente
                    </button>
                    <button className="btn btn-danger-outline">
                        <FiTrash2 /> Excluir Registro
                    </button>
                </div>
            </header>

            <div className="main-grid">
                {/* 1. Unidade e Calendario Section */}
                <div className="form-card card-client">
                    <div className="form-section-title">Contexto de Movimento</div>
                    <div className="form-row">
                        <div className="form-group span-2">
                            <label>Loja</label>
                            <input type="text" value={formData.loja_codigo} readOnly />
                        </div>
                        <div className="form-group span-3">
                            <label>Data</label>
                            <input type="date" value={formData.data_movimento} readOnly />
                        </div>
                        <div className="form-group span-2">
                            <label>Dia da Semana</label>
                            <input type="text" value={formData.dia_semana} readOnly />
                        </div>
                        <div className="form-group span-5">
                            <label>Nome do Dia</label>
                            <input type="text" value={formData.nome_dia_semana} readOnly style={{ fontWeight: 'bold', color: '#6366f1' }} />
                        </div>
                    </div>
                </div>

                {/* 2. Cliente Section */}
                <div className="form-card card-service">
                    <div className="form-section-title">Busca e Identificação do Cliente</div>
                    <div className="form-row">
                        <div className="form-group span-3 lookup-container">
                            <label>Cód. Cliente</label>
                            <input
                                type="number"
                                value={formData.client_code}
                                onChange={(e) => setFormData(prev => ({ ...prev, client_code: e.target.value }))}
                                onBlur={() => handleSearch('client', formData.client_code)}
                            />
                        </div>
                        <div className="form-group span-9 lookup-container">
                            <label>Nome do Cliente / Pesquisa Rapidamente</label>
                            <input
                                type="text"
                                value={formData.client_name}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, client_name: e.target.value }));
                                    handleSearch('client', e.target.value);
                                }}
                                placeholder="Digite o nome para buscar..."
                            />
                            {searchMode === 'client' && results.length > 0 && (
                                <div className="lookup-dropdown">
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome}</span>
                                            <span className="extra">{r.celular || r.telefone}</span>
                                        </div>
                                    ))}
                                </div>

                            )}
                        </div>
                    </div>

                    {/* Extended Client Info (Read-Only) */}
                    <div className="form-row">
                        <div className="form-group span-12">
                            <label>Endereço</label>
                            <input type="text" value={formData.client_address || ''} readOnly className="readonly-field" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group span-3">
                            <label>Telefone</label>
                            <input type="text" value={formData.client_phone || ''} readOnly className="readonly-field" />
                        </div>
                        <div className="form-group span-3">
                            <label>Celular</label>
                            <input type="text" value={formData.client_cellphone || ''} readOnly className="readonly-field" />
                        </div>
                        <div className="form-group span-3">
                            <label>Pontos (Atual)</label>
                            <input type="text" value={formData.client_points || 0} readOnly className="readonly-field" style={{ fontWeight: 'bold' }} />
                        </div>
                        <div className="form-group span-3">
                            <label>Pontos (Hist.)</label>
                            <input type="text" value={formData.client_total_points || 0} readOnly className="readonly-field" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group span-3">
                            <label>Ult.Lançamento</label>
                            <input type="date" value={formData.client_last_mov || ''} readOnly className="readonly-field" />
                        </div>
                        <div className="form-group span-3">
                            <label>Data Aniversario</label>
                            <input type="date" value={formData.client_birthday || ''} readOnly className="readonly-field" />
                        </div>
                        <div className="form-group span-3">
                            <label>Mês Aniv.</label>
                            <input type="text" value={formData.client_bday_month || ''} readOnly className="readonly-field" />
                        </div>
                        <div className="form-group span-3">
                            <label>Data Cadastro</label>
                            <input type="date" value={formData.client_registration_date || ''} readOnly className="readonly-field" />
                        </div>
                    </div>

                    {/* Accumulation Info (Conditional) */}
                    {formData.accum_client_code && (
                        <div className="form-row" style={{ marginTop: '0.5rem', background: '#eff6ff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                            <div className="form-group span-8">
                                <label style={{ color: '#1e40af' }}>Cliente Acumula Pontos (Origem)</label>
                                <input type="text" value={formData.accum_client_name || ''} readOnly style={{ background: 'transparent', border: 'none', fontWeight: 'bold', color: '#1e3a8a' }} />
                            </div>
                            <div className="form-group span-4">
                                <label style={{ color: '#1e40af' }}>Pontos (Origem)</label>
                                <input type="text" value={formData.client_points_accum || 0} readOnly style={{ background: 'transparent', border: 'none', fontWeight: 'bold', color: '#1e3a8a' }} />
                            </div>
                        </div>
                    )}

                    <div className="form-section-title" style={{ marginTop: '2rem' }}>Serviço e Colaborador</div>
                    <div className="form-row" style={{ position: 'relative', zIndex: searchMode === 'therapist' ? 9999 : 1 }}>
                        <div className="form-group span-2 lookup-container">
                            <label>Cód.</label>
                            <input
                                type="number"
                                value={formData.therapist_code}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, therapist_code: e.target.value }));
                                    handleSearch('therapist', e.target.value);
                                }}
                            />
                            {searchMode === 'therapist' && results.length > 0 && (
                                <div className="lookup-dropdown" style={{ minWidth: '350px', maxHeight: '350px', overflowY: 'auto', zIndex: 100 }}>
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome_abrev || r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group span-10 lookup-container">
                            <label>Colaborador</label>
                            <input
                                type="text"
                                value={formData.therapist_name}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, therapist_name: e.target.value }));
                                    handleSearch('therapist', e.target.value);
                                }}
                                placeholder="Pesquisar..."
                            />
                            {searchMode === 'therapist' && results.length > 0 && (
                                <div className="lookup-dropdown" style={{ maxWidth: '400px', maxHeight: '350px', overflowY: 'auto', zIndex: 100 }}>
                                    {results.map(r => (
                                        <div key={r.codigo} className="lookup-item" onClick={() => handleSelectResult(r)}>
                                            <span className="code">{r.codigo}</span>
                                            <span className="name">{r.nome_abrev || r.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group span-3">
                            <label>Início</label>
                            <input type="text" value={formData.start_time} onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))} />
                        </div>
                        <div className="form-group span-3">
                            <label>Preferência</label>
                            <select value={formData.preference} onChange={(e) => setFormData(prev => ({ ...prev, preference: e.target.value }))}>
                                <option value="N">N - Normal</option>
                                <option value="P">P - Preferência</option>
                                <option value="D">D - Direto</option>
                            </select>
                        </div>
                        <div className="form-group span-3">
                            <label>Agendou?</label>
                            <select value={formData.scheduled} onChange={(e) => setFormData(prev => ({ ...prev, scheduled: e.target.value }))}>
                                <option value="N">N - Não</option>
                                <option value="A">A - Agendado</option>
                            </select>
                        </div>
                        <div className="form-group span-3">
                            <label>Pontos Saldo</label>
                            <div className="points-tag">
                                <FiTag /> {formData.client_points} pts
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group span-2 lookup-container">
                            <label>Cód. Prod.</label>
                            <input
                                type="number"
                                value={formData.product_code}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, product_code: e.target.value }));
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
                        <div className="form-group span-5 lookup-container drop-up">
                            <label>Produto / Serviço</label>
                            <input
                                type="text"
                                value={formData.product_name}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, product_name: e.target.value }));
                                    handleSearch('product', e.target.value);
                                }}
                                placeholder="Pesquisar produto..."
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
                        <div className="form-group span-2">
                            <label>Duração</label>
                            <input type="text" value={formData.duration ? `${formData.duration} min` : ''} readOnly style={{ fontWeight: 'bold' }} />
                        </div>
                        <div className="form-group span-3">
                            <label>Valor Serviço</label>
                            <input type="number" value={formData.value_primary} onChange={(e) => setFormData(prev => ({ ...prev, value_primary: e.target.value, service_value: e.target.value }))} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group span-3">
                            <label>Pontos Positivo</label>
                            <input type="text" value={formData.points_pos} readOnly className="readonly-field" style={{ fontWeight: 'bold', color: '#059669' }} />
                        </div>
                        <div className="form-group span-3">
                            <label>Pontos Negativo</label>
                            <input type="text" value={formData.points_neg} readOnly className="readonly-field" style={{ fontWeight: 'bold', color: '#dc2626' }} />
                        </div>
                    </div>
                </div>

                {/* 3. Pagamento Section */}
                <div className="form-card card-payment">
                    <div className="form-section-title">Pagamento</div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Valor Serviço</label>
                        <input
                            type="text"
                            value={formData.service_value}
                            readOnly
                            disabled
                            className="readonly-field"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Tipo Moeda Principal</label>
                        <select
                            ref={currencyRef}
                            value={formData.currency_primary}
                            onChange={async (e) => {
                                const newValue = e.target.value;
                                if (newValue === 'DD') {
                                    setFormData(prev => ({
                                        ...prev,
                                        currency_primary: newValue,
                                        service_value: '0.00'
                                    }));
                                } else if (newValue === 'VM') {
                                    setActiveVoucherField('primary');
                                    setFormData(prev => ({
                                        ...prev,
                                        currency_primary: newValue,
                                        currency_sec: '',
                                        value_sec: '0.00',
                                        currency_extra: '',
                                        value_extra: '0.00'
                                    }));
                                    setTimeout(() => voucherRef.current?.focus(), 100);
                                } else {
                                    let fetchedValue = formData.base_value;

                                    if (newValue && formData.product_code) {
                                        const { data } = await supabase
                                            .from('product_currencies')
                                            .select('valor')
                                            .eq('product_code', parseInt(formData.product_code))
                                            .eq('currency_code', newValue)
                                            .maybeSingle();

                                        if (data) {
                                            fetchedValue = parseFloat(data.valor).toFixed(2);
                                        }
                                    }

                                    setFormData(prev => ({
                                        ...prev,
                                        currency_primary: newValue,
                                        currency_sec: '',
                                        value_sec: '0.00',
                                        currency_extra: '',
                                        value_extra: '0.00',
                                        service_value: fetchedValue,
                                        value_primary: fetchedValue
                                    }));
                                    setTimeout(() => tipRef.current?.focus(), 100);
                                }
                                handlePixCheck(newValue);

                                if (newValue === 'VM' && parseFloat(formData.tip) > 0) {
                                    alert("Caixinha com VM, coloque a moeda que vai pagar a caixinha no campo Tipo Moeda 1");
                                    setTimeout(() => currencySecRef.current?.focus(), 100);
                                }
                            }}
                        >
                            <option value="">Selecione...</option>
                            <option value="PX">PIX</option>
                            <option value="CC">Cartão Crédito</option>
                            <option value="CD">Cartão Débito</option>
                            <option value="DN">Dinheiro</option>
                            <option value="DD">Duplo (Split)</option>
                            <option value="CH">Cheque</option>
                            <option value="VM">Vale Massagem</option>
                        </select>
                    </div>

                    <div className="form-row" style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#f8fafc', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}>
                        <div className="form-group span-6">
                            <label>Tipo Moeda 1</label>
                            <select
                                ref={currencySecRef}
                                value={formData.currency_sec}
                                onChange={async (e) => {
                                    const currCode = e.target.value;
                                    setFormData(prev => ({ ...prev, currency_sec: currCode }));

                                    if (currCode === 'VM') {
                                        setActiveVoucherField('sec');
                                        setTimeout(() => voucherRef.current?.focus(), 100);
                                    } else if (formData.currency_primary !== 'VM' && (formData.currency_primary === 'DD' || currCode === 'PX') && currCode && formData.product_code) {
                                        const { data, error } = await supabase
                                            .from('product_currencies')
                                            .select('valor')
                                            .eq('product_code', parseInt(formData.product_code))
                                            .eq('currency_code', currCode)
                                            .maybeSingle();

                                        if (data) {
                                            const val = parseFloat(data.valor).toFixed(2);
                                            setFormData(prev => ({
                                                ...prev,
                                                service_value: val,
                                                value_primary: val
                                            }));
                                        } else if (formData.currency_primary === 'DD') {
                                            setFormData(prev => ({
                                                ...prev,
                                                service_value: prev.base_value,
                                                value_primary: prev.base_value
                                            }));
                                        }
                                    }

                                    handlePixCheck(currCode);
                                }}
                                disabled={formData.currency_primary !== 'DD' && !(formData.currency_primary === 'VM' && parseFloat(formData.tip) > 0)}
                            >
                                <option value="">Selecione...</option>
                                <option value="PX">PIX</option>
                                <option value="CC">Cartão Crédito</option>
                                <option value="CD">Cartão Débito</option>
                                <option value="DN">Dinheiro</option>
                                <option value="DD">Duplo (Split)</option>
                                <option value="CH">Cheque</option>
                                <option value="VM">Vale Massagem</option>
                            </select>
                        </div>
                        <div className="form-group span-6">
                            <label>Valor 1</label>
                            <input
                                ref={valueSecRef}
                                type="number"
                                value={formData.value_sec}
                                onChange={(e) => setFormData(prev => ({ ...prev, value_sec: e.target.value }))}
                                disabled={formData.currency_primary !== 'DD' && !(formData.currency_primary === 'VM' && parseFloat(formData.tip) > 0)}
                            />
                        </div>
                    </div>
                    <div className="form-row" style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#f8fafc', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}>
                        <div className="form-group span-6">
                            <label>Tipo Moeda 2</label>
                            <select
                                ref={currencyExtraRef}
                                value={formData.currency_extra}
                                onChange={async (e) => {
                                    const currCode = e.target.value;
                                    setFormData(prev => ({ ...prev, currency_extra: currCode }));
                                    if (currCode === 'VM') {
                                        setActiveVoucherField('extra');
                                        setTimeout(() => voucherRef.current?.focus(), 100);
                                    } else if (
                                        formData.currency_primary !== 'VM' &&
                                        currCode === 'PX' &&
                                        formData.product_code &&
                                        formData.currency_primary !== 'DD' // Rule 2: If DD, don't overwrite primary with extra's PX value
                                    ) {
                                        const { data } = await supabase
                                            .from('product_currencies')
                                            .select('valor')
                                            .eq('product_code', parseInt(formData.product_code))
                                            .eq('currency_code', currCode)
                                            .maybeSingle();

                                        if (data) {
                                            const val = parseFloat(data.valor).toFixed(2);
                                            setFormData(prev => ({
                                                ...prev,
                                                service_value: val,
                                                value_primary: val
                                            }));
                                        }
                                    }
                                    handlePixCheck(currCode);
                                }}
                                onBlur={async () => {
                                    const isDDVM = formData.currency_primary === 'DD' && formData.currency_sec === 'VM';
                                    const isPX = formData.currency_extra === 'PX' && formData.currency_primary !== 'DD'; // Rule 2: Only fetch if NOT DD
                                    const isDDPX = formData.currency_primary === 'DD' && formData.currency_sec === 'PX'; // Rule 1 context

                                    // If DD+PX (either sec or extra), we should NOT be updating primary here based on extra
                                    if ((isDDVM || isPX) && formData.currency_extra && formData.product_code) {
                                        const { data } = await supabase
                                            .from('product_currencies')
                                            .select('valor')
                                            .eq('product_code', parseInt(formData.product_code))
                                            .eq('currency_code', formData.currency_extra)
                                            .maybeSingle();

                                        if (data) {
                                            const val = parseFloat(data.valor).toFixed(2);
                                            setFormData(prev => ({
                                                ...prev,
                                                service_value: val,
                                                value_primary: val
                                            }));
                                        }
                                    }
                                }}
                                disabled={formData.currency_primary !== 'DD'}
                            >
                                <option value="">Selecione...</option>
                                <option value="PX">PIX</option>
                                <option value="CC">Cartão Crédito</option>
                                <option value="CD">Cartão Débito</option>
                                <option value="DN">Dinheiro</option>
                                <option value="DD">Duplo (Split)</option>
                                <option value="CH">Cheque</option>
                                <option value="VM">Vale Massagem</option>
                            </select>
                        </div>
                        <div className="form-group span-6">
                            <label>Valor 2</label>
                            <input
                                type="number"
                                value={formData.value_extra}
                                readOnly
                                disabled
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Caixinha (Opcional)</label>
                        <input
                            ref={tipRef}
                            type="number"
                            value={formData.tip}
                            onChange={(e) => setFormData(prev => ({ ...prev, tip: e.target.value }))}
                            onBlur={() => {
                                if (formData.currency_primary === 'DD') {
                                    const valorServico = parseFloat(formData.service_value || 0);
                                    const caixinha = parseFloat(formData.tip || 0);
                                    const valor1 = parseFloat(formData.value_sec || 0);
                                    const wdifmoe = (valorServico + caixinha) - valor1;
                                    setFormData(prev => ({ ...prev, value_extra: wdifmoe.toFixed(2) }));
                                }

                                if (formData.currency_primary === 'VM' && parseFloat(e.target.value) > 0) {
                                    alert("Caixinha com VM, coloque a moeda que vai pagar a caixinha no campo Tipo Moeda 1");
                                    setTimeout(() => currencySecRef.current?.focus(), 100);
                                }
                            }}
                        />
                    </div>

                    <div className="summary-box">
                        <div className="summary-row">
                            <span>Valor Serviço</span>
                            <span>R$ {formData.value_primary}</span>
                        </div>
                        <div className="summary-row">
                            <span>Ganha Pontos</span>
                            <span style={{ color: '#059669', fontWeight: 'bold' }}>+ {formData.points_pos}</span>
                        </div>
                        <div className="summary-row">
                            <span>Caixinha</span>
                            <span>R$ {formData.tip}</span>
                        </div>
                        <div className="summary-row">
                            <span>Total a Pagar</span>
                            <span>R$ {(parseFloat(formData.value_primary) + parseFloat(formData.tip)).toFixed(2)}</span>
                        </div>
                    </div>

                    {(formData.currency_primary === 'VM' || formData.currency_sec === 'VM' || formData.currency_extra === 'VM') && (
                        <div className="form-group lookup-container drop-up">
                            <label>Número do Controle VM</label>
                            <input
                                ref={voucherRef}
                                type="text"
                                value={formData.voucher_code}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, voucher_code: e.target.value }));
                                    handleSearch('voucher', e.target.value);
                                }}
                                onFocus={() => {
                                    if (formData.voucher_code === '') handleSearch('voucher', 'all');
                                }}
                                placeholder="Nº do Vale..."
                                disabled={formData.voucher_code !== ''}
                                className={formData.voucher_code !== '' ? "readonly-field" : ""}
                            />
                            {searchMode === 'voucher' && results.length > 0 && (
                                <div className="lookup-dropdown lookup-grid">
                                    <table className="lookup-grid-table">
                                        <thead>
                                            <tr>
                                                <th>Nº CTR</th>
                                                <th>Venda</th>
                                                <th>Produto</th>
                                                <th>Valor</th>
                                                <th>Cliente</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map(v => (
                                                <tr key={v.num_ctr} className="clickable-row" onClick={() => handleSelectResult(v)}>
                                                    <td>{v.num_ctr}</td>
                                                    <td>{v.data_venda ? v.data_venda.split('-').reverse().join('/') : ''}</td>
                                                    <td>{v.produto_nome}</td>
                                                    <td>R$ {v.valor.toFixed(2)}</td>
                                                    <td>{v.cliente_massagem || v.cliente_compra}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {formData.points_neg > 0 && (
                        <div className="voucher-alert">
                            <FiCheckSquare />
                            <span>Utiliza <strong>{formData.points_neg} pontos</strong> de fidelidade.</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleGravar}
                            disabled={loading || saveDisabled}
                            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                        >
                            <FiSave /> {loading ? 'Gravando...' : 'Gravar Faturamento'}
                        </button>
                    </div>
                </div>
            </div >

            {/* PIX Therapist Selection Modal */}
            {
                showPixTherapistModal && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ overflow: 'visible', paddingBottom: '2rem' }}>
                            <div className="modal-header">
                                <h3>Selecionar Terapeuta para o PIX</h3>
                                <button className="btn-close" onClick={() => setShowPixTherapistModal(false)}><FiX /></button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group lookup-container">
                                    <label>Pesquisar Terapeuta</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Digite o nome, ou código..."
                                        onChange={(e) => handleSearch('pix_therapist', e.target.value)}
                                        onFocus={async (e) => {
                                            if (e.target.value === '') {
                                                setSearchMode('pix_therapist');
                                                const { data } = await supabase.from('therapists').select('codigo, nome, nome_abrev').limit(50);
                                                setResults(data || []);
                                            }
                                        }}
                                    />
                                    {searchMode === 'pix_therapist' && results.length > 0 && (
                                        <div className="lookup-dropdown" style={{ position: 'relative', top: '0', maxHeight: '250px', overflowY: 'auto', marginTop: '0.5rem', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                                            {results.map(r => (
                                                <div key={r.codigo} className="lookup-item" style={{ padding: '12px' }} onClick={() => handleSelectResult(r)}>
                                                    <span className="code">{r.codigo}</span>
                                                    <span className="name">{r.nome_abrev || r.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {pixTherapist && (
                                    <div className="selected-info">
                                        <p>Selecionado: <strong>{pixTherapist.nome}</strong> ({pixTherapist.codigo})</p>
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', marginTop: '1rem' }}
                                            onClick={() => {
                                                // Trigger save again but with pixTherapist already set
                                                handleGravar();
                                            }}
                                        >
                                            <FiSave /> Confirmar e Gravar Faturamento
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Billing;
