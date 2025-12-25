// Dashboard Page with Stats
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../api/client';
import type { Attendance } from '../api/client';
import { Users, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Stats {
    total: number;
    present: number;
    late: number;
    absent: number;
}

export default function DashboardPage() {
    const [wsConnected, setWsConnected] = useState(false);

    const { data: todayAttendance, isLoading, refetch } = useQuery({
        queryKey: ['todayAttendance'],
        queryFn: async () => {
            const res = await adminAPI.getTodayAttendance();
            return res.data.attendances || [];
        },
        refetchInterval: 30000, // Refresh every 30s
    });

    // Calculate stats
    const stats: Stats = {
        total: todayAttendance?.length || 0,
        present: todayAttendance?.filter((a: Attendance) => a.check_in_time)?.length || 0,
        late: todayAttendance?.filter((a: Attendance) => a.is_late)?.length || 0,
        absent: (todayAttendance?.length || 0) - (todayAttendance?.filter((a: Attendance) => a.check_in_time)?.length || 0),
    };

    // WebSocket connection
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;

        const wsUrl = `${protocol}//${host}/ws/dashboard`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setWsConnected(true);
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'attendance_update') {
                refetch();
            }
        };

        ws.onclose = () => setWsConnected(false);

        return () => ws.close();
    }, [refetch]);

    const StatCard = ({ icon: Icon, label, value, color, bgColor }: any) => (
        <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800 text-white">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className={`text-3xl font-bold mt-1 text-white`}>{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${bgColor}`}>
                    <Icon size={24} className={color} />
                </div>
            </div>
        </div>
    );

    const formatTime = (time: string | null) => {
        if (!time) return '-';
        return new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 mt-1">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-slate-400">{wsConnected ? 'Live' : 'Offline'}</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard icon={Users} label="Total Karyawan" value={stats.total} color="text-slate-200" bgColor="bg-slate-800" />
                <StatCard icon={CheckCircle} label="Hadir" value={stats.present} color="text-emerald-400" bgColor="bg-emerald-500/10" />
                <StatCard icon={AlertTriangle} label="Terlambat" value={stats.late} color="text-amber-400" bgColor="bg-amber-500/10" />
                <StatCard icon={Clock} label="Belum Absen" value={stats.absent} color="text-red-400" bgColor="bg-red-500/10" />
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden text-slate-200">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <TrendingUp size={20} className="text-cyan-400" />
                        Aktivitas Hari Ini
                    </h2>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-950/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Karyawan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check In</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Check Out</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {todayAttendance?.slice(0, 10).map((attendance: Attendance) => (
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
