-- Migrasi Karyawan ke Kantor Baru

-- 1. Branch North → KANTOR PELAMBUA
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PELAMBUA')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Branch North');

-- 2. Branch South → KANTOR PROJECT APBN/APBD
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PROJECT APBN/APBD')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Branch South');

-- 3. HQ Jakarta → KANTOR PUSAT (HEAD OFFICE)
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'HQ Jakarta')
WHERE office_id = (SELECT id FROM offices WHERE name = 'KANTOR PUSAT (HEAD OFFICE)');

-- 4. Sales Outpost → SITE BAULA  
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'SITE BAULA')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Sales Outpost');

-- 5. Tech Hub → WORKSHOP BENDE
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'WORKSHOP BENDE')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Tech Hub');

-- Verifikasi hasil: Tampilkan jumlah karyawan per kantor
SELECT o.name as office_name, o.is_active, COUNT(u.id) as employee_count
FROM offices o
LEFT JOIN users u ON u.office_id = o.id
GROUP BY o.name, o.is_active
ORDER BY o.is_active DESC, employee_count DESC;
