import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../api/client';
import type { Office, User } from '../../api/client';
import { Building, CheckCircle, MapPin, Search, Send } from 'lucide-react';

export default function TransferRequestsView() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedOffice, setSelectedOffice] = useState<string>('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Fetch all users
    const { data: usersData } = useQuery({
        queryKey: ['users-for-transfer', search],
        queryFn: async () => {
            const res = await adminAPI.getUsers({ name: search, limit: 100 });
            return res.data;
        },
    });

    // Fetch all offices
    const { data: officesData } = useQuery({
        queryKey: ['offices'],
        queryFn: async () => {
            const res = await adminAPI.getOffices();
            return res.data;
        },
    });

    const users: User[] = usersData?.data || [];
    const offices: Office[] = officesData?.offices || [];

    // Mutation to update user's office
    const updateMutation = useMutation({
        mutationFn: async ({ userId, officeId }: { userId: string; officeId: string }) => {
            return adminAPI.updateUser(userId, { office_id: officeId });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            const office = offices.find(o => o.id === variables.officeId);
            setSuccessMessage(`${selectedUser?.name} berhasil dipindahkan ke ${office?.name}`);
            setSelectedUser(null);
            setSelectedOffice('');
            setReason('');
            setTimeout(() => setSuccessMessage(''), 5000);
        },
    });

    const handleSubmit = async () => {
        if (!selectedUser || !selectedOffice) {
            alert('Pilih karyawan dan kantor tujuan');
            return;
        }

        setIsSubmitting(true);
        try {
            await updateMutation.mutateAsync({ userId: selectedUser.id, officeId: selectedOffice });
        } catch (error) {
            alert('Gagal memindahkan karyawan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectUser = (user: User) => {
        setSelectedUser(user);
        setSearch('');
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MapPin className="text-cyan-500" />
                    Pindah Kantor
                </h1>
                <p className="text-slate-400 mt-1">
                    Pindahkan karyawan ke kantor/lokasi yang berbeda
                </p>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <CheckCircle className="text-emerald-500" size={20} />
                    <span className="text-emerald-400">{successMessage}</span>
                </div>
            )}

            {/* Form */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
                {/* Step 1: Select Employee */}
                <div>
                    <label className="block text-sm text-slate-400 mb-2">
                        1. Pilih Karyawan
                    </label>
                    {selectedUser ? (
                        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                                    <span className="text-cyan-400 font-bold">
                                        {selectedUser.name?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-white font-medium">{selectedUser.name}</p>
                                    <p className="text-slate-400 text-sm">
                                        {selectedUser.employee_id} • {selectedUser.office?.name || 'Belum ada kantor'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="text-slate-400 hover:text-white text-sm"
                            >
                                Ganti
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="Cari nama karyawan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                            {search && users.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-10">
                                    {users.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleSelectUser(user)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-3 transition"
                                        >
                                            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-sm text-white">
                                                {user.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-white">{user.name}</p>
                                                <p className="text-slate-400 text-xs">
                                                    {user.employee_id} • {user.office?.name || '-'}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Step 2: Select Target Office */}
                <div>
                    <label className="block text-sm text-slate-400 mb-2">
                        2. Kantor Tujuan
                    </label>
                    <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <select
                            value={selectedOffice}
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white appearance-none focus:outline-none focus:border-cyan-500"
                        >
                            <option value="">Pilih Kantor Tujuan</option>
                            {offices.map((office) => (
                                <option key={office.id} value={office.id}>
                                    {office.name} - {office.address}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedOffice && (
                        <div className="mt-2 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                            {(() => {
                                const office = offices.find(o => o.id === selectedOffice);
                                return office ? (
                                    <div className="text-sm">
                                        <p className="text-cyan-400 font-medium">{office.name}</p>
                                        <p className="text-slate-400 text-xs mt-1">{office.address}</p>
                                        <p className="text-slate-500 text-xs mt-1">
                                            Koordinat: {office.latitude.toFixed(6)}, {office.longitude.toFixed(6)} • Radius: {office.radius}m
                                        </p>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>

                {/* Step 3: Reason (Optional) */}
                <div>
                    <label className="block text-sm text-slate-400 mb-2">
                        3. Alasan Perpindahan (Opsional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Contoh: Rotasi karyawan, pembukaan cabang baru, dll..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!selectedUser || !selectedOffice || isSubmitting}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/20"
                >
                    <Send size={18} />
                    {isSubmitting ? 'Memproses...' : 'Pindahkan Karyawan'}
                </button>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                <p className="text-slate-500 text-sm">
                    💡 Setelah dipindahkan, karyawan akan menggunakan koordinat dan radius kantor baru untuk absensi.
                </p>
            </div>
        </div>
    );
}
