/**
 * Helper to safely extract an array from various API response shapes
 * @param data - The response data object
 * @param keys - Property names to try, in order of preference
 * @returns The extracted array or empty array
 */
export function extractArray<T>(data: unknown, ...keys: string[]): T[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;

    const obj = data as Record<string, unknown>;
    for (const key of keys) {
        if (obj[key] && Array.isArray(obj[key])) {
            return obj[key] as T[];
        }
    }
    return [];
}

/**
 * Calculate pagination values
 */
export function getPagination(total: number, page: number, limit: number) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return { totalPages, offset, hasNext, hasPrev };
}

/**
 * Class name helper - combines class names, filtering out falsy values
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string | undefined | null): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
