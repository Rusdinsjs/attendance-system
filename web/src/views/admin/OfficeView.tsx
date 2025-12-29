// Office Locations Management Page
import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client';
import type { Office } from '../../api/client';
import { Plus, Edit, Trash2, MapPin, Building, Crosshair, Clock, Navigation } from 'lucide-react';
import Swal from 'sweetalert2';

export default function OfficeView() {
    const [offices, setOffices] = useState<Office[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingOffice, setEditingOffice] = useState<Office | null>(null);
    const [formData, setFormData] = useState<Partial<Office>>({
        name: '',
        address: '',
        latitude: -6.2,
        longitude: 106.8,
        radius: 50,
        check_in_time: '08:00',
        check_out_time: '17:00',
        check_in_tolerance: 15,
        check_out_tolerance: 15
    });

    useEffect(() => {
        fetchOffices();
    }, []);

    const fetchOffices = async () => {
        try {
            const response = await adminAPI.getOffices();
            setOffices(Array.isArray(response.data.offices) ? response.data.offices : []);
        } catch (error) {
            console.error('Failed to fetch offices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (office: Office) => {
        setEditingOffice(office);
        setFormData(office);
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        const result = await Swal.fire({
            title: `Hapus Kantor ${name}?`,
            text: 'Data yang dihapus tidak dapat dikembalikan!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            background: '#0f172a',
            color: '#fff'
        });

        if (result.isConfirmed) {
            try {
                await adminAPI.deleteOffice(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Terhapus',
                    text: 'Kantor berhasil dihapus',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#0f172a',
                    color: '#fff'
                });
                fetchOffices();
            } catch (error) {
                Swal.fire({
                    title: 'Error',
                    text: 'Gagal menghapus kantor',
                    icon: 'error',
                    background: '#0f172a',
                    color: '#fff'
                });
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingOffice) {
                await adminAPI.updateOffice(editingOffice.id, formData);
            } else {
                await adminAPI.createOffice(formData);
            }
            setShowModal(false);
            setEditingOffice(null);
            setFormData({
                name: '',
                address: '',
                latitude: -6.2,
                longitude: 106.8,
                radius: 50,
                check_in_time: '08:00',
                check_out_time: '17:00',
                check_in_tolerance: 15,
                check_out_tolerance: 15
            });
            fetchOffices();
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: editingOffice ? 'Kantor diperbarui' : 'Kantor ditambahkan',
                timer: 1500,
                showConfirmButton: false,
                background: '#0f172a',
                color: '#fff'
            });
        } catch (error) {
            Swal.fire({
                title: 'Error',
                text: 'Gagal menyimpan data',
                icon: 'error',
                background: '#0f172a',
                color: '#fff'
            });
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
                        <Building className="text-cyan-400" size={32} />
                        Lokasi Kantor
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">Kelola daftar lokasi kantor untuk absensi</p>
                </div>

                <button
                    onClick={() => {
                        setEditingOffice(null);
                        setFormData({
                            name: '',
                            address: '',
                            latitude: -6.2,
                            longitude: 106.8,
                            radius: 50,
                            check_in_time: '08:00',
                            check_out_time: '17:00',
                            check_in_tolerance: 15,
                            check_out_tolerance: 15
                        });
                        setShowModal(true);
                    }}
                    className="relative z-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition transform active:scale-95"
                >
                    <Plus size={20} />
                    Tambah Kantor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {offices.map((office) => (
                    <div key={office.id} className="group bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden">

                        {/* Action Buttons (Visible on Hover) */}
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(office)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-cyan-400 transition shadow-lg border border-slate-700"
                                    title="Edit"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(office.id, office.name)}
                                    className="p-2 bg-slate-800 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition shadow-lg border border-slate-700"
                                    title="Hapus"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/10">
                                <MapPin size={32} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors truncate">{office.name}</h3>
                                <p className="text-slate-400 text-sm line-clamp-2">{office.address || 'Alamat tidak tersedia'}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <Crosshair size={16} className="text-slate-500" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500">Koordinat</span>
                                    <span className="font-mono text-slate-300">{office.latitude?.toFixed(6)}, {office.longitude?.toFixed(6)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <Navigation size={16} className="text-cyan-500" />
                                <div className="flex justify-between w-full">
                                    <span>Radius Absensi</span>
                                    <span className="font-bold text-cyan-400">{office.radius} meter</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-800/50">
                                <Clock size={16} className="text-blue-500" />
                                <div className="flex justify-between w-full">
                                    <span>Jam Kerja</span>
                                    <span className="font-mono text-slate-300">{office.check_in_time} - {office.check_out_time}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add New Placeholder Card */}
                <button
                    onClick={() => {
                        setEditingOffice(null);
                        setFormData({
                            name: '',
                            address: '',
                            latitude: -6.2,
                            longitude: 106.8,
                            radius: 50,
                            check_in_time: '08:00',
                            check_out_time: '17:00',
                            check_in_tolerance: 15,
                            check_out_tolerance: 15
                        });
                        setShowModal(true);
                    }}
                    className="group flex flex-col items-center justify-center gap-4 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl p-6 hover:border-cyan-500/50 hover:bg-slate-900 transition-all duration-300 min-h-[300px]"
                >
                    <div className="p-4 bg-slate-800 rounded-full group-hover:bg-cyan-500/20 text-slate-600 group-hover:text-cyan-400 transition-colors">
                        <Plus size={32} />
                    </div>
                    <span className="text-slate-500 font-medium group-hover:text-cyan-400">Tambah Kantor Baru</span>
                </button>
            </div>

            {offices.length === 0 && (
                <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 max-w-2xl mx-auto mt-10">
                    <Building className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Belum ada kantor</h3>
                    <p className="text-slate-400 mb-6">Mulai dengan menambahkan lokasi kantor pertama Anda</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Glow */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                        <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                            {editingOffice ? <Edit className="text-cyan-400" /> : <Plus className="text-cyan-400" />}
                            {editingOffice ? 'Edit Kantor' : 'Tambah Kantor Baru'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Nama Kantor</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition placeholder-slate-600"
                                    placeholder="Contoh: Kantor Pusat Jakarta"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Alamat Lengkap</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition placeholder-slate-600 resize-none"
                                    rows={3}
                                    placeholder="Jl. Jendral Sudirman No. 1..."
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 outline-none transition placeholder-slate-600 font-mono text-sm"
                                        value={formData.latitude}
                                        onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 outline-none transition placeholder-slate-600 font-mono text-sm"
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Radius Absensi (meter)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        min="10"
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 outline-none transition placeholder-slate-600 pl-12"
                                        value={formData.radius}
                                        onChange={e => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Crosshair size={18} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Jam Masuk</label>
                                    <input
                                        type="time"
                                        required
                                        className="w-full bg-transparent border-b border-slate-700 pb-1 text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                                        value={formData.check_in_time}
                                        onChange={e => setFormData({ ...formData, check_in_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Toleransi (mnt)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        className="w-full bg-transparent border-b border-slate-700 pb-1 text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                                        value={formData.check_in_tolerance}
                                        onChange={e => setFormData({ ...formData, check_in_tolerance: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Jam Pulang</label>
                                    <input
                                        type="time"
                                        required
                                        className="w-full bg-transparent border-b border-slate-700 pb-1 text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                                        value={formData.check_out_time}
                                        onChange={e => setFormData({ ...formData, check_out_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Toleransi (mnt)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        className="w-full bg-transparent border-b border-slate-700 pb-1 text-white focus:border-cyan-500 focus:outline-none transition font-mono"
                                        value={formData.check_out_tolerance}
                                        onChange={e => setFormData({ ...formData, check_out_tolerance: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

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
                </div >
            )}
        </div >
    );
};
