import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI, employeeAPI, getUploadUrl } from '../../api/client';
import type { User, CreateUserRequest, UpdateUserRequest, Office } from '../../api/client';
import { useDebounce } from '../../hooks';
import { extractArray } from '../../utils/helpers';
import { Plus, Edit, Trash2, UserCheck, UserX, QrCode, Download, X, Eye, Filter, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import UserFormModal from '../../components/UserFormModal';
import UserDetailModal from '../../components/users/UserDetailModal';
import EmployeeFilters from '../../components/employees/EmployeeFilters';
import AdvancedFilterBuilder, { type DynamicFilter } from '../../components/employees/AdvancedFilterBuilder';
import SortableHeader, { type SortConfig } from '../../components/SortableHeader';
import PageHeader from '../../components/PageHeader';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';

export default function UsersView() {
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebounce(searchInput, 300);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [detailUser, setDetailUser] = useState<User | null>(null);
    const [qrUser, setQrUser] = useState<User | null>(null);
    const qrRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        office_id: '',
        position: '',
        employment_status: '',
        gender: '',
        face_verification_status: ''
    });
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                if (prev.direction === 'desc') return { key: '', direction: null };
            }
            return { key, direction: 'asc' };
        });
    };

    const { data: officesData } = useQuery({
        queryKey: ['offices'],
        queryFn: async () => {
            const res = await adminAPI.getOffices();
            return res.data;
        },
    });
    const offices = extractArray<Office>(officesData, 'offices', 'data');

    const { data: positionsRes } = useQuery({
        queryKey: ['positions'],
        queryFn: async () => {
            const res = await employeeAPI.getPositions();
            return res.data;
        },
    });
    const positions = extractArray<string>(positionsRes, 'positions', 'data');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['users', page, debouncedSearch, filters, dynamicFilters, sortConfig],
        queryFn: async () => {
            console.log('Fetching users...');
            const res = await adminAPI.getUsers({
                limit: 10,
                offset: (page - 1) * 10,
                name: debouncedSearch,
                filters: JSON.stringify(dynamicFilters),
                sort_by: sortConfig.key || undefined,
                sort_order: sortConfig.direction || undefined,
                ...filters
            });
            return res.data;
        },
    });

    const users = extractArray<User>(data, 'data', 'users');
    const total = data?.total ?? data?.count ?? users.length;
    const totalPages = Math.max(1, Math.ceil(total / 10));
    // ...

    // ... inside return


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

    // Filtered locally before, now handled by server
    const filteredUsers = users;

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            admin: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
            hr: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
            employee: 'bg-slate-800 text-slate-400 border border-slate-700',
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

    const handleDownloadQR = () => {
        if (!qrRef.current || !qrUser) return;
        const svg = qrRef.current.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = 300;
            canvas.height = 350;
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height); // QR works best on white
                ctx.drawImage(img, 50, 30, 200, 200);
                ctx.fillStyle = 'black';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(qrUser.name, 150, 270);
                ctx.font = '14px monospace';
                ctx.fillText(qrUser.employee_id, 150, 295);
            }

            const link = document.createElement('a');
            link.download = `QR-${qrUser.employee_id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
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
            <PageHeader
                title="Manajemen User"
                subtitle="Kelola data karyawan"
                badge={total}
                action={
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition shadow-lg shadow-cyan-500/20"
                    >
                        <Plus size={18} />
                        Tambah User
                    </button>
                }
            />

            {/* Search */}
            <div className="mb-6">
                <SearchInput
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Cari nama, email, atau ID..."
                    className="max-w-md"
                />
            </div>

            {/* Advanced Filters */}
            <div className="mb-6">
                <EmployeeFilters
                    offices={offices || []}
                    positions={positions}
                    filters={filters}
                    onChange={(key, value) => {
                        setFilters(prev => ({ ...prev, [key]: value }));
                        setPage(1);
                    }}
                    onReset={() => {
                        setFilters({ office_id: '', position: '', employment_status: '', gender: '', face_verification_status: '' });
                        setPage(1);
                    }}
                />

                <div className="mb-4">
                    <button
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                    >
                        <Filter size={14} />
                        {showAdvancedFilter ? 'Sembunyikan Filter Custom' : 'Tampilkan Filter Custom'}
                    </button>
                </div>

                {showAdvancedFilter && (
                    <AdvancedFilterBuilder
                        filters={dynamicFilters}
                        onChange={(f) => {
                            setDynamicFilters(f);
                            setPage(1);
                        }}
                        onClose={() => setShowAdvancedFilter(false)}
                    />
                )}
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                {isError ? (
                    <div className="p-8 text-center text-red-400">
                        <AlertCircle className="mx-auto mb-2" size={32} />
                        <p>Gagal memuat data users.</p>
                        <p className="text-sm mt-2 text-red-500/70">{error instanceof Error ? error.message : 'Unknown error'}</p>
                    </div>
                ) : isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500 mb-4"></div>
                        Loading Users...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-950/50">
                                <tr>
                                    <SortableHeader label="Karyawan" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="ID" sortKey="employee_id" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Email" sortKey="email" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Role" sortKey="role" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Status" sortKey="is_active" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Wajah" sortKey="face_verification_status" currentSort={sortConfig} onSort={handleSort} />
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {users?.map((user: User) => (
                                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-cyan-900/30 rounded-full flex items-center justify-center text-cyan-400 font-semibold overflow-hidden border border-cyan-800/30">
                                                    {user.avatar_url ? (
                                                        <img
                                                            src={getUploadUrl(user.avatar_url)!}
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
                                                <span className="font-medium text-white">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-sm">
                                            {user.employee_id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadge(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.is_active ? (
                                                <span className="flex items-center gap-1 text-emerald-400">
                                                    <UserCheck size={16} /> Aktif
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-500">
                                                    <UserX size={16} /> Nonaktif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.face_verification_status === 'verified' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">✓ Verified</span>
                                            ) : user.face_verification_status === 'pending' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">⏳ Pending</span>
                                            ) : user.face_verification_status === 'rejected' ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-400 rounded-full border border-red-500/20">✗ Rejected</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-500 rounded-full border border-slate-700">— Belum</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => setDetailUser(user)}
                                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition mr-1"
                                                title="Detail"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => setQrUser(user)}
                                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition mr-1"
                                                title="QR Code"
                                            >
                                                <QrCode size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition mr-1"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id, user.name)}
                                                className="p-2 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!filteredUsers || filteredUsers.length === 0) && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                            {debouncedSearch ? 'Tidak ada user yang cocok' : 'Belum ada data user'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                className="mt-4"
            />

            <UserFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSubmit={handleSubmit}
                isLoading={createMutation.isPending || updateMutation.isPending}
            />

            {/* QR Code Modal - Dark Theme */}
            {qrUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                    {/* ... (QR Modal content, omitted for brevity in replace check, but functionally same place) ... */}
                    {/* Actually, replacing the end of file, let's just append the detail modal before the closing div */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">QR Code</h3>
                            <button onClick={() => setQrUser(null)} className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center bg-white p-6 rounded-lg" ref={qrRef}>
                            <QRCodeSVG value={qrUser.employee_id} size={180} />
                            <p className="mt-4 font-semibold text-slate-900">{qrUser.name}</p>
                            <p className="text-slate-500 font-mono">{qrUser.employee_id}</p>
                        </div>
                        <button
                            onClick={handleDownloadQR}
                            className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg transition font-medium"
                        >
                            <Download size={18} />
                            Download PNG
                        </button>
                    </div>
                </div>
            )}

            <UserDetailModal
                isOpen={!!detailUser}
                onClose={() => setDetailUser(null)}
                user={detailUser}
            />
        </div>
    );
}
