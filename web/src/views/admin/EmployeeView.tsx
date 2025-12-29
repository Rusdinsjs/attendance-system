import { useState, useEffect } from 'react';
import { employeeAPI, adminAPI, getUploadUrl } from '../../api/client';
import type { Employee } from '../../types/employee';
import { Plus, Trash2, Edit, Upload, Filter, User, Briefcase, MapPin, Eye } from 'lucide-react';
import EmployeeForm from '../../components/employees/EmployeeForm';
import EmployeeImportModal from '../../components/employees/EmployeeImportModal';
import EmployeeFilters from '../../components/employees/EmployeeFilters';
import AdvancedFilterBuilder, { type DynamicFilter } from '../../components/employees/AdvancedFilterBuilder';
import SortableHeader, { type SortConfig } from '../../components/SortableHeader';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';

export default function EmployeeView() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        office_id: '',
        position: '',
        employment_status: '',
        gender: '',
        face_verification_status: ''
    });
    const [showForm, setShowForm] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
    const [offices, setOffices] = useState<any[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);

    // Custom Filters
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                if (prev.direction === 'desc') return { key: '', direction: null };
            }
            return { key, direction: 'asc' };
        });
    };

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, filters, dynamicFilters, sortConfig]);

    const fetchFilterOptions = async () => {
        try {
            const officesRes = await adminAPI.getOffices();
            setOffices(officesRes.data.offices || []);
        } catch (error) {
            console.error("Failed to fetch offices", error);
        }

        try {
            const positionsRes = await employeeAPI.getPositions();
            setPositions(positionsRes.data.positions || []);
        } catch (error) {
            console.error("Failed to fetch positions", error);
        }
    };

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await employeeAPI.getAll({
                limit: 10,
                offset: (page - 1) * 10,
                name: search,
                filters: JSON.stringify(dynamicFilters),
                sort_by: sortConfig.key || undefined,
                sort_order: sortConfig.direction || undefined,
                ...filters
            });
            setEmployees(res.data.data);
            setTotal(res.data.total);
        } catch (error) {
            console.error("Failed to fetch employees", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Apakah anda yakin ingin menghapus data karyawan ini?')) return;
        try {
            await employeeAPI.delete(id);
            fetchEmployees();
        } catch (error) {
            alert('Gagal menghapus karyawan');
        }
    };

    const handleAdd = () => {
        setSelectedEmployee(undefined);
        setReadOnly(false);
        setShowForm(true);
    };

    const totalPages = Math.ceil(total / 10);

    return (
        <div className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 flex items-center gap-3">
                        Data Karyawan
                        <span className="text-sm bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 font-medium">
                            {total}
                        </span>
                    </h1>
                    <p className="text-slate-400 mt-1">Kelola data lengkap karyawan, kontrak, dan histori</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                    >
                        <Upload size={18} />
                        Import CSV
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/20 transition-all"
                    >
                        <Plus size={18} />
                        Tambah Karyawan
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari Nama atau NIK..."
                    className="mb-4"
                />
            </div>

            <EmployeeFilters
                offices={offices}
                positions={positions}
                filters={filters}
                onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                onReset={() => setFilters({ office_id: '', position: '', employment_status: '', gender: '', face_verification_status: '' })}
            />

            <div className="mb-4">
                <button
                    onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                    <Filter size={14} />
                    {showAdvancedFilter ? 'Sembunyikan Filter Custom' : 'Tampilkan Filter Custom'}
                </button>
            </div>

            {showAdvancedFilter && (
                <AdvancedFilterBuilder
                    filters={dynamicFilters}
                    onChange={setDynamicFilters}
                    onClose={() => setShowAdvancedFilter(false)}
                />
            )}

            {/* List */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <SortableHeader label="Karyawan" sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Jabatan & Kantor" sortKey="position" currentSort={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Status" sortKey="employment_status" currentSort={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Kontak" sortKey="user.email" currentSort={sortConfig} onSort={handleSort} />
                            <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</td></tr>
                        ) : employees.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-500">Tidak ada data karyawan</td></tr>
                        ) : (
                            employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {emp.photo_url ? (
                                                <img
                                                    src={getUploadUrl(emp.photo_url)!}
                                                    alt={emp.name}
                                                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 border border-white/10">
                                                    {emp.name?.charAt(0).toUpperCase() || <User size={18} />}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-white">{(emp.user as any)?.name || emp.nik}</div>
                                                <div className="text-xs text-slate-500">NIK: {emp.nik}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <Briefcase size={14} className="text-slate-500" />
                                                {emp.position}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <MapPin size={12} />
                                                {(emp.office as any)?.name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${emp.employment_status === 'PKWTT'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {emp.employment_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-400">{(emp.user as any)?.email}</div>
                                        <div className="text-xs text-slate-500">{emp.emergency_contact_phone || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => { setSelectedEmployee(emp); setReadOnly(true); setShowForm(true); }} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Detail">
                                                <Eye size={16} />
                                            </button>
                                            <button onClick={() => { setSelectedEmployee(emp); setReadOnly(false); setShowForm(true); }} className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Edit">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(emp.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                className="mt-6"
            />

            {
                showForm && (
                    <EmployeeForm
                        isOpen={showForm} // Added isOpen prop
                        employee={selectedEmployee}
                        readOnly={readOnly} // Added readOnly prop
                        onClose={() => setShowForm(false)}
                        onSuccess={() => {
                            setShowForm(false);
                            fetchEmployees();
                        }}
                    />
                )
            }

            <EmployeeImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={() => {
                    setShowImportModal(false);
                    fetchEmployees();
                }}
            />
        </div >
    );
}
