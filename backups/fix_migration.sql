-- Fix: Pindahkan karyawan dari HQ Jakarta ke KANTOR PUSAT (HEAD OFFICE)
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PUSAT (HEAD OFFICE)')
WHERE office_id = (SELECT id FROM offices WHERE name = 'HQ Jakarta');

-- Pindahkan juga karyawan dari Home ke KANTOR PUSAT (HEAD OFFICE)
UPDATE users SET office_id = (SELECT id FROM offices WHERE name = 'KANTOR PUSAT (HEAD OFFICE)')
WHERE office_id = (SELECT id FROM offices WHERE name = 'Home');

-- Verifikasi hasil
SELECT o.name as office_name, o.is_active, COUNT(u.id) as employee_count
FROM offices o
LEFT JOIN users u ON u.office_id = o.id
GROUP BY o.name, o.is_active
ORDER BY o.is_active DESC, employee_count DESC;
