import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../api/client';
import { Download, Filter, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import { formatTime, formatDate } from '../../utils/formatters';

export default function ReportsView() {
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
    const summary = reportData?.summary || { total_present: 0, total_on_time: 0, total_late: 0, total_early_leave: 0 };

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



    const getStatusBadge = (status?: string) => {
        if (!status) return null;
        if (status === 'Terlambat' || status === 'Cepat Pulang') {
            return <div className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full inline-block mt-1 border border-amber-500/20">{status}</div>;
        }
        return <div className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-1 border border-emerald-500/20">{status}</div>;
    };

    const exportToCSV = () => {
        if (!attendances || attendances.length === 0) return;

        const headers = ['Tanggal', 'Nama', 'Jabatan', 'Kantor', 'Check In', 'Status Masuk', 'Check Out', 'Status Pulang'];
        const rows = attendances.map((a: any) => [
            formatDate(a.check_in_time),
            a.user?.name || a.user_name || '',
            a.user?.employee?.position || '-',
            a.user?.office?.name || '-',
            formatTime(a.check_in_time),
            a.check_in_status || '-',
            formatTime(a.check_out_time),
            a.check_out_status || '-',
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
            <PageHeader
                title="Laporan Kehadiran"
                subtitle="Export dan analisis data kehadiran"
                action={
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-lg shadow-green-900/20"
                    >
                        <Download size={18} />
                        Export CSV
                    </button>
                }
            />

            {/* ... Filters & Summary kept same structure but skipped in replacement to focus on table change ... */}
            {/* Actually better to replace just table parts to avoid missing parts */}
            {/* Wait, replace_file_content needs contiguous block. I'll target the export function and render part if they are close. */}
            {/* They are separated by Filters and Summary. I should split edits. */}

            {/* Edit 1: exportToCSV and getStatusBadge */}


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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800">
                    <p className="text-sm text-slate-400">Cepat Pulang</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">
                        {summary.total_early_leave}
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
                                            Tanggal
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
                                    <th className="px-6 py-3 text-left font-medium">Check In</th>
                                    <th className="px-6 py-3 text-left font-medium">Check Out</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {attendances?.map((a: any) => {
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-800/50 transition-colors text-sm">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                                <div>{formatDate(a.check_in_time)}</div>
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
                                                <div className="font-mono text-white">{formatTime(a.check_in_time)}</div>
                                                {getStatusBadge(a.check_in_status)}
                                                {a.is_late && !a.check_in_status && ( // Fallback for old records
                                                    <div className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full inline-block mt-1 border border-amber-500/20">Terlambat</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                <div className="font-mono text-white">{formatTime(a.check_out_time)}</div>
                                                {getStatusBadge(a.check_out_status)}
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
            {!isLoading && (
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    className="mt-4"
                />
            )}
        </div>
    );
}
