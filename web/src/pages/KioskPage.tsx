import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import {
    Clock, MapPin, Scan, CheckCircle2, XCircle,
    Settings, ShieldCheck, ChevronRight, RefreshCw, LogIn, LogOut, UserPlus, Camera,
    Wifi, WifiOff, AlertCircle
} from 'lucide-react';
import { useKioskOffline } from '../hooks/useKioskOffline';
import * as faceapi from 'face-api.js';
import { compareFaceEmbeddings } from '../services/kioskOfflineService';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || '';

interface Employee {
    id: string;
    employee_id: string;
    name: string;
    today_status: 'checked_in' | 'checked_out' | null;
    has_face_data: boolean;
}

interface RegistrationEmployee {
    id: string;
    employee_id: string;
    name: string;
}

interface Kiosk {
    id: string;
    kiosk_id: string;
    name: string;
    office: string;
}

const KioskPage: React.FC = () => {
    const navigate = useNavigate();
    // Kiosk State
    const [step, setStep] = useState<'scan' | 'verify' | 'success' | 'error'>('scan');
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [message, setMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [autoResetTimer, setAutoResetTimer] = useState(5);
    const [manualId, setManualId] = useState('');
    const [cameraError, setCameraError] = useState(false);

    // Setup & Admin State
    const [showSetup, setShowSetup] = useState(false);
    const [setupMode, setSetupMode] = useState<'menu' | 'pair' | 'register'>('menu');
    const [adminPIN, setAdminPIN] = useState('');
    const [setupStep, setSetupStep] = useState(1);
    const [availableKiosks, setAvailableKiosks] = useState<Kiosk[]>([]);
    const [kioskId, setKioskId] = useState(localStorage.getItem('kiosk_id') || '');

    // Face Registration State
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [registerStep, setRegisterStep] = useState(1);
    const [employeeList, setEmployeeList] = useState<RegistrationEmployee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<RegistrationEmployee | null>(null);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Screensaver State
    const [isScreensaverActive, setIsScreensaverActive] = useState(false);
    const [, setIdleTime] = useState(0);

    const webcamRef = useRef<Webcam>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Company Settings
    const [companySettings, setCompanySettings] = useState({
        name: 'Loading...',
        logo: '',
        address: '',
        screensaverTimeout: 60
    });

    // Offline Mode Hook
    const {
        isOnline,
        isOfflineReady,
        isSyncing,
        pendingCount,
        lookupEmployee,
        recordOfflineAttendance,
    } = useKioskOffline({
        kioskId: kioskId || '',
        adminCode: adminPIN || '123456',
        autoSync: true,
    });

    // Load face-api models (using tiny models for faster detection)
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = '/models';
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                console.log('Face-api models loaded (tiny detector)');
            } catch (err) {
                console.error('Failed to load face-api models', err);
            }
        };
        loadModels();
    }, []);

    // Fetch Settings & WebSocket
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch(`${API_URL}/api/kiosk/company-settings`);
                if (response.ok) {
                    const data = await response.json();
                    setCompanySettings(prev => ({
                        ...prev,
                        name: data.company_name || 'PT Teknologi Maju',
                        logo: data.company_logo ? `${API_URL}${data.company_logo}` : '',
                        address: data.company_address || 'Menara BNI 46, Jakarta Pusat',
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            }
        };

        fetchSettings();

        // WebSocket for realtime updates
        let ws: WebSocket | null = null;
        let reconnectTimer: any = null;

        const connectWs = () => {
            // Replace http/https with ws/wss
            const wsBaseUrl = API_URL.replace(/^http/, 'ws');
            const wsUrl = `${wsBaseUrl}/ws/dashboard?type=kiosk`; // Reusing dashboard endpoint for simplicity

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('Kiosk WS Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Handle settings update
                    if (data.type === 'settings:updated') {
                        console.log('Settings updated, refetching...');
                        fetchSettings();
                    }
                    // Handle attendance events (optional: show toast?)
                } catch (e) {
                    console.error('WS Parse error', e);
                }
            };

            ws.onclose = () => {
                console.log('Kiosk WS Disconnected, retrying in 5s...');
                reconnectTimer = setTimeout(connectWs, 5000);
            };
        };

        connectWs();

        return () => {
            if (ws) ws.close();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, []);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleQRScan = useCallback(async (employeeId: string) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            // OFFLINE MODE: Use local IndexedDB lookup
            if (!isOnline && isOfflineReady) {
                console.log('[Kiosk] Offline mode - looking up employee locally');
                const offlineEmployee = await lookupEmployee(employeeId);

                if (!offlineEmployee) {
                    setErrorMsg('Karyawan tidak ditemukan (offline mode)');
                    setStep('error');
                    return;
                }

                const hasFaceData = offlineEmployee.face_embeddings && offlineEmployee.face_embeddings.length > 0;

                setEmployee({
                    id: offlineEmployee.id,
                    employee_id: offlineEmployee.employee_id,
                    name: offlineEmployee.name,
                    has_face_data: hasFaceData,
                    today_status: null, // Unknown in offline mode
                });

                if (!hasFaceData) {
                    setErrorMsg('Wajah belum terdaftar. Silakan hubungi Admin.');
                    setStep('error');
                    return;
                }

                if (scannerRef.current) {
                    await scannerRef.current.stop();
                    scannerRef.current = null;
                }
                setStep('verify');
                return;
            }

            // ONLINE MODE: Use server API
            const apiUrl = `${API_URL}/api/kiosk/scan`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrorMsg(data.error || 'Karyawan tidak ditemukan');
                setStep('error');
                return;
            }

            // Map response to Employee interface
            const employeeData: Employee = {
                id: data.id || '',
                employee_id: data.employee_id,
                name: data.name,
                has_face_data: data.has_face_data,
                today_status: data.today_status,
            };

            // VALIDATION: Prevent action if already checked out
            if (employeeData.today_status === 'checked_out') {
                setErrorMsg('Anda sudah Check-Out hari ini.');
                setStep('error');
                return;
            }

            setEmployee(employeeData);

            if (!data.has_face_data) {
                setErrorMsg('Anda belum mendaftarkan wajah. Silakan hubungi Admin.');
                setStep('error');
                return;
            }

            if (scannerRef.current) {
                await scannerRef.current.stop();
                scannerRef.current = null;
            }
            setStep('verify');
        } catch (error: any) {
            const errMsg = error?.message || String(error);
            console.error('[Kiosk] Scan error:', error);

            // If network error and offline ready, try offline mode
            if (isOfflineReady) {
                console.log('[Kiosk] Network error - falling back to offline mode');
                const offlineEmployee = await lookupEmployee(employeeId);

                if (offlineEmployee) {
                    const hasFaceData = offlineEmployee.face_embeddings && offlineEmployee.face_embeddings.length > 0;
                    setEmployee({
                        id: offlineEmployee.id,
                        employee_id: offlineEmployee.employee_id,
                        name: offlineEmployee.name,
                        has_face_data: hasFaceData,
                        today_status: null,
                    });

                    if (hasFaceData) {
                        if (scannerRef.current) {
                            await scannerRef.current.stop();
                            scannerRef.current = null;
                        }
                        setStep('verify');
                        return;
                    }
                }
            }
            setErrorMsg(`Gagal terhubung ke server: ${errMsg}`);
            setStep('error');
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, isOnline, isOfflineReady, lookupEmployee]);

    // Initialize QR Scanner
    useEffect(() => {


        if (step === 'scan' && !showSetup && !cameraError) {
            // Check permissions first
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => setCameraError(false))
                .catch(() => setCameraError(true));

            if (scannerRef.current) return;

            const scanner = new Html5Qrcode("qr-reader");
            scannerRef.current = scanner;

            scanner.start(
                { facingMode: "user" },
                {
                    fps: 10,
                    qrbox: { width: 300, height: 300 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    handleQRScan(decodedText);
                },
                () => {
                    // Ignore per-frame errors
                }
            ).then(() => {
                // Scanner started
            }).catch((err) => {
                console.error("Error starting scanner", err);
                setCameraError(true);
                scannerRef.current = null;
            });
        }

        return () => {
            const currentScanner = scannerRef.current;
            if (currentScanner) {
                scannerRef.current = null;
                // Only try to stop if scanner exists
                try {
                    currentScanner.stop().then(() => {
                        try {
                            currentScanner.clear();
                        } catch (e) {
                            // Ignore clear errors
                        }
                    }).catch(() => {
                        // Scanner was not running, that's fine
                    });
                } catch (e) {
                    // Ignore any synchronous errors
                }
            }
        };
    }, [step, showSetup, cameraError, handleQRScan]);

    // Idle/Screensaver logic
    useEffect(() => {
        if (step !== 'scan' || showSetup) {
            setIdleTime(0);
            setIsScreensaverActive(false);
            return;
        }

        const interval = setInterval(() => {
            setIdleTime(prev => {
                if (prev + 1 >= companySettings.screensaverTimeout) {
                    setIsScreensaverActive(true);
                    return prev + 1;
                }
                return prev + 1;
            });
        }, 1000);

        const resetIdle = () => {
            setIdleTime(0);
            setIsScreensaverActive(false);
        };

        window.addEventListener('mousemove', resetIdle);
        window.addEventListener('mousedown', resetIdle);
        window.addEventListener('keypress', resetIdle);
        window.addEventListener('touchstart', resetIdle);

        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', resetIdle);
            window.removeEventListener('mousedown', resetIdle);
            window.removeEventListener('keypress', resetIdle);
            window.removeEventListener('touchstart', resetIdle);
        };
    }, [step, showSetup, companySettings.screensaverTimeout]);

    // Auto reset
    useEffect(() => {
        if (step === 'success' || step === 'error') {
            const countdown = setInterval(() => {
                setAutoResetTimer((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdown);
                        resetKiosk();
                        return 5;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(countdown);
        }
    }, [step]);



    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualId.trim()) {
            handleQRScan(manualId.trim().toUpperCase());
        }
    };

    const handleCheckPIN = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            // Verify PIN first (reusing available endpoint for verification)
            // Ideally we should have a dedicated /verify-pin endpoint, but /available works for check
            const response = await fetch(`${API_URL}/api/kiosk/available?code=${adminPIN}`);

            if (!response.ok) {
                alert('PIN Salah');
                return;
            }

            if (setupMode === 'register') {
                // Fetch Employees for Registration
                const empResponse = await fetch(`${API_URL}/api/kiosk/employees-for-registration?code=${adminPIN}`); // Re-send code strictly
                if (empResponse.ok) {
                    let data = await empResponse.json();
                    if (!data) data = [];
                    setEmployeeList(data);
                    setIsRegisterMode(true);
                    setRegisterStep(1);
                } else {
                    alert('Gagal memuat data karyawan');
                }
            } else if (setupMode === 'pair') {
                // Fetch Available Kiosks
                let data = await response.json();
                if (!data) data = [];
                setAvailableKiosks(data);
                setSetupStep(2); // Move to Kiosk Selection
            } else if (setupMode === 'menu') {
                // Just unlocking settings/setup menu is handled by showSetup state, but here we might be checking PIN for specific actions
            }
        } catch (error) {
            console.error(error);
            alert('Gagal terhubung ke server');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePairing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kioskId || !adminPIN) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${API_URL}/api/kiosk/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kiosk_id: kioskId, admin_code: adminPIN }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Gagal pairing device');
                return;
            }

            localStorage.setItem('kiosk_id', kioskId);
            setShowSetup(false);
            setAdminPIN('');
            setSetupStep(1);
            alert('Perangkat berhasil dipasangkan!');
            // Reload to fetch settings
            window.location.reload();
        } catch (error) {
            alert('Gagal terhubung ke server');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCapturePhoto = () => {
        if (capturedPhotos.length >= 5) return;
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedPhotos([...capturedPhotos, imageSrc]);
        }
    };

    const handleRegisterFace = async () => {
        if (!selectedEmployee || capturedPhotos.length < 5) return;
        setIsProcessing(true);

        try {
            const formData = new FormData();
            formData.append('admin_code', adminPIN);
            formData.append('employee_id', selectedEmployee.employee_id);

            // Convert base64 to blob
            for (let i = 0; i < capturedPhotos.length; i++) {
                const fetchRes = await fetch(capturedPhotos[i]);
                const blob = await fetchRes.blob();
                formData.append('photos', blob, `photo${i}.jpg`);
            }

            const response = await fetch(`${API_URL}/api/kiosk/register-face`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Gagal meregistrasi wajah');
            }

            alert('Registrasi wajah berhasil! Status karyawan kini Approved.');
            resetRegistration();
            setShowSetup(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Terjadi kesalahan');
        } finally {
            setIsProcessing(false);
        }
    };

    const resetRegistration = () => {
        setIsRegisterMode(false);
        setSetupMode('menu'); // Reset to menu
        setAdminPIN('');      // Clear PIN
        setRegisterStep(1);
        setEmployeeList([]);
        setSelectedEmployee(null);
        setCapturedPhotos([]);
        setSearchTerm('');
    };

    const captureAndVerify = useCallback(async () => {
        if (!webcamRef.current || !employee || isProcessing) return;
        setIsProcessing(true);
        setMessage('Memverifikasi wajah...');

        try {
            const action = employee.today_status === 'checked_in' ? 'check-out' : 'check-in';

            // OFFLINE MODE: Use local face verification and queue attendance
            if (!isOnline && isOfflineReady) {
                console.log('[Kiosk] Offline mode - verifying face locally');

                // Get employee embeddings from IndexedDB
                const offlineEmployee = await lookupEmployee(employee.employee_id);
                if (!offlineEmployee || !offlineEmployee.face_embeddings?.length) {
                    setErrorMsg('Data wajah tidak tersedia (offline)');
                    setStep('error');
                    return;
                }

                // Verify face with face-api.js
                const imageSrc = webcamRef.current.getScreenshot();
                if (!imageSrc) {
                    setErrorMsg('Gagal mengambil foto');
                    setStep('error');
                    return;
                }

                try {
                    // Create an HTMLImageElement from base64
                    const img = document.createElement('img');
                    img.src = imageSrc;

                    // Detect face and compute embedding using TinyFaceDetector (faster)
                    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
                    const detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks(true).withFaceDescriptor();

                    if (!detection) {
                        setErrorMsg('Wajah tidak terdeteksi (Offline)');
                        setStep('error');
                        return;
                    }

                    const probeEmbedding = Array.from(detection.descriptor) as number[];
                    const matchResult = compareFaceEmbeddings(probeEmbedding, offlineEmployee.face_embeddings);

                    if (!matchResult.isMatch) {
                        setErrorMsg('Wajah tidak cocok (Offline)');
                        setStep('error');
                        return;
                    }

                    // Success!
                    await recordOfflineAttendance(
                        employee.employee_id,
                        action as 'check-in' | 'check-out',
                        matchResult.confidence
                    );

                    setMessage(action === 'check-in'
                        ? 'Check-in tersimpan (offline)'
                        : 'Check-out tersimpan (offline)');
                    setStep('success');
                    return;

                } catch (offlineErr) {
                    console.error('Offline verification failed:', offlineErr);
                    setErrorMsg('Gagal verifikasi offline');
                    setStep('error');
                    return;
                }
            }

            // ONLINE MODE: Capture webcam image and verify face first
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) {
                setErrorMsg('Gagal mengambil foto dari kamera');
                setStep('error');
                return;
            }

            // Step 1: Verify face with server
            setMessage('Memverifikasi wajah...');
            const verifyResponse = await fetch(`${API_URL}/api/kiosk/verify-face-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.employee_id,
                    image_base64: imageSrc,
                }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
                setErrorMsg(verifyData.error || verifyData.message || 'Verifikasi wajah gagal');
                setStep('error');
                return;
            }

            // Face verified! Now proceed with check-in/out
            setMessage('Wajah terverifikasi. Menyimpan absensi...');

            const attendanceResponse = await fetch(`${API_URL}/api/kiosk/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.employee_id,
                    kiosk_id: kioskId,
                }),
            });

            const attendanceData = await attendanceResponse.json();

            if (!attendanceResponse.ok) {
                setErrorMsg(attendanceData.error || 'Gagal melakukan absensi');
                setStep('error');
                return;
            }

            setMessage(attendanceData.message);
            setStep('success');
        } catch (error) {
            // If network error and offline ready, try offline mode
            if (isOfflineReady && employee) {
                console.log('[Kiosk] Network error - recording attendance offline');
                const action = employee.today_status === 'checked_in' ? 'check-out' : 'check-in';

                await recordOfflineAttendance(
                    employee.employee_id,
                    action as 'check-in' | 'check-out',
                    0.8 // Fallback confidence
                );

                setMessage(action === 'check-in'
                    ? 'Check-in tersimpan (offline)'
                    : 'Check-out tersimpan (offline)');
                setStep('success');
                return;
            }
            setErrorMsg('Gagal terhubung ke server');
            setStep('error');
        } finally {
            setIsProcessing(false);
        }
    }, [employee, isProcessing, kioskId, isOnline, isOfflineReady, lookupEmployee, recordOfflineAttendance]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', { hour12: false });
    };

    const resetKiosk = () => {
        setStep('scan');
        setEmployee(null);
        setMessage('');
        setErrorMsg('');
        setAutoResetTimer(5);
        setIsProcessing(false);
        setManualId('');
    };

    return (
        <div className="min-h-screen bg-slate-900 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white overflow-y-auto relative font-sans selection:bg-cyan-500/30">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
            </div>

            {/* Offline Status Indicator */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                {isOnline ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full backdrop-blur-sm">
                        <Wifi size={14} className="text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-300">Online</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full backdrop-blur-sm">
                        <WifiOff size={14} className="text-amber-400" />
                        <span className="text-xs font-medium text-amber-300">
                            Offline {pendingCount > 0 && `(${pendingCount})`}
                        </span>
                    </div>
                )}
                {isSyncing && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full">
                        <RefreshCw size={12} className="text-cyan-400 animate-spin" />
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="relative z-10 flex flex-col items-center justify-center pt-12 pb-6">
                <div className="flex items-center gap-4 mb-4 opacity-90 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg shadow-cyan-500/10">
                        {companySettings.logo ? (
                            <img src={companySettings.logo} alt="Logo" className="w-10 h-10 object-contain" />
                        ) : (
                            <Clock size={32} className="text-cyan-400" />
                        )}
                    </div>
                    <div className="text-left">
                        <h1 className="text-xl font-bold tracking-wide text-white">{companySettings.name}</h1>
                        <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">{companySettings.address}</p>
                    </div>
                </div>

                <div className="text-[5rem] font-light leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 font-mono">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-3xl text-slate-500 ml-2 animate-pulse">: {currentTime.getSeconds().toString().padStart(2, '0')}</span>
                </div>
                <p className="text-slate-400 text-lg mt-2 font-medium tracking-wide">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Main Content Card */}
            <div className="relative z-10 flex-1 flex items-center justify-center p-6 pb-32">
                <div className="w-full max-w-lg">

                    {step === 'scan' && (
                        <div className="glass-card bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                                    Scan QR Code
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    Arahkan kode QR karyawan ke kamera
                                </p>
                            </div>

                            {!cameraError && (
                                <div className="relative w-full max-w-sm aspect-square mx-auto mb-8 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black/50 shadow-inner group">
                                    <div id="qr-reader" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />

                                    {/* Scanning Animation Overlay */}
                                    {/* Scanning Animation Overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-[scan_2s_ease-in-out_infinite] z-10" />

                                        {/* Corner Brackets */}
                                        <div className="absolute top-6 left-6 w-12 h-12 border-t-[4px] border-l-[4px] border-cyan-400 rounded-tl-2xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                                        <div className="absolute top-6 right-6 w-12 h-12 border-t-[4px] border-r-[4px] border-cyan-400 rounded-tr-2xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                                        <div className="absolute bottom-6 left-6 w-12 h-12 border-b-[4px] border-l-[4px] border-cyan-400 rounded-bl-2xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                                        <div className="absolute bottom-6 right-6 w-12 h-12 border-b-[4px] border-r-[4px] border-cyan-400 rounded-br-2xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />

                                        {/* Subtle Vignette (Optional, weighted to edges essentially invisible in center) */}
                                        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.6)_100%)]" />
                                    </div>
                                </div>
                            )}

                            {/* Manual Input (Polished) */}
                            <div className="mt-8 pt-6 border-t border-white/5 animate-in slide-in-from-bottom-4 duration-700 delay-150">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest pl-1">
                                        <div className="w-8 h-[1px] bg-slate-700"></div>
                                        <span>Atau Input Manual</span>
                                        <div className="w-full h-[1px] bg-slate-700"></div>
                                    </div>

                                    <form onSubmit={handleManualSubmit} className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-300 pointer-events-none">
                                            <Settings size={20} className="opacity-0 w-0 h-0" /> {/* Hack to avoid unused import error if I remove User/Hash, wait I can reuse Settings or just import User if needed. Actually let's use existing imports. UserPlus is imported. Let's use Scan or just text. Let's import 'Hash' or 'User' if possible? Assuming User is not imported, let's check imports. UserPlus is there. */}
                                            <span className="font-mono text-lg font-bold">#</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={manualId}
                                            onChange={(e) => setManualId(e.target.value)}
                                            placeholder="KETIK NIK / ID..."
                                            className="w-full bg-slate-900/50 border-2 border-slate-700 group-focus-within:border-cyan-500/50 group-focus-within:bg-slate-900/80 rounded-2xl pl-12 pr-14 py-4 text-white placeholder-slate-600 focus:outline-none transition-all duration-300 font-mono text-lg tracking-widest uppercase shadow-inner"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!manualId.trim() || isProcessing}
                                            className="absolute right-2 top-2 bottom-2 aspect-square bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl disabled:opacity-0 disabled:scale-75 transition-all duration-300 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transform"
                                        >
                                            <ChevronRight size={24} strokeWidth={3} />
                                        </button>
                                    </form>
                                    <p className="text-[10px] text-center text-slate-600">
                                        Pastikan ID sesuai dengan data terdaftar
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'verify' && employee && (
                        <div className="glass-card bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-medium mb-3 border border-cyan-500/20">
                                    <ShieldCheck size={12} /> Verifikasi Wajah
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">{employee.name}</h2>
                                <p className={`text-sm font-medium ${employee.today_status === 'checked_in' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {employee.today_status === 'checked_in' ? 'Siap untuk Check-Out' : 'Siap untuk Check-In'}
                                </p>
                            </div>

                            <div className="relative w-full max-w-sm aspect-square mx-auto mb-8 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black/50 shadow-2xl shadow-cyan-900/20 group">
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-full object-cover transform scale-x-[-1] opacity-90 group-hover:opacity-100 transition-opacity"
                                />

                                {/* Overlay Elements */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* Scanning Line - Faster animation for verification */}
                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-[scan_1.5s_ease-in-out_infinite] z-20" />

                                    {/* Premium Corner Brackets */}
                                    <div className="absolute top-4 left-4 w-12 h-12 border-t-[4px] border-l-[4px] border-cyan-500 rounded-tl-xl shadow-lg shadow-cyan-500/30" />
                                    <div className="absolute top-4 right-4 w-12 h-12 border-t-[4px] border-r-[4px] border-cyan-500 rounded-tr-xl shadow-lg shadow-cyan-500/30" />
                                    <div className="absolute bottom-4 left-4 w-12 h-12 border-b-[4px] border-l-[4px] border-cyan-500 rounded-bl-xl shadow-lg shadow-cyan-500/30" />
                                    <div className="absolute bottom-4 right-4 w-12 h-12 border-b-[4px] border-r-[4px] border-cyan-500 rounded-br-xl shadow-lg shadow-cyan-500/30" />

                                    {/* Inner Subtle Frame */}
                                    <div className="absolute inset-8 border border-white/10 rounded-xl" />

                                    {/* Status Text Overlay */}
                                    <div className="absolute bottom-6 left-0 right-0 text-center">
                                        <span className="inline-block px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-cyan-400 text-xs font-mono tracking-widest border border-cyan-500/30 animate-pulse">
                                            MENDETEKSI WAJAH...
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={resetKiosk}
                                    className="px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition active:scale-95"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={captureAndVerify}
                                    disabled={isProcessing}
                                    className={`px-6 py-4 rounded-xl font-bold text-white shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2
                                            ${employee.today_status === 'checked_in'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/25 hover:shadow-amber-500/40'
                                            : 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                                        }`}
                                >
                                    {isProcessing ? (
                                        <RefreshCw className="animate-spin" />
                                    ) : employee.today_status === 'checked_in' ? (
                                        <><LogOut size={20} /> CHECK OUT</>
                                    ) : (
                                        <><LogIn size={20} /> CHECK IN</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="glass-card bg-emerald-500/10 backdrop-blur-2xl border border-emerald-500/20 rounded-3xl p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
                            <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30 animate-bounce">
                                <CheckCircle2 size={48} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">{message}</h2>
                            <p className="text-emerald-200 text-lg mb-8">{employee?.name}</p>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                                <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold mb-1">WAKTU TERCATAT</p>
                                <p className="text-4xl font-mono text-white">{formatTime(currentTime)}</p>
                            </div>

                            <p className="text-sm text-slate-400">Kembali otomatis dalam <span className="font-mono text-white">{autoResetTimer}s</span></p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="glass-card bg-red-500/10 backdrop-blur-2xl border border-red-500/20 rounded-3xl p-10 shadow-2xl animate-in zoom-in duration-300 text-center">
                            <div className="w-24 h-24 bg-gradient-to-tr from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
                                <XCircle size={48} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">Gagal</h2>
                            <p className="text-red-200 text-lg mb-8">{errorMsg}</p>

                            <button
                                onClick={resetKiosk}
                                className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white font-medium transition"
                            >
                                Coba Lagi ({autoResetTimer}s)
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 p-6 text-center">
                <div className="inline-flex items-center gap-4 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
                    <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                        <MapPin size={14} className="text-cyan-400" />
                        <span className="text-xs font-medium text-slate-300 tracking-wide">{companySettings.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{kioskId || 'NO ID'}</span>
                    </div>
                    <button
                        onClick={() => setShowSetup(true)}
                        className="ml-2 p-1.5 hover:bg-white/10 rounded-full transition text-slate-500 hover:text-white"
                    >
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* Setup & Registration Overlay */}
            {showSetup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

                        <div className="text-center mb-6 shrink-0">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                {isRegisterMode ? (
                                    <UserPlus size={32} className="text-emerald-400" />
                                ) : (
                                    <Settings size={32} className="text-cyan-400 animate-spin-slow" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-white">
                                {isRegisterMode ? (registerStep === 1 ? 'Pilih Karyawan' : 'Ambil Foto Wajah') :
                                    setupMode === 'menu' ? 'Kiosk Menu' : 'Admin Access'}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                {isRegisterMode ? 'Registrasi wajah untuk verifikasi' :
                                    setupMode === 'menu' ? 'Pilih opsi konfigurasi' : 'Masukkan PIN Admin'}
                            </p>
                        </div>

                        {/* Registration Mode (Active) */}
                        {isRegisterMode ? (
                            <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
                                {registerStep === 1 ? (
                                    <>
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Cari NIK atau Nama..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition"
                                                    autoFocus
                                                />
                                                {searchTerm && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer" onClick={() => setSearchTerm('')}>
                                                        <XCircle size={18} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="border border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-800/90 backdrop-blur-sm shadow-xl z-20">
                                                {employeeList.length === 0 ? (
                                                    <div className="p-4 text-center text-slate-500">
                                                        <p>Tidak ada data karyawan yang perlu didaftarkan</p>
                                                    </div>
                                                ) : employeeList.filter(e => {
                                                    const term = searchTerm.toLowerCase();
                                                    return (e.name?.toLowerCase() || '').includes(term) ||
                                                        (e.employee_id?.toLowerCase() || '').includes(term);
                                                }).length === 0 ? (
                                                    <div className="p-4 text-center text-slate-500">
                                                        <p>Tidak ada karyawan dengan nama/ID tersebut</p>
                                                    </div>
                                                ) : (
                                                    employeeList.filter(e => {
                                                        const term = searchTerm.toLowerCase();
                                                        return (e.name?.toLowerCase() || '').includes(term) ||
                                                            (e.employee_id?.toLowerCase() || '').includes(term);
                                                    }).slice(0, 50).map(emp => (
                                                        <button
                                                            key={emp.id}
                                                            onClick={() => {
                                                                setSelectedEmployee(emp);
                                                                setRegisterStep(2);
                                                            }}
                                                            className="w-full text-left p-4 hover:bg-slate-700/80 border-b border-slate-700/50 last:border-0 transition flex justify-between items-center group"
                                                        >
                                                            <div>
                                                                <div className="font-bold text-white group-hover:text-cyan-400 transition">{emp.name}</div>
                                                                <div className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-0.5 rounded inline-block mt-1">{emp.employee_id}</div>
                                                            </div>
                                                            <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition" />
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative rounded-2xl overflow-hidden aspect-square max-w-lg mx-auto bg-black border-2 border-slate-700 group">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                videoConstraints={{ facingMode: "user" }}
                                                className="w-full h-full object-cover"
                                            />
                                            {capturedPhotos.length < 5 && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                                    <div className="bg-black/50 p-4 rounded-full backdrop-blur-sm">
                                                        <Camera size={32} className="text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-5 gap-2">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="aspect-square rounded-lg bg-slate-800 border border-slate-700 overflow-hidden relative">
                                                    {capturedPhotos[i] ? (
                                                        <img src={capturedPhotos[i]} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold">
                                                            {i + 1}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="text-center">
                                            <p className="text-sm text-slate-400 mb-2">Ambil 5 posisi wajah yang berbeda</p>
                                            <p className="font-bold text-cyan-400">{capturedPhotos.length} / 5 Foto</p>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            {capturedPhotos.length < 5 ? (
                                                <button
                                                    onClick={handleCapturePhoto}
                                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-cyan-900/20 active:scale-95"
                                                >
                                                    Ambil Foto
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleRegisterFace}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
                                                >
                                                    {isProcessing ? 'Mengirim...' : 'Kirim Registrasi'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setCapturedPhotos([])}
                                                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-slate-800">
                                    <button
                                        onClick={resetRegistration}
                                        className="w-full py-3 text-slate-500 hover:text-white transition"
                                    >
                                        Kembali ke Menu Utama
                                    </button>
                                </div>
                            </div>
                        ) : setupMode === 'menu' ? (
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => setSetupMode('pair')}
                                    className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-4 transition group"
                                >
                                    <div className="p-3 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition">
                                        <Settings className="text-cyan-400" size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white">Pair Device</h3>
                                        <p className="text-sm text-slate-400">Hubungkan perangkat ini ke sistem</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setSetupMode('register')}
                                    className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-4 transition group"
                                >
                                    <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition">
                                        <UserPlus className="text-emerald-400" size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white">Register Wajah</h3>
                                        <p className="text-sm text-slate-400">Daftarkan wajah karyawan baru</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        if (!document.fullscreenElement) {
                                            document.documentElement.requestFullscreen().catch(err => {
                                                alert(`Error: ${err.message}`);
                                            });
                                            setShowSetup(false);
                                        } else {
                                            if (document.exitFullscreen) {
                                                document.exitFullscreen();
                                            }
                                        }
                                    }}
                                    className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-4 transition group"
                                >
                                    <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition">
                                        <Scan className="text-blue-400" size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white">Toggle Fullscreen</h3>
                                        <p className="text-sm text-slate-400">Masuk/Keluar mode layar penuh</p>
                                    </div>
                                </button>

                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <button
                                        onClick={() => setShowSetup(false)}
                                        className="w-full py-3 text-slate-500 hover:text-white transition"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Setup (Pair/Register Auth) form */
                            <form onSubmit={setupStep === 1 ? handleCheckPIN : handlePairing} className="space-y-5 flex-1 flex flex-col min-h-0">
                                {setupStep === 1 ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin PIN</label>
                                        <input
                                            type="password"
                                            value={adminPIN}
                                            onChange={(e) => setAdminPIN(e.target.value)}
                                            placeholder="••••••"
                                            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition font-mono tracking-widest text-lg placeholder-slate-600 z-50 relative"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    /* Kiosk Selection (Only for Pair mode) */
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Kiosk ID</label>
                                        <select
                                            value={kioskId}
                                            onChange={(e) => setKioskId(e.target.value)}
                                            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition font-mono appearance-none"
                                            required
                                        >
                                            <option value="">-- Pilih --</option>
                                            {availableKiosks.map(k => (
                                                <option key={k.id} value={k.kiosk_id}>
                                                    {k.kiosk_id} - {k.name} ({k.office})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {setupStep === 2 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin PIN (Confirmed)</label>
                                        <div className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 font-mono tracking-widest">
                                            {'•'.repeat(adminPIN.length)}
                                        </div>
                                    </div>
                                )}


                                <div className="pt-4 flex flex-col gap-3 mt-auto">
                                    <div className="flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={isProcessing}
                                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-cyan-900/20 active:scale-95 disabled:opacity-50"
                                        >
                                            {isProcessing ? 'Verifying...' : (setupStep === 1 ? 'Check PIN' : 'Pair Device')}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (setupStep === 2) setSetupStep(1);
                                                else {
                                                    setSetupMode('menu'); // Back to menu
                                                    setAdminPIN('');
                                                }
                                            }}
                                            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                                        >
                                            {setupStep === 2 ? 'Back' : 'Back'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Prerequisites Modal (Blocking) */}
            {(!kioskId || cameraError) && !showSetup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-500">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />

                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/50 border border-slate-700">
                            <ShieldCheck size={40} className="text-amber-400" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Konfigurasi Diperlukan</h2>
                        <p className="text-slate-400 text-sm mb-8">
                            Perangkat ini harus memenuhi persyaratan berikut untuk beroperasi sebagai Kiosk.
                        </p>

                        <div className="space-y-4 mb-8">
                            {/* Camera Check */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${!cameraError ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        <Camera size={20} />
                                    </div>
                                    <span className="text-slate-200 font-medium">Kamera</span>
                                </div>
                                {!cameraError ? (
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                                        <CheckCircle2 size={16} />
                                        <span>Aktif</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                                        <XCircle size={16} />
                                        <span>Tidak Tersedia</span>
                                    </div>
                                )}
                            </div>

                            {/* Pairing Check */}
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${kioskId ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        <Settings size={20} />
                                    </div>
                                    <span className="text-slate-200 font-medium">Pairing Device</span>
                                </div>
                                {kioskId ? (
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                                        <CheckCircle2 size={16} />
                                        <span>Terhubung</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                                        <AlertCircle size={16} />
                                        <span>Belum Setup</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {cameraError ? (
                                <button
                                    onClick={() => {
                                        const retries = parseInt(sessionStorage.getItem('kiosk_camera_retries') || '0');
                                        if (retries >= 2) { // 3rd attempt (img 0, 1, 2)
                                            sessionStorage.removeItem('kiosk_camera_retries');
                                            navigate('/login'); // Force full nav
                                            return;
                                        }
                                        sessionStorage.setItem('kiosk_camera_retries', (retries + 1).toString());
                                        window.location.reload();
                                    }}
                                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition shadow-lg shadow-red-900/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={18} />
                                    Coba Akses Kamera ({3 - parseInt(sessionStorage.getItem('kiosk_camera_retries') || '0')}x lagi)
                                </button>
                            ) : !kioskId ? (
                                <button
                                    onClick={() => {
                                        setSetupMode('pair'); // Direct to Pair mode if not paired
                                        setShowSetup(true);
                                    }}
                                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition shadow-lg shadow-amber-900/20 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Settings size={18} />
                                    Mulai Setup Kiosk
                                </button>
                            ) : null}

                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition flex items-center justify-center gap-2 font-medium"
                            >
                                <LogOut size={16} />
                                Kembali ke Login
                            </button>

                            {cameraError && (
                                <p className="text-xs text-slate-500 mt-4">
                                    Gagal 3x akan dialihkan ke Login. Pastikan izin kamera aktif.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Screensaver Overlay */}
            {isScreensaverActive && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center cursor-pointer animate-in fade-in duration-500"
                    onClick={() => {
                        setIsScreensaverActive(false);
                        setIdleTime(0);
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-blue-600/5 animate-pulse" />

                    {/* Floating Orbs */}
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] animate-blob" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />

                    <div className="relative z-10 text-center space-y-10">
                        <div className="flex flex-col items-center gap-8">
                            <div className="p-8 bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl shadow-cyan-500/20 animate-pulse" style={{ animationDuration: '4s' }}>
                                {companySettings.logo ? (
                                    <img src={companySettings.logo} alt="Logo" className="w-32 h-32 object-contain drop-shadow-2xl" />
                                ) : (
                                    <Clock size={80} className="text-slate-400" />
                                )}
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-8xl font-thin tracking-tighter text-white font-mono bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
                                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </h1>
                                <div className="space-y-1">
                                    <h2 className="text-2xl text-cyan-400 font-bold tracking-[0.2em] uppercase">
                                        {companySettings.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 font-medium tracking-widest uppercase">
                                        {companySettings.address}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="animate-bounce">
                            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-slate-400 text-sm tracking-[0.2em] hover:bg-white/10 transition">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                                SENTUH LAYAR UNTUK MEMULAI
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KioskPage;
