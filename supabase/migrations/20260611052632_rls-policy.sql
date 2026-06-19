ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON security_events
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow authenticated insert" ON security_events
FOR INSERT
TO authenticated
WITH CHECK (true);