// Kiosk Attendance Page with QR Scanner and Face Recognition
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Webcam from 'react-webcam';
import {
    Clock, MapPin, Scan, CheckCircle2, XCircle,
    Settings, ShieldCheck, ChevronRight, RefreshCw, LogIn, LogOut
} from 'lucide-react';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:8080` : '');

interface EmployeeInfo {
    employee_id: string;
    name: string;
    has_face_data: boolean;
    today_status: string;
    check_in_time?: string;
    face_embeddings?: number[][];
}

type KioskStep = 'scan' | 'verify' | 'success' | 'error' | 'register';

export default function KioskPage() {
    const [step, setStep] = useState<KioskStep>('scan');
    const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
    const [message, setMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoResetTimer, setAutoResetTimer] = useState(5);
    const [manualId, setManualId] = useState('');
    const [cameraError, setCameraError] = useState(false);
    const [kioskId, setKioskId] = useState(localStorage.getItem('kiosk_id') || '');
    const [showSetup, setShowSetup] = useState(!localStorage.getItem('kiosk_id'));
    const [adminPIN, setAdminPIN] = useState('');
    const [companySettings, setCompanySettings] = useState<{ name: string; logo: string | null; address: string }>({
        name: 'ATTENDX KIOSK',
        logo: null,
        address: 'HQ JAKARTA'
    });
    const webcamRef = useRef<Webcam>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch company settings
    useEffect(() => {
        fetch(`${API_URL}/api/kiosk/settings`)
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setCompanySettings({
                        name: data.company_name || 'ATTENDX KIOSK',
                        logo: data.company_logo || null,
                        address: data.company_address || 'HQ JAKARTA'
                    });
                }
            })
            .catch(err => console.error('Failed to load settings', err));
    }, []);

    // Initialize QR Scanner
    useEffect(() => {
        if (step === 'scan' && !scannerRef.current && !cameraError) {
            try {
                const scanner = new Html5QrcodeScanner('qr-reader', {
                    fps: 10,
                    qrbox: { width: 280, height: 280 },
                    rememberLastUsedCamera: true,
                }, false);

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

    const handlePairing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kioskId || !adminPIN) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${API_URL}/api/kiosk/admin-unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_code: adminPIN }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Gagal verifikasi admin');
                return;
            }

            localStorage.setItem('kiosk_id', kioskId);
            setShowSetup(false);
            setAdminPIN('');
            alert('Perangkat berhasil dipasangkan!');
        } catch (error) {
            alert('Gagal terhubung ke server');
        } finally {
            setIsProcessing(false);
        }
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
                <div className="flex items-center gap-3 mb-2 opacity-80">
                    <div className="p-2 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20 overflow-hidden">
                        {companySettings.logo ? (
                            <img src={companySettings.logo} alt="Logo" className="w-6 h-6 object-contain" />
                        ) : (
                            <Clock size={24} className="text-white" />
                        )}
                    </div>
                    <span className="text-lg font-medium tracking-wide text-slate-300">{companySettings.name}</span>
                </div>

                <h1 className="text-[5rem] font-light leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 font-mono">
                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    <span className="text-3xl text-slate-500 ml-2 animate-pulse">: {currentTime.getSeconds().toString().padStart(2, '0')}</span>
                </h1>
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

            {/* Setup Overlay */}
            {showSetup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                <Settings size={32} className="text-cyan-400 animate-spin-slow" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Setup Kiosk</h2>
                            <p className="text-slate-400 text-sm mt-1">Konfigurasi perangkat pertama kali</p>
                        </div>

                        <form onSubmit={handlePairing} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kiosk ID</label>
                                <input
                                    type="text"
                                    value={kioskId}
                                    onChange={(e) => setKioskId(e.target.value.toUpperCase())}
                                    placeholder="ex: KIOSK-HQ-01"
                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition font-mono uppercase placeholder-slate-600"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin PIN</label>
                                <input
                                    type="password"
                                    value={adminPIN}
                                    onChange={(e) => setAdminPIN(e.target.value)}
                                    placeholder="••••••"
                                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-white outline-none transition font-mono tracking-widest text-lg placeholder-slate-600"
                                    required
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-cyan-900/20 active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessing ? 'Verifying...' : 'Pair Device'}
                                </button>
                                {localStorage.getItem('kiosk_id') && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSetup(false)}
                                        className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Scan Animation Style */}
            <style>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// Inline fallback for animation styles if needed
const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

