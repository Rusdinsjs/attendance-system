import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    badge?: number | string;
    action?: ReactNode;
}

export default function PageHeader({ title, subtitle, badge, action }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    {title}
                    {badge !== undefined && (
                        <span className="text-sm bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 font-medium">
                            {badge}
                        </span>
                    )}
                </h1>
                {subtitle && <p className="text-slate-400 mt-1">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}
