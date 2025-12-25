import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Webcam from 'react-webcam';
import {
    Clock, MapPin, Scan, CheckCircle2, XCircle,
    Settings, ShieldCheck, ChevronRight, RefreshCw, LogIn, LogOut, UserPlus, Camera
} from 'lucide-react';

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
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Company Settings
    const [companySettings, setCompanySettings] = useState({
        name: 'Loading...',
        logo: '',
        address: '',
        screensaverTimeout: 60
    });

    // Fetch Settings
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
    }, []);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Initialize QR Scanner
    useEffect(() => {
        if (step === 'scan' && !showSetup && !cameraError) {
            // Check permissions first
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => setCameraError(false))
                .catch(() => setCameraError(true));

            if (scannerRef.current) return;

            try {
                const scanner = new Html5QrcodeScanner(
                    "qr-reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    false
                );

                scanner.render(
                    (decodedText) => handleQRScan(decodedText),
                    (error) => {
                        if (error.toString().includes('getUserMedia') || error.toString().includes('NotAllowedError')) {
                            setCameraError(true);
                            scanner.clear().catch(console.error);
                        }
                    }
                );
                scannerRef.current = scanner;
            } catch (err) {
                setCameraError(true);
            }
        }

        return () => {
            if (scannerRef.current && step !== 'scan') {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        };
    }, [step, cameraError]);

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

    const handleQRScan = async (employeeId: string) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const response = await fetch(`${API_URL}/api/kiosk/scan`, {
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

            setEmployee(data);

            if (!data.has_face_data) {
                setErrorMsg('Anda belum mendaftarkan wajah. Silakan hubungi Admin.');
                setStep('error');
                return;
            }

            if (scannerRef.current) {
                await scannerRef.current.clear();
                scannerRef.current = null;
            }
            setStep('verify');
        } catch (error) {
            setErrorMsg('Gagal terhubung ke server');
            setStep('error');
        } finally {
            setIsProcessing(false);
        }
    };

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

            const response = await fetch(`${API_URL}/api/kiosk/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.employee_id,
                    kiosk_id: kioskId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrorMsg(data.error || 'Gagal melakukan absensi');
                setStep('error');
                return;
            }

            setMessage(data.message);
            setStep('success');
        } catch (error) {
            setErrorMsg('Gagal terhubung ke server');
            setStep('error');
        } finally {
            setIsProcessing(false);
        }
    }, [employee, isProcessing, kioskId]);

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
        <div className="min-h-screen bg-slate-900 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white overflow-hidden relative font-sans selection:bg-cyan-500/30">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
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
            <div className="relative z-10 flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-lg">

                    {step === 'scan' && (
                        <div className="glass-card bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                                    {cameraError ? 'Mode Manual' : 'Scan QR Code'}
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    {cameraError ? 'Kamera tidak tersedia, gunakan ID manual' : 'Arahkan kode QR karyawan ke kamera'}
                                </p>
                            </div>

                            {!cameraError && (
                                <div className="relative w-64 h-64 mx-auto mb-8 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black/50 shadow-inner group">
                                    <div id="qr-reader" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />

                                    {/* Scanning Animation Overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                                        <div className="absolute inset-0 border-[30px] border-slate-900/60" /> {/* Vignette */}
                                        <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 w-16 h-16" />
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleManualSubmit} className="relative">
                                <input
                                    type="text"
                                    value={manualId}
                                    onChange={(e) => setManualId(e.target.value.toUpperCase())}
                                    placeholder={cameraError ? "Masukkan ID Karyawan" : "Atau ketik ID Karyawan..."}
                                    className="w-full bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 pl-11 outline-none focus:ring-2 focus:ring-cyan-500/50 transition font-mono tracking-wider text-center uppercase"
                                    autoFocus={cameraError}
                                />
                                <RefreshCw className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isProcessing ? 'animate-spin text-cyan-400' : 'text-slate-500'}`} />
                                <button
                                    type="submit"
                                    disabled={!manualId.trim() || isProcessing}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-white rounded-lg transition disabled:opacity-0 disabled:pointer-events-none"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </form>
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

                            <div className="relative w-64 h-64 mx-auto mb-8">
                                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30 p-1">
                                    <div className="w-full h-full rounded-full overflow-hidden relative bg-black">
                                        <Webcam
                                            ref={webcamRef}
                                            audio={false}
                                            screenshotFormat="image/jpeg"
                                            className="w-full h-full object-cover transform scale-x-[-1]"
                                        />
                                        {/* Face Guide Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-40 h-52 border-2 border-dashed border-cyan-400/50 rounded-[40%] opacity-50 scanner-guide-animation" />
                                        </div>
                                    </div>
                                </div>
                                {/* Pulse Effect */}
                                <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse -z-10" />
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
                                            <input
                                                type="text"
                                                placeholder="Cari NIK atau Nama..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition"
                                                autoFocus
                                            />
                                            <div className="border border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-800/50">
                                                {employeeList.filter(e =>
                                                    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    e.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
                                                ).length === 0 ? (
                                                    <div className="p-4 text-center text-slate-500">Tidak ada data ditemukan</div>
                                                ) : (
                                                    employeeList.filter(e =>
                                                        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        e.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
                                                    ).map(emp => (
                                                        <button
                                                            key={emp.id}
                                                            onClick={() => {
                                                                setSelectedEmployee(emp);
                                                                setRegisterStep(2);
                                                            }}
                                                            className="w-full text-left p-4 hover:bg-slate-700 border-b border-slate-700 last:border-0 transition"
                                                        >
                                                            <div className="font-bold text-white">{emp.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono">{emp.employee_id}</div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border-2 border-slate-700 group">
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

            {/* Screensaver Overlay */}
            {
                isScreensaverActive && (
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
                )
            }
        </div>
    );
};

export default KioskPage;
