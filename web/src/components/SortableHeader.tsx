import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
    key: string;
    direction: SortDirection;
}

interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentSort: SortConfig;
    onSort: (key: string) => void;
    className?: string;
    align?: 'left' | 'right' | 'center';
}

export default function SortableHeader({
    label,
    sortKey,
    currentSort,
    onSort,
    className = '',
    align = 'left'
}: SortableHeaderProps) {
    const isActive = currentSort.key === sortKey;
    const direction = isActive ? currentSort.direction : null;

    const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
        <th
            className={`px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white hover:bg-white/5 transition-colors select-none ${className}`}
            onClick={() => onSort(sortKey)}
        >
            <div className={`flex items-center gap-1 ${alignClass}`}>
                <span>{label}</span>
                <span className="text-slate-600">
                    {direction === 'asc' ? (
                        <ArrowUp size={14} className="text-cyan-400" />
                    ) : direction === 'desc' ? (
                        <ArrowDown size={14} className="text-cyan-400" />
                    ) : (
                        <ArrowUpDown size={14} />
                    )}
                </span>
            </div>
        </th>
    );
}

// Utility function to sort data
export function sortData<T>(data: T[], sortConfig: SortConfig): T[] {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue, 'id', { sensitivity: 'base' });
        } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
}

// Helper to get nested object values like "user.name"
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Hook helper for managing sort state
export function useSort(defaultKey: string = '', defaultDirection: SortDirection = null) {
    const handleSort = (key: string, currentSort: SortConfig, setSort: (sort: SortConfig) => void) => {
        if (currentSort.key === key) {
            // Cycle through: asc -> desc -> null
            if (currentSort.direction === 'asc') {
                setSort({ key, direction: 'desc' });
            } else if (currentSort.direction === 'desc') {
                setSort({ key: '', direction: null });
            } else {
                setSort({ key, direction: 'asc' });
            }
        } else {
            setSort({ key, direction: 'asc' });
        }
    };

    return { defaultSort: { key: defaultKey, direction: defaultDirection }, handleSort };
}
