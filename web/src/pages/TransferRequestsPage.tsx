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
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="text-cyan-500" />
                    Permintaan Pindah Lokasi
                </h1>
                <p className="text-slate-500 mt-1">
                    Approve atau tolak permintaan pindah lokasi kantor dari karyawan
                </p>
            </div>

            {/* Stats */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="text-amber-500" size={20} />
                <span className="text-amber-700">
                    <strong>{data?.length || 0}</strong> permintaan menunggu persetujuan
                </span>
            </div>

            {/* Requests List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : data?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <MapPin size={48} className="mx-auto mb-4 text-slate-300" />
                        <p>Tidak ada permintaan pindah lokasi</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {data?.map((request: TransferRequest) => (
                            <div
                                key={request.id}
                                className="p-4 hover:bg-slate-50 cursor-pointer transition"
                                onClick={() => setSelectedRequest(request)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                                            <MapPin className="text-cyan-600" size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">
                                                {request.user?.name || 'Unknown'}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                {request.user?.employee_id} • {request.user?.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                                <Clock size={14} />
                                                {formatDate(request.created_at)}
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

            {/* Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {selectedRequest.user?.name}
                                    </h2>
                                    <p className="text-slate-500">
                                        {selectedRequest.user?.employee_id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500 mb-1">Lokasi Saat Ini</p>
                                    <p className="font-mono text-sm">
                                        {formatCoords(selectedRequest.current_office_lat, selectedRequest.current_office_long)}
                                    </p>
                                </div>
                                <div className="bg-cyan-50 rounded-lg p-3">
                                    <p className="text-xs text-cyan-600 mb-1">Lokasi Baru</p>
                                    <p className="font-mono text-sm">
                                        {formatCoords(selectedRequest.requested_office_lat, selectedRequest.requested_office_long)}
                                    </p>
                                    <p className="text-xs text-cyan-600 mt-1">
                                        Radius: {selectedRequest.requested_radius}m
                                    </p>
                                </div>
                            </div>

                            {selectedRequest.reason && (
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Alasan:</p>
                                    <p className="text-slate-700 bg-slate-50 rounded-lg p-3">
                                        {selectedRequest.reason}
                                    </p>
                                </div>
                            )}

                            {/* Reject Note */}
                            <div>
                                <label className="text-sm text-slate-600 block mb-2">
                                    Catatan Penolakan (opsional)
                                </label>
                                <input
                                    type="text"
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    placeholder="Contoh: Lokasi tidak valid..."
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => rejectMutation.mutate({ id: selectedRequest.id, note: rejectNote })}
                                disabled={rejectMutation.isPending}
                                className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 flex items-center justify-center gap-2"
                            >
                                <X size={18} />
                                {rejectMutation.isPending ? 'Menolak...' : 'Tolak'}
                            </button>
                            <button
                                onClick={() => approveMutation.mutate(selectedRequest.id)}
                                disabled={approveMutation.isPending}
                                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 flex items-center justify-center gap-2"
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
