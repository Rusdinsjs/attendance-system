// Attendance Reports Page
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import type { Attendance } from '../api/client';
import { Calendar, Download, Filter } from 'lucide-react';

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });

    const { data: attendances, isLoading } = useQuery({
        queryKey: ['todayAttendance'],
        queryFn: async () => {
            const res = await adminAPI.getTodayAttendance();
            return res.data.attendances || [];
        },
    });

    const formatTime = (time: string | null) => {
        if (!time) return '-';
        return new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (time: string | null) => {
        if (!time) return '-';
        return new Date(time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const exportToCSV = () => {
        if (!attendances || attendances.length === 0) return;

        const headers = ['Tanggal', 'Nama', 'Check In', 'Check Out', 'Status'];
        const rows = attendances.map((a: Attendance) => [
            formatDate(a.check_in_time),
            a.user_name || '',
            formatTime(a.check_in_time),
            formatTime(a.check_out_time),
            a.is_late ? 'Terlambat' : 'Hadir',
        ]);

        const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${dateRange.start}.csv`;
        a.click();
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Laporan Kehadiran</h1>
                    <p className="text-slate-500 mt-1">Export dan analisis data kehadiran</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="text-sm text-slate-600">Tanggal:</span>
                    </div>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                    <span className="text-slate-400">—</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    />
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">
                        <Filter size={16} />
                        Filter
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500">Total Kehadiran</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{attendances?.length || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500">Tepat Waktu</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                        {attendances?.filter((a: Attendance) => a.check_in_time && !a.is_late)?.length || 0}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500">Terlambat</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">
                        {attendances?.filter((a: Attendance) => a.is_late)?.length || 0}
                    </p>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nama</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Check In</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Check Out</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Durasi</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attendances?.map((a: Attendance) => {
                                    const duration = a.check_in_time && a.check_out_time
                                        ? Math.round((new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 3600000 * 10) / 10
                                        : null;

                                    return (
                                        <tr key={a.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                                {formatDate(a.check_in_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                                                {a.user?.name || a.user_name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                                {formatTime(a.check_in_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                                {formatTime(a.check_out_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                                {duration ? `${duration} jam` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {a.is_late ? (
                                                    <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Terlambat</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Tepat Waktu</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!attendances || attendances.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            Tidak ada data untuk periode ini
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
