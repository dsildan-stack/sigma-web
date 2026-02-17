-- Create Auditoria table
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario TEXT NOT NULL,
    processo TEXT NOT NULL,
    evento TEXT NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    referencia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to insert
CREATE POLICY "Enable insert for authenticated users only" ON auditoria
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Create policy to allow authenticated users to select (optional, for viewing history)
CREATE POLICY "Enable select for authenticated users only" ON auditoria
    FOR SELECT TO authenticated
    USING (true);
