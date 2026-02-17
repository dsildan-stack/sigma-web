
import { createClient } from '@supabase/supabase-js';

// Hardcoded keys for debugging
const supabaseUrl = 'https://pjgngbgsunodivfajubf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZ25nYmdzdW5vZGl2ZmFqdWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyNDcxNDksImV4cCI6MjA1MjgyMzE0OX0.u43bEal9V2uY2tXJt4uH_sWBK_zQ0nK_O7Tq7pL7pGo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDates() {
    console.log('Searching dates_calendar for range 2026-01-01 to 2026-02-01...');

    // 1. Get records for range to see format
    const { data: rangeData, error } = await supabase
        .from('dates_calendar')
        .select('*')
        .eq('loja_codigo', 2)
        .gte('data', '2026-01-20')
        .lte('data', '2026-01-30')
        .limit(5);

    if (error) {
        console.error('Error fetching range:', error);
    } else {
        console.log('Range Query Result:', rangeData);
        if (rangeData && rangeData.length > 0) {
            rangeData.forEach(r => {
                console.log(`ID: ${r.id}, Date: "${r.data}", Loja: ${r.loja_codigo} (${typeof r.loja_codigo})`);
            });
        } else {
            console.log('No records found in range 2026-01-20 to 2026-01-30 for loja 2.');
        }
    }
}

checkDates();
