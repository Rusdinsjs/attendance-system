import { useState, useEffect } from 'react';
import { adminAPI, type Kiosk } from '../../api/client';
import { Plus, Edit, Trash2, Monitor, MapPin, Activity, XCircle, Laptop, Smartphone, Unlink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Office {
    id: string;
    name: string;
}

export default function KioskManagementPage() {
    const [kiosks, setKiosks] = useState<Kiosk[]>([]);
    const [offices, setOffices] = useState<Office[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [kioskId, setKioskId] = useState('');
    const [officeId, setOfficeId] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 9; // Grid based usually fits better with 3x3

    useEffect(() => {
        fetchData();
    }, [page]);

    useEffect(() => {
        fetchOffices();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getKiosks({
                limit,
                offset: (page - 1) * limit
            });
            const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
            const totalCount = response.data?.total || data.length;
            setKiosks(data);
            setTotal(totalCount);
        } catch (error) {
            console.error('Failed to fetch kiosks:', error);
            setKiosks([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchOffices = async () => {
        try {
            const response = await adminAPI.getOffices();
            // Handle {offices: [...]}, array, or wrapped data format
            const data = response.data?.offices || (Array.isArray(response.data) ? response.data : (response.data?.data || []));
            setOffices(data);
        } catch (error) {
            console.error('Failed to fetch offices:', error);
            setOffices([]); // Fallback to empty array
        }
    };

    const handleOpenModal = (kiosk?: Kiosk) => {
        if (kiosk) {
            setEditingKiosk(kiosk);
            setName(kiosk.name);
            setKioskId(kiosk.kiosk_id);
            setOfficeId(kiosk.office_id);
            setIsActive(kiosk.is_active);
        } else {
            setEditingKiosk(null);
            setName('');
            setKioskId('');
            setOfficeId(offices.length > 0 ? offices[0].id : '');
            setIsActive(true);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingKiosk) {
                await adminAPI.updateKiosk(editingKiosk.id, {
                    name,
                    office_id: officeId,
                    is_active: isActive
                });
            } else {
                await adminAPI.createKiosk({
                    name,
                    kiosk_id: kioskId,
                    office_id: officeId
                });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            alert('Gagal menyimpan data kiosk');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Hapus kiosk ${name}?`)) {
            try {
                await adminAPI.deleteKiosk(id);
                fetchData();
            } catch (error) {
                alert('Gagal menghapus kiosk');
            }
        }
    };

    const handleUnpair = async (id: string, name: string) => {
        if (window.confirm(`Reset pairing untuk kiosk ${name}? Device fisik harus dipairing ulang setelah ini.`)) {
            try {
                await adminAPI.unpairKiosk(id);
                fetchData();
                alert('Berhasil reset pairing. Kiosk ID ini sekarang available.');
            } catch (error) {
                alert('Gagal reset pairing');
            }
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-8 rounded-3xl shadow-xl shadow-slate-900/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2"></div>

                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Monitor className="text-cyan-400" size={32} />
                        Manajemen Kiosk
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">Kelola perangkat Kiosk & status online</p>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="relative z-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition transform active:scale-95"
                >
                    <Plus size={20} />
                    Tambah Device
                </button>
            </div>

            {/* Stats/Search Bar could go here */}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kiosks.map((kiosk) => (
                    <div key={kiosk.id} className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenModal(kiosk)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-cyan-400 transition shadow-lg border border-slate-700"
                                    title="Edit"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(kiosk.id, kiosk.name)}
                                    className="p-2 bg-slate-800 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition shadow-lg border border-slate-700"
                                    title="Hapus"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className={`p-4 rounded-2xl ${kiosk.is_active ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                                <Laptop size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors truncate pr-16">{kiosk.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono py-1 px-2 rounded-md bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                                        {kiosk.kiosk_id}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <MapPin size={16} className="text-slate-500" />
                                <span className="font-medium text-slate-300">{kiosk.office?.name || 'Unknown Office'}</span>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <Activity size={16} className={kiosk.is_active ? "text-green-500" : "text-slate-500"} />
                                <span>Seen: {new Date(kiosk.last_seen).getFullYear() === 1 ? 'Never' : format(new Date(kiosk.last_seen), 'dd MMM HH:mm', { locale: idLocale })}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Smartphone size={16} className={kiosk.is_paired ? "text-blue-500" : "text-slate-500"} />
                                    <span>{kiosk.is_paired ? 'Paired' : 'Available'}</span>
                                </div>
                                {kiosk.is_paired && (
                                    <button
                                        onClick={() => handleUnpair(kiosk.id, kiosk.name)}
                                        className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center gap-1 transition"
                                    >
                                        <Unlink size={12} />
                                        Unpair
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status Device</div>
                            {kiosk.is_active ? (
                                <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    ONLINE
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                                    <XCircle size={12} /> OFFLINE
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {/* Add New Placeholder Card */}
                <button
                    onClick={() => handleOpenModal()}
                    className="group flex flex-col items-center justify-center gap-4 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl p-6 hover:border-cyan-500/50 hover:bg-slate-900 transition-all duration-300 min-h-[300px]"
                >
                    <div className="p-4 bg-slate-800 rounded-full group-hover:bg-cyan-500/20 text-slate-600 group-hover:text-cyan-400 transition-colors">
                        <Plus size={32} />
                    </div>
                    <span className="text-slate-500 font-medium group-hover:text-cyan-400">Register New Kiosk</span>
                </button>
            </div>

            {/* Pagination Controls */}
            {!loading && total > limit && (
                <div className="flex justify-center items-center gap-4 py-8">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/50 transition-all shadow-lg"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2">
                        {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-10 h-10 rounded-xl font-bold transition-all border ${page === p
                                        ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/20"
                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600"
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                        disabled={page === Math.ceil(total / limit)}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-cyan-500/50 transition-all shadow-lg"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {/* Create/Edit Modal - Dark Theme */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Glow */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                                {editingKiosk ? <Edit className="text-cyan-400" /> : <Plus className="text-cyan-400" />}
                                {editingKiosk ? 'Edit Konfigurasi' : 'Registrasi Kiosk Baru'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Nama Device</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition placeholder-slate-600"
                                        placeholder="Contoh: Kiosk Lobby Utama"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Kiosk ID</label>
                                        <input
                                            type="text"
                                            value={kioskId}
                                            onChange={(e) => setKioskId(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 outline-none uppercase font-mono tracking-wide placeholder-slate-600"
                                            placeholder="XX-01"
                                            disabled={!!editingKiosk}
                                            required
                                        />
                                        {editingKiosk && <p className="text-xs text-slate-600 mt-1">ID Permanent</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Lokasi</label>
                                        <select
                                            value={officeId}
                                            onChange={(e) => setOfficeId(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                                            required
                                        >
                                            <option value="">Pilih Kantor</option>
                                            {Array.isArray(offices) && offices.map((office) => (
                                                <option key={office.id} value={office.id}>{office.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {editingKiosk && (
                                    <div className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setIsActive(!isActive)}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 ${isActive ? 'bg-cyan-500' : 'bg-slate-700'}`}
                                        >
                                            <span
                                                className={`block w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-200 ${isActive ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                        <label htmlFor="isActive" className="text-sm font-medium text-slate-300">
                                            {isActive ? 'Status Aktif' : 'Status Tidak Aktif'} <span className="text-slate-500 text-xs ml-1">{isActive ? '(Bisa digunakan)' : '(Non-aktif)'}</span>
                                        </label>
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4 border-t border-slate-800 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition font-bold shadow-lg shadow-cyan-900/20 active:scale-95"
                                    >
                                        Simpan Perubahan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }


        </div >
    );
}
