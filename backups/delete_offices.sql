-- Migrasi Kiosks ke Kantor Baru

-- Update kiosks ke kantor baru
UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PELAMBUA')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Branch North');

UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PROJECT APBN/APBD')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Branch South');

UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PUSAT (HEAD OFFICE)')
WHERE office_id = (SELECT id FROM offices WHERE name = 'HQ Jakarta');

UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'SITE BAULA')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Sales Outpost');

UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'WORKSHOP BENDE')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Tech Hub');

UPDATE kiosks SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PUSAT (HEAD OFFICE)')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Home');

-- Sekarang hapus kantor nonaktif kecuali Home
DELETE FROM offices 
WHERE is_active = false AND name != 'Home';

-- Verifikasi hasil
SELECT name, address, is_active FROM offices ORDER BY is_active DESC, name;
