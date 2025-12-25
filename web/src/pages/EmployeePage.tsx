import { useState, useEffect } from 'react';
import { employeeAPI, adminAPI } from '../api/client';
import type { Employee } from '../types/employee';
import { Plus, Search, Edit, Trash2, MapPin, Briefcase, User, ChevronLeft, ChevronRight, Eye, Upload } from 'lucide-react';
import EmployeeForm from '../components/employees/EmployeeForm';
import EmployeeImportModal from '../components/employees/EmployeeImportModal';
import EmployeeFilters from '../components/employees/EmployeeFilters';

export default function EmployeePage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        office_id: '',
        position: '',
        employment_status: '',
        gender: ''
    });
    const [showForm, setShowForm] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
    const [offices, setOffices] = useState<any[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        fetchOffices();
    }, []);

    useEffect(() => {
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, filters]);

    const fetchOffices = async () => {
        try {
            const res = await adminAPI.getOffices();
            setOffices(res.data.offices || []);
        } catch (error) {
            console.error("Failed to fetch offices", error);
        }
    };

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await employeeAPI.getAll({
                limit: 10,
                offset: (page - 1) * 10,
                name: search,
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
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Data Karyawan
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
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Cari Nama atau NIK..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                </div>

                <EmployeeFilters
                    offices={offices}
                    filters={filters}
                    onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                    onReset={() => setFilters({ office_id: '', position: '', employment_status: '', gender: '' })}
                />
            </div>

            {/* List */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5">
                            <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Karyawan</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Jabatan & Kantor</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Kontak</th>
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
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 border border-white/10">
                                                <User size={18} />
                                            </div>
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

            {/* Pagination values */}
            {total > 10 && (
                <div className="flex justify-end items-center gap-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-slate-400">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {showForm && (
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
            )}

            <EmployeeImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={() => {
                    setShowImportModal(false);
                    fetchEmployees();
                }}
            />
        </div>
    );
}
