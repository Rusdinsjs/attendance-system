// Login Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI, publicAPI } from '../api/client';
import { LogIn, AlertCircle, Eye, EyeOff, Building2, MapPin } from 'lucide-react';

interface CompanySettings {
    company_name: string;
    company_address: string;
    company_logo: string;
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [companySettings, setCompanySettings] = useState<CompanySettings>({
        company_name: '',
        company_address: '',
        company_logo: '',
    });
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await publicAPI.getCompanySettings();
                setCompanySettings(res.data);
            } catch (err) {
                console.error("Failed to fetch company settings", err);
            }
        };
        fetchSettings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        setError('');
        setLoading(true);

        try {
            const response = await authAPI.login(email, password);
            const { user, access_token, refresh_token } = response.data;

            // Check if user has admin/hr role
            if (user.role !== 'admin' && user.role !== 'hr') {
                setError('Akses ditolak. Hanya admin dan HR yang dapat mengakses dashboard.');
                return;
            }

            login(user, access_token, refresh_token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login gagal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.02]" />
            <div className="absolute top-20 left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Branding */}
                <div className="text-center mb-8 space-y-4">
                    <div className="relative group inline-block">
                        <div className="absolute -inset-1 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden transform group-hover:scale-105 transition duration-300">
                            {companySettings.company_logo ? (
                                <img
                                    src={companySettings.company_logo}
                                    alt="Logo"
                                    className="w-full h-full object-contain p-2"
                                />
                            ) : (
                                <Building2 size={36} className="text-cyan-500" />
                            )}
                        </div>
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            {companySettings.company_name || 'AttendX'}
                        </h1>

                        {companySettings.company_address && (
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 max-w-xs mx-auto mt-2">
                                <MapPin size={12} className="flex-shrink-0" />
                                <p className="truncate">{companySettings.company_address}</p>
                            </div>
                        )}

                        <p className="text-slate-400 mt-3 font-medium text-sm uppercase tracking-wider">
                            Admin Dashboard
                        </p>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/5 ring-1 ring-white/10">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">
                        Masuk ke Dashboard
                    </h2>

                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition text-white placeholder-slate-600 focus:bg-slate-950"
                                placeholder="nama@perusahaan.com"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-300">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3 bg-slate-950/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition text-white placeholder-slate-600 focus:bg-slate-950"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition p-1 hover:bg-slate-800 rounded-lg"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 shadow-lg shadow-cyan-900/20 active:scale-[0.98] ring-1 ring-white/10"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Masuk
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-slate-500 mt-8 font-light">
                        Protected by robust authentication
                    </p>
                </div>
            </div>
        </div>
    );
}
