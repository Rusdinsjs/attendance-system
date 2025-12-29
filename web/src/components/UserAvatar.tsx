import { getUploadUrl } from '../api/client';

interface UserAvatarProps {
    name?: string;
    avatarUrl?: string;
    size?: 'sm' | 'md' | 'lg';
    showBorder?: boolean;
}

const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-lg',
};

export default function UserAvatar({ name, avatarUrl, size = 'md', showBorder = true }: UserAvatarProps) {
    const initial = name?.charAt(0).toUpperCase() || 'U';
    const borderClass = showBorder ? 'border-2 border-cyan-500/50 shadow-lg shadow-cyan-900/20' : '';

    if (avatarUrl) {
        const fullUrl = getUploadUrl(avatarUrl);
        if (fullUrl) {
            return (
                <img
                    src={fullUrl}
                    alt={name || 'User'}
                    className={`${sizeClasses[size]} rounded-full object-cover ${borderClass}`}
                />
            );
        }
    }

    return (
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold ${borderClass}`}>
            {initial}
        </div>
    );
}
