import { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Camera, Eye, EyeOff } from 'lucide-react';
import { adminAPI, employeeAPI, getUploadUrl, type User, type CreateUserRequest, type UpdateUserRequest, type Office, type Employee } from '../api/client';


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
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState<'admin' | 'hr' | 'employee'>('employee');
    const [isActive, setIsActive] = useState(true);
    const [resetFace, setResetFace] = useState(false);
    const [error, setError] = useState('');
    const [officeId, setOfficeId] = useState<string>('');
    const [offices, setOffices] = useState<Office[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Avatar state
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch offices when modal opens
    useEffect(() => {
        if (isOpen) {
            Promise.all([
                adminAPI.getOffices(),
                employeeAPI.getEmployees()
            ]).then(([officeRes, empRes]) => {
                setOffices(officeRes.data.offices || []);
                // Filter employees who don't have a user account yet (optional, or just show all)
                // Ideally backend should provide a filtered list, but for now show all active employees
                setEmployees(empRes.data.employees || []);
            }).catch(err => console.error('Failed to fetch data:', err));
        }
    }, [isOpen]);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setEmployeeId(user.employee_id);
            setEmail(user.email);
            setRole(user.role);
            setIsActive(user.is_active);
            setPassword('');
            setPreviewUrl(user.avatar_url ? getUploadUrl(user.avatar_url)! : '');
            setOfficeId(user.office_id || '');
            setResetFace(false);
        } else {
            setName('');
            setEmployeeId('');
            setEmail('');
            setRole('employee');
            setIsActive(true);
            setPassword('');
            setPreviewUrl('');
            setOfficeId('');
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
                    office_id: officeId || undefined,
                };
                // If updating an employee user, ensure employee_id is not changed or handled correctly
                // Generally ID shouldn't change.

                if (password) {
                    data.password = password;
                }
                if (resetFace) {
                    data.face_verification_status = 'none';
                }
                await onSubmit(data, avatarFile);
            } else {
                // Create
                if (!password) {
                    setError('Password wajib diisi untuk user baru');
                    return;
                }

                // If role is employee, employeeId comes from selection, name is auto-filled
                // Validation happens on backend too

                const data: CreateUserRequest = {
                    employee_id: employeeId,
                    name,
                    email,
                    password,
                    role,
                    office_id: officeId || undefined,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <h2 className="text-lg font-semibold text-white">
                        {user ? 'Edit User' : 'Tambah User Baru'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className={`w-24 h-24 rounded-full overflow-hidden border-4 border-slate-800 shadow-lg ${!previewUrl ? 'bg-cyan-900/30 flex items-center justify-center' : ''}`}>
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl text-cyan-500 font-bold">
                                            {name ? name.charAt(0).toUpperCase() : '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <Camera className="text-white" size={24} />
                                </div>
                                <div className="absolute bottom-0 right-0 bg-cyan-500 p-1.5 rounded-full border-2 border-slate-900 shadow-sm">
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
                            <p className="text-xs text-slate-400 mt-2">Klik foto untuk mengubah</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Employee ID
                                </label>
                                <input
                                    type="text"
                                    value={employeeId}
                                    readOnly
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 disabled:bg-slate-900 disabled:text-slate-600 text-slate-400 cursor-not-allowed"
                                    placeholder="Auto-filled from Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">
                                    Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                                >
                                    <option value="employee">Employee</option>
                                    <option value="hr">HR</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Kantor
                            </label>
                            <select
                                value={officeId}
                                onChange={(e) => setOfficeId(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                            >
                                <option value="">-- Pilih Kantor --</option>
                                {offices.map(office => (
                                    <option key={office.id} value={office.id}>
                                        {office.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Nama Karyawan
                            </label>
                            <select
                                value={employees.find(e => e.nik === employeeId)?.id || ''}
                                onChange={(e) => {
                                    const empId = e.target.value;
                                    const emp = employees.find(emp => emp.id === empId);
                                    if (emp) {
                                        setName(emp.name);
                                        setEmployeeId(emp.nik);
                                    } else {
                                        // Handle case where selection is cleared (if we add a "clear" option)
                                        // For now, assume mandatory selection if we want to enforce linking
                                    }
                                }}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                                disabled={false} // Always selectable? Or disabled if editing? User said "Name... is select".
                            >
                                <option value="">-- Pilih Karyawan --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.nik})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600 transition"
                                placeholder="email@company.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Password {user && <span className="text-slate-600 font-normal">(Kosongkan jika tidak diubah)</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600 transition pr-10"
                                    placeholder={user ? "••••••••" : "Min. 6 karakter"}
                                    required={!user}
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {user && (
                            <div className="flex flex-col gap-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-4 h-4 text-cyan-500 border-slate-600 rounded focus:ring-cyan-500 bg-slate-950"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-slate-300">
                                        Akun Aktif
                                    </label>
                                </div>

                                {/* Face Verification Status Section */}
                                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-slate-400">Status Verifikasi Wajah</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${user.face_verification_status === 'verified'
                                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                                : user.face_verification_status === 'rejected'
                                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                    : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                            }`}>
                                            {user.face_verification_status?.toUpperCase() || 'NONE'}
                                        </span>
                                    </div>

                                    {user.face_verification_status === 'verified' && (
                                        <label className="flex items-center gap-2 cursor-pointer group mt-2 pt-2 border-t border-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={resetFace}
                                                onChange={e => setResetFace(e.target.checked)}
                                                className="w-4 h-4 text-red-500 border-slate-600 rounded focus:ring-red-500 bg-slate-950"
                                            />
                                            <span className="text-sm text-slate-400 group-hover:text-red-400 transition">Reset Status (Perlu Registrasi Ulang)</span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="pt-6 flex justify-end gap-3 border-t border-slate-800 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition font-medium"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-cyan-900/20 active:scale-95"
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
