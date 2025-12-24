import { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Camera } from 'lucide-react';
import type { User, CreateUserRequest, UpdateUserRequest } from '../api/client';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    onSubmit: (data: CreateUserRequest | UpdateUserRequest, file?: File | null) => Promise<void>;
    isLoading: boolean;
}

export default function UserFormModal({ isOpen, onClose, user, onSubmit, isLoading }: UserFormModalProps) {
    const [name, setName] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'hr' | 'employee'>('employee');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState('');

    // Avatar state
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setEmployeeId(user.employee_id);
            setEmail(user.email);
            setRole(user.role);
            setIsActive(user.is_active);
            setPassword('');
            setPreviewUrl(user.avatar_url ? user.avatar_url : '');
        } else {
            setName('');
            setEmployeeId('');
            setEmail('');
            setRole('employee');
            setIsActive(true);
            setPassword('');
            setPreviewUrl('');
        }
        setAvatarFile(null);
        setError('');
    }, [user, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (user) {
                // Update
                const data: UpdateUserRequest = {
                    name,
                    email,
                    role,
                    is_active: isActive,
                };
                if (password) {
                    data.password = password;
                }
                await onSubmit(data, avatarFile);
            } else {
                // Create
                if (!password) {
                    setError('Password wajib diisi untuk user baru');
                    return;
                }
                const data: CreateUserRequest = {
                    employee_id: employeeId,
                    name,
                    email,
                    password,
                    role,
                };
                await onSubmit(data, avatarFile);
            }
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Gagal menyimpan data user');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {user ? 'Edit User' : 'Tambah User Baru'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className={`w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ${!previewUrl ? 'bg-cyan-100 flex items-center justify-center' : ''}`}>
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl text-cyan-600 font-bold">
                                            {name ? name.charAt(0).toUpperCase() : '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <Camera className="text-white" size={24} />
                                </div>
                                <div className="absolute bottom-0 right-0 bg-cyan-500 p-1.5 rounded-full border-2 border-white shadow-sm">
                                    <Camera className="text-white" size={14} />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <p className="text-xs text-slate-500 mt-2">Klik foto untuk mengubah</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Employee ID
                                </label>
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    disabled={!!user} // Cannot change ID after creation
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                    placeholder="EMP001"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                                >
                                    <option value="employee">Employee</option>
                                    <option value="hr">HR</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nama Lengkap
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                                placeholder="email@company.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Password {user && <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                                placeholder={user ? "••••••••" : "Min. 6 karakter"}
                                required={!user}
                                minLength={6}
                            />
                        </div>

                        {user && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="w-4 h-4 text-cyan-500 border-slate-300 rounded focus:ring-cyan-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-slate-700">
                                    Akun Aktif
                                </label>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Simpan
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
