import { LogOut } from 'lucide-react';

interface ConfirmLogoutModalProps {
    isOpen: boolean;
    userName?: string;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function ConfirmLogoutModal({ isOpen, userName, onCancel, onConfirm }: ConfirmLogoutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 transform scale-100 animate-in zoom-in-95 duration-200">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogOut className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Konfirmasi Logout</h3>
                    <p className="text-slate-400">
                        Apakah <span className="text-white font-medium">{userName || 'Anda'}</span> yakin ingin logout?
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-900/20"
                    >
                        Ya, Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
