import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export default function Pagination({ page, totalPages, onPageChange, className = '' }: PaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className={`flex justify-end items-center gap-2 ${className}`}>
            <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition"
            >
                <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-400">
                Halaman {page} dari {totalPages}
            </span>
            <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-50 transition"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}
