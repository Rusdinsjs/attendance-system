// useKioskOffline Hook
// Manages offline data sync and status for Kiosk

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    initOfflineDB,
    cacheEmployees,
    getEmployee,
    getAllEmployees,
    queueAttendance,
    getPendingAttendance,
    clearSyncedAttendance,
    getLastSyncTime,
    setLastSyncTime,
    isOfflineDataAvailable,
    compareFaceEmbeddings,
} from '../services/kioskOfflineService';
import type { EmployeeData, AttendanceRecord, FaceMatchResult } from '../services/kioskOfflineService';
import { kioskAPI } from '../api/client';

const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
const ONLINE_CHECK_INTERVAL = 10 * 1000; // 10 seconds

interface UseKioskOfflineOptions {
    kioskId: string;
    adminCode: string;
    autoSync?: boolean;
}

export function useKioskOffline({ kioskId, adminCode, autoSync = true }: UseKioskOfflineOptions) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isOfflineReady, setIsOfflineReady] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTimeState] = useState<string | null>(null);
    const [employeeCount, setEmployeeCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncError, setSyncError] = useState<string | null>(null);

    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize offline database
    useEffect(() => {
        async function init() {
            try {
                await initOfflineDB();
                const available = await isOfflineDataAvailable();
                setIsOfflineReady(available);

                if (available) {
                    const employees = await getAllEmployees();
                    setEmployeeCount(employees.length);
                }

                const lastSync = await getLastSyncTime();
                setLastSyncTimeState(lastSync);

                const pending = await getPendingAttendance();
                setPendingCount(pending.length);
            } catch (error) {
                console.error('[KioskOffline] Init error:', error);
            }
        }
        init();
    }, []);

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Also check periodically
        const checkInterval = setInterval(() => {
            setIsOnline(navigator.onLine);
        }, ONLINE_CHECK_INTERVAL);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(checkInterval);
        };
    }, []);

    // Sync employee data from server
    const syncEmployeeData = useCallback(async (): Promise<boolean> => {
        if (!isOnline || !kioskId || !adminCode) {
            return false;
        }

        setIsSyncing(true);
        setSyncError(null);

        try {
            const response = await kioskAPI.syncData(kioskId, adminCode);
            const { employees, last_sync_time } = response.data;

            // Transform and cache employees
            const employeeData: EmployeeData[] = employees.map((emp: any) => ({
                id: emp.id,
                employee_id: emp.employee_id,
                name: emp.name,
                face_embeddings: emp.face_embeddings || [],
                is_active: emp.is_active,
            }));

            await cacheEmployees(employeeData);
            await setLastSyncTime(last_sync_time);

            setEmployeeCount(employeeData.length);
            setLastSyncTimeState(last_sync_time);
            setIsOfflineReady(true);

            console.log(`[KioskOffline] Synced ${employeeData.length} employees`);
            return true;
        } catch (error: any) {
            console.error('[KioskOffline] Sync error:', error);
            setSyncError(error.message || 'Sync failed');
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, kioskId, adminCode]);

    // Sync pending attendance to server
    const syncPendingAttendance = useCallback(async (): Promise<{ synced: number; errors: string[] }> => {
        if (!isOnline || !kioskId || !adminCode) {
            return { synced: 0, errors: ['Offline'] };
        }

        const pending = await getPendingAttendance();
        if (pending.length === 0) {
            return { synced: 0, errors: [] };
        }

        try {
            const response = await kioskAPI.offlineSync(kioskId, adminCode, pending);
            const { synced, errors } = response.data;

            if (synced > 0) {
                await clearSyncedAttendance();
                const remaining = await getPendingAttendance();
                setPendingCount(remaining.length);
            }

            return { synced, errors };
        } catch (error: any) {
            return { synced: 0, errors: [error.message || 'Sync failed'] };
        }
    }, [isOnline, kioskId, adminCode]);

    // Full sync (employee data + pending attendance)
    const fullSync = useCallback(async () => {
        const employeeSuccess = await syncEmployeeData();
        const { synced } = await syncPendingAttendance();
        return { employeeSuccess, attendanceSynced: synced };
    }, [syncEmployeeData, syncPendingAttendance]);

    // Auto-sync on interval
    useEffect(() => {
        if (!autoSync || !kioskId || !adminCode) return;

        // Initial sync
        if (isOnline) {
            fullSync();
        }

        // Periodic sync
        syncIntervalRef.current = setInterval(() => {
            if (isOnline) {
                fullSync();
            }
        }, SYNC_INTERVAL);

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [autoSync, isOnline, kioskId, adminCode, fullSync]);

    // Lookup employee locally
    const lookupEmployee = useCallback(async (employeeId: string): Promise<EmployeeData | null> => {
        return getEmployee(employeeId);
    }, []);

    // Verify face locally
    const verifyFaceLocally = useCallback(async (
        employeeId: string,
        faceEmbedding: number[]
    ): Promise<FaceMatchResult> => {
        const employee = await getEmployee(employeeId);

        if (!employee || !employee.face_embeddings || employee.face_embeddings.length === 0) {
            return { isMatch: false, distance: 999, similarity: 0, confidence: 0 };
        }

        return compareFaceEmbeddings(faceEmbedding, employee.face_embeddings);
    }, []);

    // Queue offline attendance
    const recordOfflineAttendance = useCallback(async (
        employeeId: string,
        type: 'check-in' | 'check-out',
        confidence: number
    ): Promise<number> => {
        const record: Omit<AttendanceRecord, 'id'> = {
            employee_id: employeeId,
            type,
            timestamp: new Date().toISOString(),
            confidence,
        };

        const id = await queueAttendance(record);
        const pending = await getPendingAttendance();
        setPendingCount(pending.length);

        return id;
    }, []);

    return {
        // Status
        isOnline,
        isOfflineReady,
        isSyncing,
        lastSyncTime,
        employeeCount,
        pendingCount,
        syncError,

        // Actions
        syncEmployeeData,
        syncPendingAttendance,
        fullSync,
        lookupEmployee,
        verifyFaceLocally,
        recordOfflineAttendance,
    };
}

export default useKioskOffline;
