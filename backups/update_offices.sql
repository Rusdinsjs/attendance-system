-- Update data kantor yang sudah ada dengan koordinat dari image

-- 1. KANTOR PUSAT (HEAD OFFICE)
UPDATE offices SET 
    address = 'Jl. Poros Kolaka-Pomalaa, Kel.Ngapa',
    latitude = -4.1266397,
    longitude = 121.6721419,
    radius = 100,
    check_in_time = '08:00',
    is_active = true
WHERE name = 'KANTOR PUSAT (HEAD OFFICE)';

-- 2. KANTOR PELAMBUA
UPDATE offices SET 
    address = 'Jl. Poros Kolaka-Pomalaa, Kel. Pelambua',
    latitude = -4.1781468,
    longitude = 121.6251507,
    radius = 100,
    check_in_time = '08:00',
    is_active = true
WHERE name = 'KANTOR PELAMBUA';

-- 3. WORKSHOP BENDE (radius 1300 sesuai image)
UPDATE offices SET 
    address = 'Desa Bende, Kec. Wudulako',
    latitude = -4.1280500,
    longitude = 121.6531279,
    radius = 1300,
    check_in_time = '08:00',
    is_active = true
WHERE name = 'WORKSHOP BENDE';

-- 4. SITE BAULA
UPDATE offices SET 
    address = 'Desa Baula, Kec. Baula',
    latitude = -4.1512629,
    longitude = 121.6940279,
    radius = 100,
    check_in_time = '08:00',
    is_active = true
WHERE name = 'SITE BAULA';

-- 5. KANTOR PROJECT APBN/APBD
UPDATE offices SET 
    address = 'Jl. Poros Kolaka-Pomalaa, Kel.Ngapa',
    latitude = -4.0649247,
    longitude = 121.6721419,
    radius = 100,
    check_in_time = '08:00',
    is_active = true
WHERE name = 'KANTOR PROJECT APBN/APBD';

-- Nonaktifkan kantor lama yang tidak diperlukan
UPDATE offices SET is_active = false WHERE name IN (
    'Branch South',
    'Branch North', 
    'Tech Hub',
    'Sales Outpost',
    'HQ Jakarta',
    'Home'
);

-- Tampilkan hasil
SELECT name, address, latitude, longitude, radius, check_in_time, is_active 
FROM offices 
ORDER BY is_active DESC, name;
