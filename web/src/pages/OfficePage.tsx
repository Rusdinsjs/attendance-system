import React, { useState, useEffect } from 'react';
import { adminAPI, type Office } from '../api/client';
import { MapPin, Plus, Edit2, Trash2, Building } from 'lucide-react';
import Swal from 'sweetalert2';

const OfficePage: React.FC = () => {
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
    });

    useEffect(() => {
        fetchOffices();
    }, []);

    const fetchOffices = async () => {
        try {
            const response = await adminAPI.getOffices();
            setOffices(response.data.offices);
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

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Hapus Kantor?',
            text: 'Data yang dihapus tidak dapat dikembalikan!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await adminAPI.deleteOffice(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Terhapus',
                    text: 'Kantor berhasil dihapus',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchOffices();
            } catch (error) {
                Swal.fire('Error', 'Gagal menghapus kantor', 'error');
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
            setFormData({ name: '', address: '', latitude: -6.2, longitude: 106.8, radius: 50 });
            fetchOffices();
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: editingOffice ? 'Kantor diperbarui' : 'Kantor ditambahkan',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Error', 'Gagal menyimpan data', 'error');
        }
    };

    if (loading) return <div className="p-8"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div></div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building className="w-8 h-8 text-blue-600" />
                        Lokasi Kantor
                    </h1>
                    <p className="text-gray-500">Kelola daftar lokasi kantor untuk absensi</p>
                </div>
                <button
                    onClick={() => {
                        setEditingOffice(null);
                        setFormData({ name: '', address: '', latitude: -6.2, longitude: 106.8, radius: 50 });
                        setShowModal(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Tambah Kantor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {offices.map((office) => (
                    <div key={office.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <MapPin className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(office)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(office.id)} className="p-2 hover:bg-red-50 rounded-full text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{office.name}</h3>
                        <p className="text-gray-500 text-sm mb-4 h-10 line-clamp-2">{office.address || 'Alamat tidak tersedia'}</p>

                        <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between">
                                <span>Latitude:</span>
                                <span className="font-mono">{office.latitude}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Longitude:</span>
                                <span className="font-mono">{office.longitude}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Radius:</span>
                                <span className="font-medium">{office.radius}m</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {offices.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Building className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Belum ada data kantor</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">
                            {editingOffice ? 'Edit Kantor' : 'Tambah Kantor Baru'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kantor</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.latitude}
                                        onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Radius Absensi (meter)</label>
                                <input
                                    type="number"
                                    required
                                    min="10"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.radius}
                                    onChange={e => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfficePage;
