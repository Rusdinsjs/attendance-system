// Users Management Page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import type { User, CreateUserRequest, UpdateUserRequest } from '../api/client';
import { Search, Plus, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import UserFormModal from '../components/UserFormModal';

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await adminAPI.getUsers();
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: adminAPI.createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
            adminAPI.updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: adminAPI.deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const filteredUsers = users?.filter((user: User) =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.employee_id.toLowerCase().includes(search.toLowerCase())
    );

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            admin: 'bg-purple-100 text-purple-700',
            hr: 'bg-blue-100 text-blue-700',
            employee: 'bg-slate-100 text-slate-700',
        };
        return styles[role] || styles.employee;
    };

    const handleOpenCreate = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Apakah Anda yakin ingin menghapus user ${name}?`)) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (err) {
                alert('Gagal menghapus user');
            }
        }
    };

    const handleSubmit = async (data: CreateUserRequest | UpdateUserRequest, file?: File | null) => {
        let userId = '';
        if (selectedUser) {
            await updateMutation.mutateAsync({
                id: selectedUser.id,
                data: data as UpdateUserRequest
            });
            userId = selectedUser.id;
        } else {
            const res = await createMutation.mutateAsync(data as CreateUserRequest);
            // The API response contains the user object in data field
            userId = res.data.id;
        }

        if (file && userId) {
            try {
                await adminAPI.uploadAvatar(userId, file);
                queryClient.invalidateQueries({ queryKey: ['users'] });
            } catch (error) {
                console.error("Failed to upload avatar", error);
                alert("User saved but avatar upload failed");
            }
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Manajemen User</h1>
                    <p className="text-slate-500 mt-1">Kelola data karyawan</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition"
                >
                    <Plus size={18} />
                    Tambah User
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama, email, atau ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Karyawan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Wajah</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers?.map((user: User) => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-semibold overflow-hidden">
                                                    {user.avatar_url ? (
                                                        <img
                                                            src={user.avatar_url}
                                                            alt={user.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                (e.target as HTMLImageElement).parentElement!.classList.remove('overflow-hidden');
                                                                (e.target as HTMLImageElement).parentElement!.innerText = user.name.charAt(0).toUpperCase();
                                                            }}
                                                        />
                                                    ) : (
                                                        user.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <span className="font-medium text-slate-900">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-sm">
                                            {user.employee_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadge(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.is_active ? (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <UserCheck size={16} /> Aktif
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <UserX size={16} /> Nonaktif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.face_verification_status === 'verified' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">✓ Verified</span>
                                            ) : user.face_verification_status === 'pending' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">⏳ Pending</span>
                                            ) : user.face_verification_status === 'rejected' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">✗ Rejected</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">— Belum</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-cyan-600 transition mr-2"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id, user.name)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-slate-600 hover:text-red-600 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!filteredUsers || filteredUsers.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            {search ? 'Tidak ada user yang cocok' : 'Belum ada data user'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSubmit={handleSubmit}
                isLoading={createMutation.isPending || updateMutation.isPending}
            />
        </div>
    );
}
