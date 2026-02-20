const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kjsfjekxgntwnffnehjf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqc2ZqZWt4Z250d25mZm5laGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDg0ODcsImV4cCI6MjA4NDgyNDQ4N30.f_emvDHa8vXqFj4EGcoqdMZq4zre0qqYwYEEi2h2F9s';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const formatDate = (dateStr) => {
    if (!dateStr || dateStr.includes('01/01/1800') || dateStr.includes('11/11/1111') || dateStr.includes('01/01/0101')) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const cleanString = (str) => {
    if (!str) return null;
    let s = str.trim();
    if (s === '-' || s === '(  )     -' || s === '     -') return null;
    return s;
};

async function importData() {
    try {
        const csvPath = './Clientes.csv';
        if (!fs.existsSync(csvPath)) {
            console.error('File Clientes.csv not found at:', csvPath);
            return;
        }

        const csvData = fs.readFileSync(csvPath, 'utf8');
        const lines = csvData.split('\n');
        const headers = lines[0].split(';');

        const customers = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(';');

            const customer = {
                codigo: parseInt(values[0]),
                nome: cleanString(values[1]),
                endereco: cleanString(values[2]),
                bairro: cleanString(values[3]),
                cidade: cleanString(values[4]) || 'São Paulo',
                estado: cleanString(values[5]) || 'SP',
                cep: cleanString(values[6]),
                aniversario: formatDate(values[7]),
                carimbos: parseFloat(values[8]?.replace(',', '.') || '0') || 0,
                sexo: (values[9] === 'M' || values[9] === 'F') ? values[9] : 'M',
                ficticio: (values[10] === 'V' || values[10] === 'F') ? values[10] : 'F',
                telefone: cleanString(values[12]),
                celular: cleanString(values[13]),
                acumula_pontos_codigo: parseInt(values[14]) || parseInt(values[0]),
                folha: cleanString(values[15]),
                data_cadastro: formatDate(values[16]) || new Date().toISOString().split('T')[0],
                total_pontos: parseFloat(values[17]?.replace(',', '.') || '0') || 0,
                email: cleanString(values[18]),
                premio1_check: values[19] === 'S' || values[19] === 'V',
                premio1_data: formatDate(values[20]),
                premio1_cliente_codigo: (parseInt(values[21]) > 0) ? parseInt(values[21]) : null,
                premio2_check: values[22] === 'S' || values[22] === 'V',
                premio2_data: formatDate(values[23]),
                premio2_cliente_codigo: (parseInt(values[24]) > 0) ? parseInt(values[24]) : null,
                premio3_check: values[25] === 'S' || values[25] === 'V',
                premio3_data: formatDate(values[26]),
                premio3_cliente_codigo: (parseInt(values[27]) > 0) ? parseInt(values[27]) : null,
            };

            customers.push(customer);
        }

        console.log(`Prepared ${customers.length} customers. Starting import...`);

        const chunkSize = 50;
        for (let i = 0; i < customers.length; i += chunkSize) {
            const chunk = customers.slice(i, i + chunkSize);
            const { error } = await supabase.from('customers').upsert(chunk, { onConflict: 'codigo' });
            if (error) {
                console.error(`Error importing chunk ${i / chunkSize}:`, error.message);
            } else {
                console.log(`Imported chunk ${i / chunkSize + 1}`);
            }
        }

        console.log('Import finished successfully!');
    } catch (err) {
        console.error('Uncaught error during import:', err);
    }
}

importData();
