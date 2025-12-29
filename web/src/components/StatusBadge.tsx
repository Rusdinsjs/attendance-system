type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
    type: StatusType;
    children: React.ReactNode;
    className?: string;
}

const styles: Record<StatusType, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
};

export default function StatusBadge({ type, children, className = '' }: StatusBadgeProps) {
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[type]} ${className}`}>
            {children}
        </span>
    );
}

// Common status badge variants
export function VerifiedBadge() {
    return <StatusBadge type="success">✓ Verified</StatusBadge>;
}

export function PendingBadge() {
    return <StatusBadge type="warning">⏳ Pending</StatusBadge>;
}

export function RejectedBadge() {
    return <StatusBadge type="error">✗ Rejected</StatusBadge>;
}

export function ActiveBadge() {
    return <StatusBadge type="success">Aktif</StatusBadge>;
}

export function InactiveBadge() {
    return <StatusBadge type="neutral">Nonaktif</StatusBadge>;
}
