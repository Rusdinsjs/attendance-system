import { Plus, Trash2, Filter, X } from 'lucide-react';

export interface DynamicFilter {
    field: string;
    operator: string;
    value: string;
}

interface AdvancedFilterBuilderProps {
    filters: DynamicFilter[];
    onChange: (filters: DynamicFilter[]) => void;
    onClose: () => void;
}

const AVAILABLE_FIELDS = [
    { label: 'Agama', value: 'religion' },
    { label: 'Golongan Darah', value: 'blood_type' },
    { label: 'Pendidikan Terakhir', value: 'education' },
    { label: 'Gender', value: 'gender' },
    { label: 'Status Pernikahan', value: 'marital_status' },
    { label: 'Jumlah Anak', value: 'children_count' },
    { label: 'Gaji Pokok', value: 'basic_salary' },
    { label: 'Status Tempat Tinggal', value: 'residence_status' },
    { label: 'NPWP', value: 'npwp' },
    { label: 'Email', value: 'email' },
    // Add more as needed
];

const OPERATORS = [
    { label: 'Sama Dengan (=)', value: 'eq' },
    { label: 'Tidak Sama Dengan (!=)', value: 'neq' },
    { label: 'Mengandung Kata (Like)', value: 'like' },
    { label: 'Lebih Besar (>)', value: 'gt' },
    { label: 'Lebih Kecil (<)', value: 'lt' },
];

export default function AdvancedFilterBuilder({ filters, onChange, onClose }: AdvancedFilterBuilderProps) {
    const addFilter = () => {
        onChange([...filters, { field: 'religion', operator: 'eq', value: '' }]);
    };

    const removeFilter = (index: number) => {
        const newFilters = [...filters];
        newFilters.splice(index, 1);
        onChange(newFilters);
    };

    const updateFilter = (index: number, key: keyof DynamicFilter, val: string) => {
        const newFilters = [...filters];
        newFilters[index][key] = val;
        onChange(newFilters);
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                    <Filter size={18} className="text-cyan-400" />
                    Custom Filter Builder
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-3">
                {filters.map((filter, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <select
                            value={filter.field}
                            onChange={(e) => updateFilter(idx, 'field', e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none"
                        >
                            {AVAILABLE_FIELDS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                        </select>

                        <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(idx, 'operator', e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none w-32"
                        >
                            {OPERATORS.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            placeholder="Value..."
                            value={filter.value}
                            onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 outline-none flex-1"
                        />

                        <button
                            onClick={() => removeFilter(idx)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                {filters.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4 border border-dashed border-slate-800 rounded-lg">
                        Belum ada filter aktif
                    </p>
                )}

                <button
                    onClick={addFilter}
                    className="mt-2 text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                >
                    <Plus size={14} />
                    Tambah Filter
                </button>
            </div>
        </div>
    );
}
