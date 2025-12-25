import { X, User, Shield, Building, MapPin, Briefcase } from 'lucide-react';
import type { User as UserType } from '../../api/client';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserType | null;
}

export default function UserDetailModal({ isOpen, onClose, user }: UserDetailModalProps) {
    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white">Detail User</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 border border-white/10">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <User size={32} />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{user.name}</h3>
                            <div className="text-slate-400">{user.email}</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                                <Shield size={16} />
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Role Access</div>
                                <div className="font-medium capitalize">{user.role}</div>
                            </div>
                        </div>

                        {user.office && (
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                                    <Building size={16} />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">Kantor</div>
                                    <div className="font-medium">{user.office.name}</div>
                                </div>
                            </div>
                        )}

                        {user.employee && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mt-4">
                                <h4 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
                                    <Briefcase size={14} />
                                    Data Karyawan Terkait
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-slate-500">NIK</div>
                                        <div className="text-white font-medium">{user.employee.nik}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Posisi</div>
                                        <div className="text-white font-medium">{user.employee.position}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Status</div>
                                        <div className="text-white font-medium">{user.employee.employment_status}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">Lokasi</div>
                                        <div className="text-white font-medium flex items-center gap-1">
                                            <MapPin size={12} />
                                            {user.employee.office?.name || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900/50 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
