import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: number | string;
    color: string;
    bgColor: string;
}

export default function StatCard({ icon: Icon, label, value, color, bgColor }: StatCardProps) {
    return (
        <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800 text-white">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="text-3xl font-bold mt-1 text-white">{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${bgColor}`}>
                    <Icon size={24} className={color} />
                </div>
            </div>
        </div>
    );
}
