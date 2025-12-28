# Attendance System - Online/Offline Architecture

Dokumen ini menjelaskan alur kerja dan arsitektur sistem untuk kondisi Online dan Offline pada ketiga platform: **Mobile App**, **Kiosk**, dan **Admin Dashboard**.

---

## 📊 Overview Arsitektur

```mermaid
flowchart TB
    subgraph Cloud["☁️ Cloud Server (VPS)"]
        API["Go Backend API"]
        DB[(PostgreSQL)]
        FS["Python Face Service"]
        API <--> DB
        API <--> FS
    end

    subgraph Mobile["📱 Mobile App"]
        MA["React Native App"]
        TFL["TensorFlow Lite"]
        AS[(AsyncStorage)]
        SS[(SecureStore)]
        MA --> TFL
        MA --> AS
        MA --> SS
    end

    subgraph Kiosk["🖥️ Kiosk"]
        KW["React Web App"]
        IDB[(IndexedDB)]
        LFS["Local Face Service\n(Optional Docker)"]
        KW --> IDB
        KW -.-> LFS
    end

    subgraph Admin["💻 Admin Dashboard"]
        AD["React Web App"]
        AD -.-> |"Read Only"| LS[(LocalStorage)]
    end

    Mobile <-->|"Online"| API
    Kiosk <-->|"Online"| API
    Admin <-->|"Online Only"| API

    style Cloud fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style Mobile fill:#064e3b,stroke:#34d399,color:#fff
    style Kiosk fill:#7c2d12,stroke:#fb923c,color:#fff
    style Admin fill:#4c1d95,stroke:#a78bfa,color:#fff
```

---

## 1️⃣ Mobile App

### Kapabilitas Offline

| Fitur | Online | Offline |
|-------|--------|---------|
| **Login** | ✅ Server Auth | ✅ Cached Credentials |
| **Check-In/Out** | ✅ API Server | ✅ Queue Lokal |
| **Face Verification** | ✅ TFLite Lokal | ✅ TFLite Lokal |
| **View Riwayat** | ✅ API Server | ⚠️ Data Cached |
| **Sync Data** | - | ✅ Auto saat online |

> [!IMPORTANT]
> **Offline Login Requirements:**
> - User harus pernah login online minimal 1x
> - Credentials valid selama **7 hari** tanpa login online
> - Password di-hash dengan **SHA-256 + salt**
> - Disimpan di **Secure Store** (Keychain iOS / Keystore Android)

### Flow Diagram - Mobile Login (Online vs Offline)

```mermaid
flowchart TD
    Start([Buka App]) --> CheckNet{Cek Koneksi}
    
    CheckNet -->|Online| OnlineLogin
    CheckNet -->|Offline| OfflineLogin
    
    subgraph OnlineLogin["🌐 ONLINE LOGIN"]
        OL1[User input Email + Password] --> OL2["POST /api/auth/login"]
        OL2 --> OL3{Response?}
        OL3 -->|Success| OL4[Return JWT + User Data]
        OL4 --> OL5[Cache Credentials ke SecureStore]
        OL5 --> OL6[Cache User Data ke AsyncStorage]
        OL6 --> OL7[/"✅ Login Berhasil"/]
        OL3 -->|Failed| OL8[/"❌ Login Gagal"/]
    end
    
    subgraph OfflineLogin["📴 OFFLINE LOGIN"]
        OFF1[User input Email + Password] --> OFF2{Cached Credentials\nTersedia?}
        OFF2 -->|Ya| OFF3[Hash Input Password]
        OFF3 --> OFF4{Hash Match?}
        OFF4 -->|Ya| OFF5{Valid < 7 Hari?}
        OFF5 -->|Ya| OFF6[Load User dari Cache]
        OFF6 --> OFF7[/"✅ Login Berhasil\n(Mode Offline)"/]
        OFF5 -->|Tidak| OFF8[/"❌ Credentials Expired"/]
        OFF4 -->|Tidak| OFF9[/"❌ Password Salah"/]
        OFF2 -->|Tidak| OFF10[/"❌ Belum Pernah Login"/]
    end
    
    style OnlineLogin fill:#064e3b,stroke:#34d399
    style OfflineLogin fill:#78350f,stroke:#fbbf24
```

### Flow Diagram - Mobile Check-In

```mermaid
flowchart TD
    Start([User buka Check-In]) --> CheckLoc{Cek Lokasi GPS}
    CheckLoc -->|Valid| CheckNet{Cek Koneksi}
    CheckLoc -->|Invalid| ErrLoc[/"❌ Di luar radius"/]
    
    CheckNet -->|Online| OnlineFlow
    CheckNet -->|Offline| OfflineFlow
    
    subgraph OnlineFlow["🌐 ONLINE MODE"]
        OF1[Buka Kamera] --> OF2[TFLite: Extract Embedding]
        OF2 --> OF3[Bandingkan dengan Cache]
        OF3 -->|Match| OF4["POST /api/attendance/check-in"]
        OF4 --> OF5[/"✅ Check-In Berhasil"/]
        OF3 -->|No Match| OF6[/"❌ Wajah tidak cocok"/]
    end
    
    subgraph OfflineFlow["📴 OFFLINE MODE"]
        OFF1[Buka Kamera] --> OFF2[TFLite: Extract Embedding]
        OFF2 --> OFF3[Bandingkan dengan Cache\ndi AsyncStorage]
        OFF3 -->|Match| OFF4[Simpan ke\nOffline Queue]
        OFF4 --> OFF5[/"✅ Check-In Tersimpan\n(Offline)"/]
        OFF3 -->|No Match| OFF6[/"❌ Wajah tidak cocok"/]
    end
    
    OFF5 --> SyncLater[/"⏳ Sync saat online"/]
    
    style OnlineFlow fill:#064e3b,stroke:#34d399
    style OfflineFlow fill:#78350f,stroke:#fbbf24
```

### Data Storage - Mobile

```mermaid
flowchart LR
    subgraph SecureStore["🔐 Expo SecureStore (Encrypted)"]
        CC["offline_cached_credentials\n• email\n• passwordHash\n• salt\n• createdAt"]
    end
    
    subgraph AsyncStorage["📦 AsyncStorage"]
        CU["offline_cached_user\n(User profile data)"]
        FE["@offline_face_embeddings\n(Face vectors)"]
        PA["@offline_pending_attendance\n(Queue records)"]
        LS["@offline_last_sync\n(Timestamp)"]
        LO["offline_last_online_login\n(Validity check)"]
    end
    
    subgraph TFLite["🧠 TensorFlow Lite"]
        Model["mobilefacenet.tflite\n(Bundled in APK)"]
    end
```

### Sync Flow - Mobile

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant SS as SecureStore
    participant AS as AsyncStorage
    participant API as Server API
    participant DB as PostgreSQL
    
    Note over App: Saat Login Online...
    
    App->>API: POST /api/auth/login
    API->>DB: Verify credentials
    DB-->>API: User data + embeddings
    API-->>App: {user, access_token, refresh_token}
    
    App->>SS: cacheCredentials(email, password)
    App->>AS: cacheUser(userData)
    App->>AS: cacheFaceEmbeddings(embeddings)
    
    Note over App: ✅ Ready for offline use
    
    Note over App: Saat kembali online...
    
    App->>AS: getPendingAttendance()
    AS-->>App: [{check-in record}, ...]
    
    App->>API: POST /api/attendance/offline-sync
    API->>DB: Insert/Update records
    DB-->>API: Success
    API-->>App: {synced: 3, errors: []}
    
    App->>AS: clearPendingAttendance()
    
    Note over App: ✅ Queue cleared
```

---

## 2️⃣ Kiosk

### Kapabilitas Offline

| Fitur | Online | Offline |
|-------|--------|---------|
| **Scan QR** | ✅ Server Lookup | ✅ IndexedDB Lookup |
| **Check-In/Out** | ✅ API Server | ✅ Queue Lokal |
| **Face Verification** | ✅ Server/Local | ⚠️ Simplified |
| **Registrasi Wajah** | ✅ API Server | ❌ Tidak bisa |
| **Sync Data** | ✅ Auto 30 menit | - |

> [!NOTE]
> Kiosk tidak memerlukan login karena sudah di-pair dengan admin code.

### Flow Diagram - Kiosk Check-In

```mermaid
flowchart TD
    Start([QR Code Scan]) --> CheckNet{Cek Koneksi}
    
    CheckNet -->|Online| OnlineFlow
    CheckNet -->|Offline| OfflineFlow
    
    subgraph OnlineFlow["🌐 ONLINE MODE"]
        ON1["POST /api/kiosk/scan"] --> ON2{Employee Found?}
        ON2 -->|Yes| ON3[Tampilkan Info Karyawan]
        ON2 -->|No| ON4[/"❌ Tidak ditemukan"/]
        ON3 --> ON5[Capture Foto]
        ON5 --> ON6["POST /api/kiosk/check-in"]
        ON6 --> ON7[/"✅ Check-In Berhasil"/]
    end
    
    subgraph OfflineFlow["📴 OFFLINE MODE"]
        OFF1[Lookup di IndexedDB] --> OFF2{Employee Found?}
        OFF2 -->|Yes| OFF3[Tampilkan Info Karyawan]
        OFF2 -->|No| OFF4[/"❌ Tidak ditemukan (offline)"/]
        OFF3 --> OFF5[Capture Foto]
        OFF5 --> OFF6[Simpan ke\nIndexedDB Queue]
        OFF6 --> OFF7[/"✅ Check-In Tersimpan\n(Offline)"/]
    end
    
    OFF7 --> Sync[/"⏳ Auto-sync saat online"/]
    
    style OnlineFlow fill:#1e3a5f,stroke:#60a5fa
    style OfflineFlow fill:#78350f,stroke:#fbbf24
```

### Data Storage - Kiosk

```mermaid
flowchart LR
    subgraph IndexedDB["📦 IndexedDB (kiosk_offline_db)"]
        EMP["employees\n(All office employees)"]
        ATT["attendance_queue\n(Pending records)"]
        SET["settings\n(last_sync_time, etc)"]
    end
    
    subgraph LocalStorage["💾 LocalStorage"]
        KID["kiosk_id"]
        PIN["admin_pin (temp)"]
    end
```

### Sync Flow - Kiosk

```mermaid
sequenceDiagram
    participant Kiosk as Kiosk Web
    participant IDB as IndexedDB
    participant API as Server API
    participant DB as PostgreSQL
    
    Note over Kiosk: Setiap 30 menit (atau saat online)...
    
    rect rgb(30, 58, 95)
        Note over Kiosk,API: 1. Download Employee Data
        Kiosk->>API: GET /api/kiosk/sync-data?kiosk_id=xxx
        API->>DB: SELECT employees WHERE office_id = ...
        DB-->>API: [Employee data + embeddings]
        API-->>Kiosk: {employees: [...], last_sync_time: ...}
        Kiosk->>IDB: cacheEmployees(employees)
    end
    
    rect rgb(120, 53, 15)
        Note over Kiosk,API: 2. Upload Pending Attendance
        Kiosk->>IDB: getPendingAttendance()
        IDB-->>Kiosk: [{record1}, {record2}, ...]
        Kiosk->>API: POST /api/kiosk/offline-sync
        API->>DB: INSERT attendance records
        DB-->>API: Success
        API-->>Kiosk: {synced: 5, errors: []}
        Kiosk->>IDB: clearSyncedAttendance()
    end
```

---

## 3️⃣ Admin Dashboard

### Kapabilitas Offline

| Fitur | Online | Offline |
|-------|--------|---------|
| **Login** | ✅ Server Auth | ❌ Tidak bisa |
| **View Dashboard** | ✅ Real-time | ❌ Tidak bisa |
| **Manage Users** | ✅ CRUD | ❌ Tidak bisa |
| **View Reports** | ✅ Query DB | ❌ Tidak bisa |
| **Settings** | ✅ API Server | ❌ Tidak bisa |

> [!WARNING]
> **Admin Dashboard tidak memiliki mode offline** karena semua operasi memerlukan data real-time dari server dan memiliki implikasi keamanan yang tinggi.

### Flow Diagram - Admin Dashboard

```mermaid
flowchart TD
    Start([Admin Login]) --> Auth["POST /api/auth/login"]
    Auth -->|Success| Dashboard
    Auth -->|Fail| ErrLogin[/"❌ Login Failed"/]
    
    subgraph Dashboard["📊 Dashboard (Online Only)"]
        D1["GET /api/admin/dashboard/stats"]
        D2["WebSocket: Real-time updates"]
        D3["GET /api/admin/attendance/today"]
        
        D1 --> View[Tampilkan Statistik]
        D2 --> View
        D3 --> View
    end
    
    Dashboard -->|Network Error| Offline[/"⚠️ Koneksi Terputus\nData tidak dapat dimuat"/]
    
    style Dashboard fill:#4c1d95,stroke:#a78bfa
    style Offline fill:#7f1d1d,stroke:#ef4444
```

---

## 📱 Perbandingan Platform

| Fitur | 📱 Mobile | 🖥️ Kiosk | 💻 Admin |
|-------|----------|---------|---------|
| **Offline Login** | ✅ Ya (7 hari) | N/A (pairing) | ❌ Tidak |
| **Offline Check-In** | ✅ Ya | ✅ Ya | ❌ Tidak |
| **Face Verify Offline** | ✅ TFLite | ⚠️ Simplified | ❌ Tidak |
| **Data Sync** | ✅ Auto | ✅ 30 menit | ❌ Tidak |
| **Credential Storage** | SecureStore | - | - |
| **Data Storage** | AsyncStorage | IndexedDB | LocalStorage |

```mermaid
flowchart TB
    subgraph Comparison["Perbandingan Kapabilitas Offline"]
        direction LR
        
        subgraph Mobile["📱 Mobile"]
            M1["✅ Login Offline"]
            M2["✅ Check-In Offline"]
            M3["✅ Face Verify TFLite"]
            M4["✅ Auto Sync"]
        end
        
        subgraph Kiosk["🖥️ Kiosk"]
            K1["N/A Login (Pairing)"]
            K2["✅ Check-In Offline"]
            K3["⚠️ Face Verify Simplified"]
            K4["✅ Auto Sync 30min"]
        end
        
        subgraph Admin["💻 Admin"]
            A1["❌ Online Only"]
            A2["❌ Online Only"]
            A3["❌ Online Only"]
            A4["❌ Online Only"]
        end
    end
    
    style Mobile fill:#064e3b,stroke:#34d399,color:#fff
    style Kiosk fill:#7c2d12,stroke:#fb923c,color:#fff
    style Admin fill:#7f1d1d,stroke:#ef4444,color:#fff
```

---

## 🔄 Data Flow Summary

```mermaid
flowchart TB
    subgraph Server["☁️ Cloud Server"]
        API["Go Backend"]
        DB[(PostgreSQL)]
        Face["Face Service"]
    end
    
    subgraph Mobile["📱 Mobile App"]
        MApp["React Native"]
        MCache[(AsyncStorage)]
        MSec[(SecureStore)]
        MTF["TFLite Model"]
    end
    
    subgraph Kiosk["🖥️ Kiosk"]
        KApp["React Web"]
        KCache[(IndexedDB)]
    end
    
    subgraph Admin["💻 Admin"]
        AApp["React Web"]
    end
    
    %% Online connections
    MApp <-->|"Online"| API
    KApp <-->|"Online"| API
    AApp <-->|"Online Only"| API
    
    %% Offline paths
    MApp <-->|"Offline Login"| MSec
    MApp <-->|"Offline Data"| MCache
    MApp -->|"Offline Inference"| MTF
    KApp <-->|"Offline Read/Write"| KCache
    
    %% Server internal
    API <--> DB
    API <--> Face
    
    style Server fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style Mobile fill:#064e3b,stroke:#34d399,color:#fff
    style Kiosk fill:#7c2d12,stroke:#fb923c,color:#fff
    style Admin fill:#4c1d95,stroke:#a78bfa,color:#fff
```

---

## 📋 Checklist Prasyarat Offline

### Mobile App
- [x] User harus login online minimal 1x (untuk cache credentials & embeddings)
- [x] Face embeddings tersimpan di AsyncStorage
- [x] Credentials tersimpan di SecureStore (encrypted)
- [x] TFLite model bundled dalam APK
- [x] GPS berfungsi tanpa internet
- [x] Offline login valid 7 hari

### Kiosk
- [x] Kiosk sudah di-pair dengan office
- [x] Sync data employee minimal 1x
- [x] IndexedDB tersedia di browser
- [ ] (Optional) Local Face Service running

### Admin Dashboard
- [ ] Tidak ada mode offline
- [ ] Semua operasi memerlukan koneksi internet

---

## 🔐 Security Considerations

### Mobile Offline Login

| Aspek | Implementasi |
|-------|--------------|
| **Password Storage** | SHA-256 hash dengan random salt |
| **Token Security** | Tidak ada JWT di offline mode |
| **Validity Period** | Maksimal 7 hari tanpa online |
| **Storage Location** | Expo SecureStore (OS-level encryption) |
| **Logout Behavior** | Clear semua cached credentials |

### Kiosk Offline Mode

| Aspek | Implementasi |
|-------|--------------|
| **Admin Code** | Required untuk sync data |
| **Data Scope** | Hanya employee dari 1 office |
| **Face Data** | Disimpan di IndexedDB (browser) |
| **Sync Security** | Admin code verified per request |

---

## 🚨 Error Handling

| Skenario | Mobile | Kiosk | Admin |
|----------|--------|-------|-------|
| Network timeout | Fallback offline login | Fallback offline | Show error |
| Server 500 | Retry + queue | Retry + queue | Show error |
| No cached data | Cannot check-in | Cannot check-in | N/A |
| Expired credentials | Prompt online login | N/A | N/A |
| Corrupted cache | Clear + re-login | Clear + re-sync | N/A |
| Sync conflict | Server data wins | Server data wins | N/A |
