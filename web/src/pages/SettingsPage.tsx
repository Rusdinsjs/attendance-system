// Settings Page - Admin
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const queryClient = useQueryClient();
    const [faceThreshold, setFaceThreshold] = useState('0.6');
    const [minGpsAccuracy, setMinGpsAccuracy] = useState('20');
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
            setFaceThreshold(settings.face_threshold || '0.6');
            setMinGpsAccuracy(settings.min_gps_accuracy || '20');
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
            await updateMutation.mutateAsync({ key: 'face_threshold', value: faceThreshold });
            await updateMutation.mutateAsync({ key: 'min_gps_accuracy', value: minGpsAccuracy });
            alert('Pengaturan berhasil disimpan');
        } catch (err) {
            alert('Gagal menyimpan pengaturan');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-6 text-center text-slate-500">Loading...</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="text-cyan-500" />
                    Pengaturan Sistem
                </h1>
                <p className="text-slate-500 mt-1">
                    Konfigurasi threshold dan parameter sistem
                </p>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Face Verification Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">
                        Verifikasi Wajah
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
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
                                    className="flex-1"
                                />
                                <span className="w-16 text-center font-mono bg-slate-100 px-2 py-1 rounded">
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
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">
                        Geolokasi
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Minimum Akurasi GPS (meter)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="5"
                                    max="100"
                                    value={minGpsAccuracy}
                                    onChange={(e) => setMinGpsAccuracy(e.target.value)}
                                    className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                                <span className="text-slate-500">meter</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                GPS dengan akurasi lebih buruk dari ini akan ditolak (default: 20m)
                            </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-amber-700">
                                Nilai terlalu kecil bisa menyebabkan banyak penolakan di lokasi dengan sinyal GPS lemah.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Save size={18} />
                    {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
            </div>
        </div>
    );
}
