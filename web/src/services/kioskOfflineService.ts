// Kiosk Offline Service
// Handles local data caching and offline attendance queue using IndexedDB

const DB_NAME = 'kiosk_offline_db';
const DB_VERSION = 1;
const STORES = {
    EMPLOYEES: 'employees',
    ATTENDANCE_QUEUE: 'attendance_queue',
    SETTINGS: 'settings',
};

let db: IDBDatabase | null = null;

// ========== Database Setup ==========

export async function initOfflineDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[OfflineDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('[OfflineDB] Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Employees store (keyed by employee_id)
            if (!database.objectStoreNames.contains(STORES.EMPLOYEES)) {
                const employeeStore = database.createObjectStore(STORES.EMPLOYEES, { keyPath: 'employee_id' });
                employeeStore.createIndex('id', 'id', { unique: true });
                employeeStore.createIndex('name', 'name', { unique: false });
            }

            // Attendance queue store
            if (!database.objectStoreNames.contains(STORES.ATTENDANCE_QUEUE)) {
                const queueStore = database.createObjectStore(STORES.ATTENDANCE_QUEUE, { keyPath: 'id', autoIncrement: true });
                queueStore.createIndex('employee_id', 'employee_id', { unique: false });
                queueStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Settings store
            if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
        };
    });
}

// ========== Employee Data ==========

export interface EmployeeData {
    id: string;
    employee_id: string;
    name: string;
    face_embeddings: number[][];
    is_active: boolean;
}

export async function cacheEmployees(employees: EmployeeData[]): Promise<void> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.EMPLOYEES, 'readwrite');
    const store = transaction.objectStore(STORES.EMPLOYEES);

    // Clear existing data
    store.clear();

    // Add new data
    for (const emp of employees) {
        store.put(emp);
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            console.log(`[OfflineDB] Cached ${employees.length} employees`);
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getEmployee(employeeId: string): Promise<EmployeeData | null> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.EMPLOYEES, 'readonly');
    const store = transaction.objectStore(STORES.EMPLOYEES);

    return new Promise((resolve, reject) => {
        const request = store.get(employeeId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllEmployees(): Promise<EmployeeData[]> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.EMPLOYEES, 'readonly');
    const store = transaction.objectStore(STORES.EMPLOYEES);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function getEmployeeCount(): Promise<number> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.EMPLOYEES, 'readonly');
    const store = transaction.objectStore(STORES.EMPLOYEES);

    return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ========== Attendance Queue ==========

export interface AttendanceRecord {
    id?: number;
    employee_id: string;
    type: 'check-in' | 'check-out';
    timestamp: string;
    confidence: number;
    synced?: boolean;
}

export async function queueAttendance(record: Omit<AttendanceRecord, 'id'>): Promise<number> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);

    return new Promise((resolve, reject) => {
        const request = store.add({ ...record, synced: false });
        request.onsuccess = () => {
            console.log('[OfflineDB] Attendance queued:', request.result);
            resolve(request.result as number);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getPendingAttendance(): Promise<AttendanceRecord[]> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const results = (request.result || []).filter((r: AttendanceRecord) => !r.synced);
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function markAttendanceSynced(ids: number[]): Promise<void> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);

    for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
            const record = request.result;
            if (record) {
                record.synced = true;
                store.put(record);
            }
        };
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function clearSyncedAttendance(): Promise<void> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.ATTENDANCE_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.ATTENDANCE_QUEUE);

    return new Promise((resolve, reject) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (cursor.value.synced) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// ========== Settings ==========

export async function setSetting(key: string, value: string): Promise<void> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.SETTINGS, 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);

    return new Promise((resolve, reject) => {
        const request = store.put({ key, value });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getSetting(key: string): Promise<string | null> {
    const database = await initOfflineDB();
    const transaction = database.transaction(STORES.SETTINGS, 'readonly');
    const store = transaction.objectStore(STORES.SETTINGS);

    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.value || null);
        request.onerror = () => reject(request.error);
    });
}

// ========== Sync Utilities ==========

export async function getLastSyncTime(): Promise<string | null> {
    return getSetting('last_sync_time');
}

export async function setLastSyncTime(time: string): Promise<void> {
    return setSetting('last_sync_time', time);
}

export async function isOfflineDataAvailable(): Promise<boolean> {
    const count = await getEmployeeCount();
    return count > 0;
}

// ========== Face Comparison (Local) ==========

export function euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return 999;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

export interface FaceMatchResult {
    isMatch: boolean;
    distance: number;
    similarity: number;
    confidence: number;
}

export function compareFaceEmbeddings(
    testEmbedding: number[],
    storedEmbeddings: number[][],
    threshold = 0.6
): FaceMatchResult {
    if (!storedEmbeddings || storedEmbeddings.length === 0) {
        return { isMatch: false, distance: 999, similarity: 0, confidence: 0 };
    }

    let minDistance = Infinity;
    let maxSimilarity = -1;

    for (const stored of storedEmbeddings) {
        const dist = euclideanDistance(testEmbedding, stored);
        const sim = cosineSimilarity(testEmbedding, stored);

        if (dist < minDistance) minDistance = dist;
        if (sim > maxSimilarity) maxSimilarity = sim;
    }

    const isMatch = minDistance < threshold && maxSimilarity > 0.5;
    const confidence = Math.max(0, Math.min(1, (1 - minDistance / 2 + maxSimilarity) / 2));

    return {
        isMatch,
        distance: minDistance,
        similarity: maxSimilarity,
        confidence,
    };
}
