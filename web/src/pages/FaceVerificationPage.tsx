// Face Verification Page - Admin
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import { Check, X, User, Clock, AlertCircle, ImageIcon } from 'lucide-react';
import { useState } from 'react';

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

export default function FaceVerificationPage() {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<VerificationUser | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['faceVerifications'],
        queryFn: async () => {
            const res = await adminAPI.getFaceVerifications();
            return res.data.verifications || [];
        },
    });

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

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <User className="text-cyan-500" />
                    Verifikasi Wajah
                </h1>
                <p className="text-slate-500 mt-1">
                    Review dan verifikasi foto wajah yang diupload karyawan
                </p>
            </div>

            {/* Stats */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="text-amber-500" size={20} />
                <span className="text-amber-700">
                    <strong>{data?.length || 0}</strong> pengajuan menunggu verifikasi
                </span>
            </div>

            {/* Pending List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : data?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <ImageIcon size={48} className="mx-auto mb-4 text-slate-300" />
                        <p>Tidak ada pengajuan verifikasi</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {data?.map((user: VerificationUser) => (
                            <div
                                key={user.id}
                                className="p-4 hover:bg-slate-50 cursor-pointer transition"
                                onClick={() => setSelectedUser(user)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                                            <span className="text-cyan-600 font-bold text-lg">
                                                {user.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{user.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {user.employee_id} • {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                                <Clock size={14} />
                                                {formatDate(user.updated_at)}
                                            </p>
                                            <p className="text-sm text-cyan-600">
                                                {user.photos?.length || 0} foto
                                            </p>
                                        </div>
                                        <button className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600">
                                            Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Photo Preview Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {selectedUser.name}
                                    </h2>
                                    <p className="text-slate-500">
                                        {selectedUser.employee_id} • {selectedUser.email}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Photos Grid */}
                        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 250px)' }}>
                            <p className="text-sm text-slate-500 mb-4">
                                Periksa 5 foto berikut untuk verifikasi identitas:
                            </p>
                            <div className="grid grid-cols-5 gap-4">
                                {selectedUser.photos?.map((photo, idx) => (
                                    <div key={photo.id} className="relative">
                                        <img
                                            src={photo.photo_path}
                                            alt={`Face ${idx + 1}`}
                                            className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-200"
                                        />
                                        <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                            #{idx + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reject Reason */}
                        <div className="px-6 pb-4">
                            <label className="text-sm text-slate-600 block mb-2">
                                Alasan Penolakan (opsional)
                            </label>
                            <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Contoh: Foto tidak jelas, wajah tidak terlihat..."
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() =>
                                    rejectMutation.mutate({
                                        userId: selectedUser.id,
                                        reason: rejectReason,
                                    })
                                }
                                disabled={rejectMutation.isPending}
                                className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 flex items-center justify-center gap-2"
                            >
                                <X size={18} />
                                {rejectMutation.isPending ? 'Menolak...' : 'Tolak'}
                            </button>
                            <button
                                onClick={() => approveMutation.mutate(selectedUser.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2"
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
