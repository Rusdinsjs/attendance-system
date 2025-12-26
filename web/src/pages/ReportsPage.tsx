// Attendance Reports Page
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import { Calendar, Download, Filter, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });

    const [filters, setFilters] = useState({
        position: '',
        officeID: '',
        status: '',
    });

    const [sort, setSort] = useState({
        sortBy: 'check_in_time',
        sortOrder: 'DESC' as 'ASC' | 'DESC',
    });

    const [page, setPage] = useState(1);
    const limit = 10;

    // Fetch Offices for Filter
    const { data: officesData } = useQuery({
        queryKey: ['offices'],
        queryFn: async () => {
            const res = await adminAPI.getOffices({ limit: 100 });
            return res.data;
        }
    });
    const offices = officesData?.offices || [];

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['attendanceReport', dateRange, filters, sort, page],
        queryFn: async () => {
            const res = await adminAPI.getTodayAttendance({
                start_date: dateRange.start,
                end_date: dateRange.end,
                position: filters.position,
                office_id: filters.officeID,
                status: filters.status as 'late' | 'on_time' | undefined,
                sort_by: sort.sortBy,
                sort_order: sort.sortOrder,
                limit,
                offset: (page - 1) * limit
            });
            return res.data;
        },
    });

    const attendances = reportData?.attendances || [];
    const total = reportData?.total || 0;
    const totalPages = Math.ceil(total / limit);
    const summary = reportData?.summary || { total_present: 0, total_on_time: 0, total_late: 0 };

    const handleSort = (field: string) => {
        setSort(prev => ({
            sortBy: field,
            sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
        }));
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sort.sortBy !== field) return <div className="w-4 h-4" />;
        return sort.sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

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

        const headers = ['Tanggal', 'Nama', 'Jabatan', 'Kantor', 'Check In', 'Check Out', 'Status'];
        const rows = attendances.map((a: any) => [
            formatDate(a.check_in_time),
            a.user?.name || a.user_name || '',
            a.user?.employee?.position || '-',
            a.user?.office?.name || '-',
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
            <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800 mb-6 space-y-4">
                {/* Date Range */}
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
                </div>

                {/* Advanced Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-slate-400" />
                        <span className="text-sm text-slate-400">Filter:</span>
                    </div>

                    {/* Position Filter */}
                    <input
                        type="text"
                        placeholder="Jabatan..."
                        value={filters.position}
                        onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white placeholder-slate-600"
                    />

                    {/* Office Filter */}
                    <select
                        value={filters.officeID}
                        onChange={(e) => setFilters(prev => ({ ...prev, officeID: e.target.value }))}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                    >
                        <option value="">Semua Kantor</option>
                        {offices.map((office: any) => (
                            <option key={office.id} value={office.id}>{office.name}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none text-white appearance-none"
                    >
                        <option value="">Semua Status</option>
                        <option value="late">Terlambat</option>
                        <option value="on_time">Tepat Waktu</option>
                    </select>

                    <button
                        onClick={() => {
                            setFilters({ position: '', officeID: '', status: '' });
                            setSort({ sortBy: 'check_in_time', sortOrder: 'DESC' });
                        }}
                        className="text-sm text-cyan-400 hover:text-cyan-300 transition"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Total Kehadiran</p>
                    <p className="text-2xl font-bold text-white mt-1">{summary.total_present}</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Tepat Waktu</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                        {summary.total_on_time}
                    </p>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Terlambat</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">
                        {summary.total_late}
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
                            <thead className="bg-slate-950/50 text-xs text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th
                                        onClick={() => handleSort('check_in_time')}
                                        className="px-6 py-3 text-left font-medium cursor-pointer hover:text-white transition group select-none"
                                    >
                                        <div className="flex items-center gap-1">
                                            Tanggal & Jam
                                            <SortIcon field="check_in_time" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="px-6 py-3 text-left font-medium cursor-pointer hover:text-white transition group select-none"
                                    >
                                        <div className="flex items-center gap-1">
                                            Nama
                                            <SortIcon field="name" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('position')}
                                        className="px-6 py-3 text-left font-medium cursor-pointer hover:text-white transition group select-none"
                                    >
                                        <div className="flex items-center gap-1">
                                            Jabatan
                                            <SortIcon field="position" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left font-medium"
                                    >
                                        Kantor
                                    </th>
                                    <th className="px-6 py-3 text-left font-medium">Check Out</th>
                                    <th className="px-6 py-3 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {attendances?.map((a: any) => {
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-800/50 transition-colors text-sm">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                                <div>{formatDate(a.check_in_time)}</div>
                                                <div className="text-xs text-slate-500">{formatTime(a.check_in_time)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                                                {a.user?.name || a.user_name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {a.user?.employee?.position || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {a.user?.office?.name || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                {formatTime(a.check_out_time)}
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
                                            Tidak ada data untuk filter ini
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
