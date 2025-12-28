import { Filter, X } from 'lucide-react';
import type { Office } from '../../api/client'; // Import Office type from client.ts

interface EmployeeFiltersProps {
    offices: Office[];
    positions: string[]; // Add positions prop
    filters: {
        office_id: string;
        position: string;
        employment_status: string;
        gender: string;
        face_verification_status: string;
    };
    onChange: (key: string, value: string) => void;
    onReset: () => void;
}

export default function EmployeeFilters({ offices, positions, filters, onChange, onReset }: EmployeeFiltersProps) {
    const hasActiveFilters = Object.values(filters).some(Boolean);

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm font-medium">
                <Filter size={16} />
                Filter Lanjutan
                {hasActiveFilters && (
                    <button
                        onClick={onReset}
                        className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                        <X size={12} />
                        Reset Filter
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Office Filter */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Kantor</label>
                    <select
                        value={filters.office_id}
                        onChange={(e) => onChange('office_id', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                        <option value="">Semua Kantor</option>
                        {offices.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                </div>

                {/* Position Filter */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Posisi/Jabatan</label>
                    <select
                        value={filters.position}
                        onChange={(e) => onChange('position', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                        <option value="">Semua Posisi</option>
                        {positions.map((p, idx) => (
                            <option key={idx} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Employment Status */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Status Karyawan</label>
                    <select
                        value={filters.employment_status}
                        onChange={(e) => onChange('employment_status', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                        <option value="">Semua Status</option>
                        <option value="PKWT">PKWT (Kontrak)</option>
                        <option value="PKWTT">PKWTT (Tetap)</option>
                        <option value="MAGANG">Magang</option>
                        <option value="LAINNYA">Lainnya</option>
                    </select>
                </div>

                {/* Gender */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Jenis Kelamin</label>
                    <select
                        value={filters.gender}
                        onChange={(e) => onChange('gender', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                        <option value="">Semua</option>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                    </select>
                </div>

                {/* Face Verification Status */}
                <div>
                    <label className="block text-xs text-slate-500 mb-1.5">Status Wajah</label>
                    <select
                        value={filters.face_verification_status}
                        onChange={(e) => onChange('face_verification_status', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                        <option value="">Semua</option>
                        <option value="verified">✓ Verified</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="rejected">✗ Rejected</option>
                        <option value="none">— Belum</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
