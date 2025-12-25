// Transfer Requests Page - Admin
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import { MapPin, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface TransferRequest {
    id: string;
    user_id: string;
    current_office_lat: number;
    current_office_long: number;
    requested_office_lat: number;
    requested_office_long: number;
    requested_radius: number;
    reason: string;
    status: string;
    admin_note: string;
    created_at: string;
    user?: {
        id: string;
        name: string;
        employee_id: string;
        email: string;
    };
}

export default function TransferRequestsPage() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['transferRequests'],
        queryFn: async () => {
            const res = await adminAPI.getTransferRequests();
            return res.data.requests || [];
        },
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => adminAPI.approveTransferRequest(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transferRequests'] });
            setSelectedRequest(null);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, note }: { id: string; note: string }) =>
            adminAPI.rejectTransferRequest(id, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transferRequests'] });
            setSelectedRequest(null);
            setRejectNote('');
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

    const formatCoords = (lat: number, lng: number) =>
        `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MapPin className="text-cyan-500" />
                    Permintaan Pindah Lokasi
                </h1>
                <p className="text-slate-400 mt-1">
                    Approve atau tolak permintaan pindah lokasi kantor dari karyawan
                </p>
            </div>

            {/* Stats */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="text-amber-500" size={20} />
                <span className="text-amber-500">
                    <strong>{data?.length || 0}</strong> permintaan menunggu persetujuan
                </span>
            </div>

            {/* Requests List */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : data?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <MapPin size={48} className="mx-auto mb-4 text-slate-700" />
                        <p>Tidak ada permintaan pindah lokasi</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {data?.map((request: TransferRequest) => (
                            <div
                                key={request.id}
                                className="p-4 hover:bg-slate-800/50 cursor-pointer transition"
                                onClick={() => setSelectedRequest(request)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-cyan-900/30 rounded-full flex items-center justify-center">
                                            <MapPin className="text-cyan-500" size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">
                                                {request.user?.name || 'Unknown'}
                                            </p>
                                            <p className="text-sm text-slate-400">
                                                {request.user?.employee_id} • {request.user?.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-400 flex items-center gap-1">
                                                <Clock size={14} />
                                                {formatDate(request.created_at)}
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

            {/* Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
                    <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {selectedRequest.user?.name}
                                    </h2>
                                    <p className="text-slate-400">
                                        {selectedRequest.user?.employee_id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                                    <p className="text-xs text-slate-500 mb-1">Lokasi Saat Ini</p>
                                    <p className="font-mono text-sm text-slate-300">
                                        {formatCoords(selectedRequest.current_office_lat, selectedRequest.current_office_long)}
                                    </p>
                                </div>
                                <div className="bg-cyan-900/10 rounded-lg p-3 border border-cyan-900/20">
                                    <p className="text-xs text-cyan-500 mb-1">Lokasi Baru</p>
                                    <p className="font-mono text-sm text-white">
                                        {formatCoords(selectedRequest.requested_office_lat, selectedRequest.requested_office_long)}
                                    </p>
                                    <p className="text-xs text-cyan-500 mt-1">
                                        Radius: {selectedRequest.requested_radius}m
                                    </p>
                                </div>
                            </div>

                            {selectedRequest.reason && (
                                <div>
                                    <p className="text-sm text-slate-400 mb-1">Alasan:</p>
                                    <p className="text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-3">
                                        {selectedRequest.reason}
                                    </p>
                                </div>
                            )}

                            {/* Reject Note */}
                            <div>
                                <label className="text-sm text-slate-400 block mb-2">
                                    Catatan Penolakan (opsional)
                                </label>
                                <input
                                    type="text"
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    placeholder="Contoh: Lokasi tidak valid..."
                                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-800 flex gap-4 bg-slate-950/30">
                            <button
                                onClick={() => rejectMutation.mutate({ id: selectedRequest.id, note: rejectNote })}
                                disabled={rejectMutation.isPending}
                                className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 flex items-center justify-center gap-2 transition"
                            >
                                <X size={18} />
                                {rejectMutation.isPending ? 'Menolak...' : 'Tolak'}
                            </button>
                            <button
                                onClick={() => approveMutation.mutate(selectedRequest.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition"
                            >
                                <Check size={18} />
                                {approveMutation.isPending ? 'Menyetujui...' : 'Setujui'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
