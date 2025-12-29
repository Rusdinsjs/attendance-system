import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="p-4 rounded-full bg-slate-800/50 mb-4">
                <Icon size={32} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-300">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

// Common empty state variants
export function NoDataEmpty({ message = 'Belum ada data' }: { message?: string }) {
    return <EmptyState title={message} />;
}

export function NoSearchResultsEmpty({ query }: { query?: string }) {
    return (
        <EmptyState
            title="Tidak ada hasil"
            description={query ? `Tidak ditemukan hasil untuk "${query}"` : 'Coba ubah filter atau kata kunci pencarian'}
        />
    );
}
