
// Dashboard Page with Stats
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { adminAPI, BACKEND_URL } from '../../api/client';
import type { Attendance } from '../../api/client';
import {
    Users, Clock, AlertTriangle, CheckCircle, Calendar,
    BarChart2, TrendingUp, Activity
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import SortableHeader, { type SortConfig, sortData } from '../../components/SortableHeader';
import StatCard from '../../components/StatCard';
import { formatTime } from '../../utils/formatters';

export default function DashboardView() {
    const [wsConnected, setWsConnected] = useState(false);

    // State for Period & Chart
    const [period, setPeriod] = useState<'today' | 'custom'>('today');
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                if (prev.direction === 'desc') return { key: '', direction: null };
            }
            return { key, direction: 'asc' };
        });
    };

    // 1. Dashboard Stats (Cards & Graph) -- Depends on Period
    const { data: statsData, refetch } = useQuery({
        queryKey: ['dashboardStats', period, customStart, customEnd],
        queryFn: async () => {
            const res = await adminAPI.getDashboardStats({
                period,
                start_date: period === 'custom' ? customStart : undefined,
                end_date: period === 'custom' ? customEnd : undefined
            });
            return res.data as any;
        },
        refetchInterval: 60000, // 1 min
        placeholderData: keepPreviousData
    });

    // 2. Live Activity (Always Today)
    const { data: attendanceData, isLoading: isLoadingTable, refetch: refetchTable } = useQuery({
        queryKey: ['todayAttendance'],
        queryFn: async () => {
            const res = await adminAPI.getTodayAttendance({
                limit: 10, // Fixed limit for recent activity
                offset: 0
            });
            return res.data as any;
        },
        refetchInterval: 30000, // 30s
        placeholderData: keepPreviousData
    });

    const todayAttendance = attendanceData?.attendances || [];

    // Stats from API
    const stats = statsData?.stats || {
        total_employees: 0,
        present: 0,
        late: 0,
        absent: 0,
        total_checkins: 0,
    };
    const graphData = statsData?.graph_data || [];

    // WebSocket connection
    useEffect(() => {
        // Use BACKEND_URL for WebSocket connection (replace http with ws)
        const wsBaseUrl = BACKEND_URL.replace(/^http/, 'ws');
        const wsUrl = `${wsBaseUrl}/ws/dashboard`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setWsConnected(true);
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'attendance_update') {
                refetchTable();
                refetch(); // Update stats too
            }
        };

        ws.onclose = () => setWsConnected(false);

        return () => ws.close();
    }, [refetchTable, refetch]);

    const renderChart = () => {
        const CommonAxis = (
            <>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                    dataKey={period === 'today' ? 'hour' : 'date'}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(val) => period === 'today' ? val : val.replace(/^\d{4}-/, '')}
                    stroke="#475569"
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: '#1e293b', opacity: 0.5 }}
                    labelFormatter={(label) => period === 'today' ? `Pukul ${label}` : label}
                />
            </>
        );

        if (chartType === 'line') {
            return (
                <LineChart data={graphData}>
                    {CommonAxis}
                    <Line type="monotone" dataKey="present" name="Hadir" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="late" name="Terlambat" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
            );
        }
        if (chartType === 'area') {
            return (
                <AreaChart data={graphData}>
                    {CommonAxis}
                    <Area type="monotone" dataKey="present" name="Hadir" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="late" name="Terlambat" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                </AreaChart>
            );
        }
        // Default Bar
        return (
            <BarChart data={graphData}>
                {CommonAxis}
                <Bar dataKey="present" name="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
        );
    };

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 mt-1">
                        Monitoring absensi & statistik
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

                    {/* Date Range Inputs */}
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 animate-in fade-in slide-in-from-right-4 duration-300">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-slate-500">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                    )}

                    {/* Period Selector */}
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
                        <button
                            onClick={() => setPeriod('today')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${period === 'today'
                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Hari Ini
                        </button>
                        <button
                            onClick={() => setPeriod('custom')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${period === 'custom'
                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Periode
                        </button>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-medium text-slate-400">{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Users} label="Total Karyawan" value={stats.total_employees} color="text-slate-200" bgColor="bg-slate-800" />
                <StatCard icon={CheckCircle} label={period === 'custom' ? "Total Hadir (Range)" : "Hadir"} value={stats.present} color="text-emerald-400" bgColor="bg-emerald-500/10" />
                <StatCard icon={AlertTriangle} label={period === 'custom' ? "Total Terlambat" : "Terlambat"} value={stats.late} color="text-amber-400" bgColor="bg-amber-500/10" />
                <StatCard icon={Clock} label={period === 'custom' ? "Absen (Estimasi)" : "Belum Absen"} value={stats.absent} color="text-red-400" bgColor="bg-red-500/10" />
            </div>

            {/* Main Chart */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6">
                <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Calendar size={20} className="text-cyan-400" />
                        Statistik Kehadiran {period === 'today' ? 'Hari Ini (Per Jam)' : 'Periode Pilihan'}
                    </h2>

                    {/* Chart Type Selector */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setChartType('bar')}
                            title="Bar Chart"
                            className={`p-1.5 rounded ${chartType === 'bar' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <BarChart2 size={18} />
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            title="Line Chart"
                            className={`p-1.5 rounded ${chartType === 'line' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <TrendingUp size={18} />
                        </button>
                        <button
                            onClick={() => setChartType('area')}
                            title="Area Chart"
                            className={`p-1.5 rounded ${chartType === 'area' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Activity size={18} />
                        </button>
                    </div>
                </div>

                <div className="h-[300px] w-full min-w-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden text-slate-200">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <TrendingUp size={20} className="text-cyan-400" />
                        Aktivitas Terbaru
                    </h2>
                </div>

                {isLoadingTable ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-950/50">
                                <tr>
                                    <SortableHeader label="Karyawan" sortKey="user.name" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Check In" sortKey="check_in_time" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Check Out" sortKey="check_out_time" currentSort={sortConfig} onSort={handleSort} />
                                    <SortableHeader label="Status" sortKey="is_late" currentSort={sortConfig} onSort={handleSort} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {(sortData(todayAttendance, sortConfig) as Attendance[]).map((attendance: Attendance) => (
                                    <tr key={attendance.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-white">{attendance.user?.name || attendance.user_name || 'Unknown'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                            {formatTime(attendance.check_in_time)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                            {formatTime(attendance.check_out_time)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {attendance.is_late ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">Terlambat</span>
                                            ) : attendance.check_in_time ? (
                                                <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">Hadir</span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-400 rounded-full border border-slate-700">Belum</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {(!todayAttendance || todayAttendance.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                            Belum ada data kehadiran hari ini
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
