// Face Verification Approvals Page
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI, getUploadUrl } from '../../api/client';
import { AlertCircle, User, Clock, ChevronLeft, ChevronRight, X, ImageIcon, Check } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

interface FacePhoto {
    id: string;
    photo_path: string;
    photo_order: number;
}

interface VerificationUser {
    id: string;
    employee_id: string;
    name: string;
    email: string;
    face_verification_status: string;
    updated_at: string;
    photos: FacePhoto[];
}

export default function FaceVerificationView() {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<VerificationUser | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const [page, setPage] = useState(1);
    const limit = 10;

    const { data: verificationData, isLoading } = useQuery({
        queryKey: ['faceVerifications', page],
        queryFn: async () => {
            const res = await adminAPI.getFaceVerifications({
                limit,
                offset: (page - 1) * limit
            });
            return res.data;
        },
    });

    const data = verificationData?.verifications || [];
    const total = verificationData?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const approveMutation = useMutation({
        mutationFn: (userId: string) => adminAPI.approveFaceVerification(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faceVerifications'] });
            setSelectedUser(null);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
            adminAPI.rejectFaceVerification(userId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faceVerifications'] });
            setSelectedUser(null);
            setRejectReason('');
        },
    });


    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <User className="text-cyan-500" />
                    Verifikasi Wajah
                </h1>
                <p className="text-slate-400 mt-1">
                    Review dan verifikasi foto wajah yang diupload karyawan
                </p>
            </div>

            {/* Stats */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="text-amber-500" size={20} />
                <span className="text-amber-500">
                    <strong>{data?.length || 0}</strong> pengajuan menunggu verifikasi
                </span>
            </div>

            {/* Pending List */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : data?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <ImageIcon size={48} className="mx-auto mb-4 text-slate-700" />
                        <p>Tidak ada pengajuan verifikasi</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {data?.map((user: VerificationUser) => (
                            <div
                                key={user.id}
                                className="p-4 hover:bg-slate-800/50 cursor-pointer transition"
                                onClick={() => setSelectedUser(user)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-cyan-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-cyan-500 font-bold text-lg">
                                                {user.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{user.name}</p>
                                            <p className="text-sm text-slate-400">
                                                {user.employee_id} • {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-400 flex items-center gap-1">
                                                <Clock size={14} />
                                                {formatDateTime(user.updated_at)}
                                            </p>
                                            <p className="text-sm text-cyan-500">
                                                {user.photos?.length || 0} foto
                                            </p>
                                        </div>
                                        <button className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-sm hover:bg-cyan-500/20 transition">
                                            Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && total > limit && (
                <div className="flex justify-end items-center gap-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-slate-400">
                        Halaman {page} dari {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Photo Preview Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
                    <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {selectedUser.name}
                                    </h2>
                                    <p className="text-slate-400">
                                        {selectedUser.employee_id} • {selectedUser.email}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Photos Grid */}
                        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 250px)' }}>
                            <p className="text-sm text-slate-400 mb-4">
                                Periksa 5 foto berikut untuk verifikasi identitas:
                            </p>
                            <div className="grid grid-cols-5 gap-4">
                                {selectedUser.photos?.map((photo, idx) => (
                                    <div key={photo.id} className="relative group">
                                        <img
                                            src={getUploadUrl(photo.photo_path)!}
                                            alt={`Face ${idx + 1} `}
                                            className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-700 transition group-hover:border-cyan-500"
                                        />
                                        <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            #{idx + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reject Reason */}
                        <div className="px-6 pb-4">
                            <label className="text-sm text-slate-400 block mb-2">
                                Alasan Penolakan (opsional)
                            </label>
                            <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Contoh: Foto tidak jelas, wajah tidak terlihat..."
                                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                            />
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-800 flex gap-4 bg-slate-950/30">
                            <button
                                onClick={() =>
                                    rejectMutation.mutate({
                                        userId: selectedUser.id,
                                        reason: rejectReason,
                                    })
                                }
                                disabled={rejectMutation.isPending}
                                className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 flex items-center justify-center gap-2 transition"
                            >
                                <X size={18} />
                                {rejectMutation.isPending ? 'Menolak...' : 'Tolak'}
                            </button>
                            <button
                                onClick={() => approveMutation.mutate(selectedUser.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition"
                            >
                                <Check size={18} />
                                {approveMutation.isPending ? 'Menyetujui...' : 'Setuju & Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
