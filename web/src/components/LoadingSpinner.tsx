interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    className?: string;
}

const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
};

export default function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div className={`animate-spin rounded-full border-t-2 border-b-2 border-cyan-500 ${sizeClasses[size]}`} />
            {text && <p className="text-slate-400 mt-3">{text}</p>}
        </div>
    );
}

// Full page loading state
export function PageLoading({ text = 'Loading...' }: { text?: string }) {
    return (
        <div className="flex h-full min-h-[400px] items-center justify-center">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

// Table loading state
export function TableLoading({ text = 'Memuat data...' }: { text?: string }) {
    return (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <LoadingSpinner size="md" text={text} />
        </div>
    );
}
