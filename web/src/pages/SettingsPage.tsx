// Settings Page - Admin
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import { Settings, Save, AlertCircle, Key, Building } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [faceThreshold, setFaceThreshold] = useState('0.6');
    const [minGpsAccuracy, setMinGpsAccuracy] = useState('20');
    const [kioskAdminCode, setKioskAdminCode] = useState('123456');
    const [isSaving, setIsSaving] = useState(false);

    const { data: settings, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await adminAPI.getSettings();
            return res.data.settings || {};
        },
    });

    useEffect(() => {
        if (settings) {
            setCompanyName(settings.company_name || '');
            setCompanyAddress(settings.company_address || '');
            setCompanyLogo(settings.company_logo || null);
            setFaceThreshold(settings.face_threshold || '0.6');
            setMinGpsAccuracy(settings.min_gps_accuracy || '20');
            setKioskAdminCode(settings.kiosk_admin_code || '123456');
        }
    }, [settings]);

    const updateMutation = useMutation({
        mutationFn: ({ key, value }: { key: string; value: string }) =>
            adminAPI.updateSetting(key, value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Upload logo if changed
            if (logoFile) {
                const res = await adminAPI.uploadLogo(logoFile);
                setCompanyLogo(res.data.logo_url);
            }
            await updateMutation.mutateAsync({ key: 'company_name', value: companyName });
            await updateMutation.mutateAsync({ key: 'company_address', value: companyAddress });
            await updateMutation.mutateAsync({ key: 'face_threshold', value: faceThreshold });
            await updateMutation.mutateAsync({ key: 'min_gps_accuracy', value: minGpsAccuracy });
            await updateMutation.mutateAsync({ key: 'kiosk_admin_code', value: kioskAdminCode });
            alert('Pengaturan berhasil disimpan');
            setLogoFile(null);
        } catch (err) {
            alert('Gagal menyimpan pengaturan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoFile(e.target.files[0]);
        }
    };

    if (isLoading) {
        return <div className="p-6 text-center text-slate-400">Loading...</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Settings className="text-cyan-500" />
                    Pengaturan Sistem
                </h1>
                <p className="text-slate-400 mt-1">
                    Konfigurasi profil perusahaan dan parameter sistem
                </p>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Company Profile Settings */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Building className="text-cyan-500" size={20} />
                        Profil Perusahaan
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Logo Perusahaan
                            </label>
                            <div className="flex items-center gap-4">
                                {companyLogo || logoFile ? (
                                    <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                                        <img
                                            src={logoFile ? URL.createObjectURL(logoFile) : companyLogo!}
                                            alt="Logo"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center text-slate-500">
                                        No Logo
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-500 hover:file:bg-cyan-500/20"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Nama Perusahaan
                            </label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                                placeholder="Contoh: PT. Teknologi Maju"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Alamat
                            </label>
                            <textarea
                                value={companyAddress}
                                onChange={(e) => setCompanyAddress(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                                placeholder="Alamat lengkap perusahaan..."
                            />
                        </div>
                    </div>
                </div>

                {/* Face Verification Settings */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Verifikasi Wajah
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Face Matching Threshold
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1.0"
                                    step="0.05"
                                    value={faceThreshold}
                                    onChange={(e) => setFaceThreshold(e.target.value)}
                                    className="flex-1 accent-cyan-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="w-16 text-center font-mono bg-slate-800 text-cyan-400 border border-slate-700 px-2 py-1 rounded">
                                    {faceThreshold}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Nilai lebih rendah = lebih ketat (default: 0.6)
                            </p>
                        </div>
                    </div>
                </div>

                {/* GPS Settings */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Geolokasi
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Minimum Akurasi GPS (meter)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="5"
                                    max="100"
                                    value={minGpsAccuracy}
                                    onChange={(e) => setMinGpsAccuracy(e.target.value)}
                                    className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                                />
                                <span className="text-slate-400">meter</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                GPS dengan akurasi lebih buruk dari ini akan ditolak (default: 20m)
                            </p>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-amber-500">
                                Nilai terlalu kecil bisa menyebabkan banyak penolakan di lokasi dengan sinyal GPS lemah.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Kiosk Settings */}
                <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Key size={20} className="text-cyan-500" />
                        Pengaturan Kiosk
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Kode Admin Kiosk (PIN)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="text"
                                    value={kioskAdminCode}
                                    onChange={(e) => setKioskAdminCode(e.target.value.replace(/\D/g, ''))}
                                    maxLength={6}
                                    className="w-32 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white font-mono text-center text-lg tracking-widest placeholder-slate-700"
                                    placeholder="123456"
                                />
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                PIN ini digunakan untuk memasangkan perangkat Kiosk baru (default: 123456)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                    <Save size={18} />
                    {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
            </div>
        </div>
    );
}
