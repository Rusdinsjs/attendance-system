// Attendance Reports Page
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import type { Attendance } from '../api/client';
import { Calendar, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });

    const [page, setPage] = useState(1);
    const limit = 10;

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['attendanceReport', dateRange, page],
        queryFn: async () => {
            const res = await adminAPI.getTodayAttendance({
                start_date: dateRange.start,
                end_date: dateRange.end,
                limit,
                offset: (page - 1) * limit
            });
            return res.data;
        },
    });

    const attendances = reportData?.attendances || [];
    const total = reportData?.total || 0;
    const totalPages = Math.ceil(total / limit);

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
                    <h1 className="text-2xl font-bold text-white">Laporan Kehadiran</h1>
                    <p className="text-slate-400 mt-1">Export dan analisis data kehadiran</p>
                </div>
                <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-lg shadow-green-900/20"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800 mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="text-sm text-slate-400">Tanggal:</span>
                    </div>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => {
                            setDateRange({ ...dateRange, start: e.target.value });
                            setPage(1);
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                    />
                    <span className="text-slate-500">—</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => {
                            setDateRange({ ...dateRange, end: e.target.value });
                            setPage(1);
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                    />
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition border border-slate-700">
                        <Filter size={16} />
                        Filter
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Total Kehadiran</p>
                    <p className="text-2xl font-bold text-white mt-1">{attendances?.length || 0}</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Tepat Waktu</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {attendances?.filter((a: Attendance) => a.check_in_time && !a.is_late)?.length || 0}
                    </p>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Terlambat</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">
                        {attendances?.filter((a: Attendance) => a.is_late)?.length || 0}
                    </p>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-950/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tanggal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nama</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check In</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check Out</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Durasi</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {attendances?.map((a: Attendance) => {
                                    const duration = a.check_in_time && a.check_out_time
                                        ? Math.round((new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 3600000 * 10) / 10
                                        : null;

                                    return (
                                        <tr key={a.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {formatDate(a.check_in_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                                {a.user?.name || a.user_name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {formatTime(a.check_in_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {formatTime(a.check_out_time)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {duration ? `${duration} jam` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {a.is_late ? (
                                                    <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">Terlambat</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">Tepat Waktu</span>
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
        </div>
    );
}
