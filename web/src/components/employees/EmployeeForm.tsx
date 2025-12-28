import React, { useState, useEffect } from 'react';
import { adminAPI, employeeAPI, getUploadUrl } from '../../api/client';
import type { Employee, WorkExperience, EmployeeEvaluation } from '../../types/employee';
import { X, Plus, Trash2, Upload, User, Camera } from 'lucide-react';

interface EmployeeFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employee?: Employee | null;
    readOnly?: boolean; // New prop for Detail view
}

export default function EmployeeForm({ isOpen, onClose, onSuccess, employee, readOnly = false }: EmployeeFormProps) {
    const [activeTab, setActiveTab] = useState('biodata');
    const [isLoading, setIsLoading] = useState(false);
    const [offices, setOffices] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]); // For Manager selection and User linking
    const [error, setError] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Employee>>({
        // Default values
        nik: '',
        ktp_number: '',
        name: '',
        gender: 'L',
        children_count: 0,
        employment_status: 'PKWT',
        residence_status: 'RUMAH SENDIRI',
        is_manager: false,
        is_evaluator: false,
        is_allowance: false,
        work_experiences: [],
        employee_evaluations: [],
        allowances: [],
        competency_attachments: [],
        ...employee
    });

    // New User Creation State
    const [createUser, setCreateUser] = useState(false);
    const [newUserPass, setNewUserPass] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');

    useEffect(() => {
        fetchOptions();
    }, []);

    useEffect(() => {
        setError(''); // Clear error when switching employees
        if (employee) {
            setFormData(employee);
            if (employee.photo_url) {
                setPhotoPreview(getUploadUrl(employee.photo_url)!);
            }
        } else {
            setFormData({
                nik: '',
                ktp_number: '',
                name: '',
                gender: 'L',
                children_count: 0,
                employment_status: 'PKWT',
                residence_status: 'RUMAH SENDIRI',
                religion: 'ISLAM',
                blood_type: 'O',
                is_manager: false,
                is_evaluator: false,
                is_allowance: false,
                basic_salary: 0,
                leave_balance: 12,
                leave_used: 0,
                work_experiences: [],
                employee_evaluations: []
            });
            setPhotoPreview(null);
            setPhotoFile(null);
        }
    }, [employee]);

    const fetchOptions = async () => {
        try {
            const [officesRes, usersRes] = await Promise.all([
                adminAPI.getOffices(),
                adminAPI.getUsers()
            ]);
            setOffices(officesRes.data.offices || []);
            setUsers(usersRes.data.data || []);
        } catch (error) {
            console.error("Failed to fetch options", error);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleChange = (field: keyof Employee, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Array Helpers
    const addWorkExperience = () => {
        const newExp: WorkExperience = {
            company_name: '',
            start_date: '',
            end_date: '',
            description: '',
            attachment_urls: []
        };
        setFormData(prev => ({
            ...prev,
            work_experiences: [...(prev.work_experiences || []), newExp]
        }));
    };

    const updateWorkExperience = (index: number, field: keyof WorkExperience, value: any) => {
        const exps = [...(formData.work_experiences || [])];
        exps[index] = { ...exps[index], [field]: value };
        setFormData(prev => ({ ...prev, work_experiences: exps }));
    };

    const removeWorkExperience = (index: number) => {
        const exps = [...(formData.work_experiences || [])];
        exps.splice(index, 1);
        setFormData(prev => ({ ...prev, work_experiences: exps }));
    };

    // Evaluation Helpers
    const addEvaluation = () => {
        const newEval: EmployeeEvaluation = {
            year: new Date().getFullYear(),
            score: 'BAIK'
        };
        setFormData(prev => ({
            ...prev,
            employee_evaluations: [...(prev.employee_evaluations || []), newEval]
        }));
    };

    const updateEvaluation = (index: number, field: keyof EmployeeEvaluation, value: any) => {
        const evals = [...(formData.employee_evaluations || [])];
        evals[index] = { ...evals[index], [field]: value };
        setFormData(prev => ({ ...prev, employee_evaluations: evals }));
    };

    const removeEvaluation = (index: number) => {
        const evals = [...(formData.employee_evaluations || [])];
        evals.splice(index, 1);
        setFormData(prev => ({ ...prev, employee_evaluations: evals }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            let employeeId = employee?.id;
            const payload: any = { ...formData };
            if (!employee && createUser) {
                payload.create_user = true;
                payload.password = newUserPass;
                payload.name = newUserName; // Usually same as employee name
                payload.email = newUserEmail;
            }

            if (employee) {
                await employeeAPI.update(employee.id, payload);
            } else {
                const res = await employeeAPI.create(payload);
                employeeId = res.data.id;
            }

            if (photoFile && employeeId) {
                await employeeAPI.uploadPhoto(employeeId, photoFile);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Submit error:', err);
            setError(err.response?.data?.error || 'Gagal menyimpan data karyawan');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'biodata', label: 'Biodata' },
        { id: 'employment', label: 'Pekerjaan' },
        { id: 'competency', label: 'Kompetensi' },
        { id: 'experience', label: 'Pengalaman' },
        { id: 'evaluation', label: 'Evaluasi' },
        { id: 'payroll', label: 'Payroll' },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white">
                        {readOnly ? 'Detail Karyawan' : (employee ? 'Edit Karyawan' : 'Tambah Karyawan')}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className={`flex border-b border-white/10 px-6 overflow-x-auto`}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'border-cyan-400 text-cyan-400'
                                : 'border-transparent text-slate-400 hover:text-white hover:border-white/20'
                                } ${activeTab === 'biodata' ? 'pb-12' : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                                {error}
                            </div>
                        )}

                        {/* BIODATA TAB */}
                        {activeTab === 'biodata' && (
                            <div className="space-y-6">
                                {/* Photo Section */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="relative w-32 h-32 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 mb-4 group">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Employee" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                <User size={48} />
                                            </div>
                                        )}
                                        {!readOnly && (
                                            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                                <Camera size={24} className="text-white" />
                                                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    {readOnly && <h2 className="text-xl font-bold text-white">{formData.name}</h2>}
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormInput label="ID Karyawan" value={formData.nik} onChange={(v: string) => handleChange('nik', v)} required placeholder="Contoh: 2024001" disabled={readOnly} />
                                    <FormInput label="NIK KTP" value={formData.ktp_number} onChange={(v: string) => handleChange('ktp_number', v)} required placeholder="16 Digit NIK KTP" disabled={readOnly} />
                                    <FormInput label="Nama Lengkap" value={formData.name || ''} onChange={(v: string) => handleChange('name', v)} required placeholder="Nama Lengkap Karyawan" disabled={readOnly} />

                                    <div className="md:col-span-2 p-4 bg-white/5 rounded-lg border border-white/10">
                                        <h3 className="text-white font-medium mb-4">Informasi Akun User</h3>
                                        {!employee && (
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={createUser} onChange={e => setCreateUser(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                                                    <span className="text-slate-300">Buat Akun Login Baru</span>
                                                </label>
                                                {createUser && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <FormInput label="Nama Akun" value={newUserName} onChange={setNewUserName} required />
                                                        <FormInput label="Email" type="email" value={newUserEmail} onChange={setNewUserEmail} required />
                                                        <FormInput label="Password" type="password" value={newUserPass} onChange={setNewUserPass} required />
                                                    </div>
                                                )}
                                                {!createUser && (
                                                    <FormSelect label="Link ke User Ada" value={formData.user_id} onChange={(v: string) => handleChange('user_id', v)} options={users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))} />
                                                )}
                                            </div>
                                        )}
                                        {employee && (
                                            <div className="text-slate-400 text-sm">
                                                Terhubung ke akun: <span className="text-white">{employee.user?.email || 'N/A'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <FormSelect label="Jenis Kelamin" value={formData.gender} onChange={(v: string) => handleChange('gender', v)} options={['Laki-laki', 'Perempuan']} disabled={readOnly} />
                                    <FormInput label="Tempat Lahir" value={formData.place_of_birth} onChange={(v: string) => handleChange('place_of_birth', v)} disabled={readOnly} />
                                    <FormInput label="Tanggal Lahir" type="date" value={formatDate(formData.date_of_birth)} onChange={(v: string) => handleChange('date_of_birth', v)} disabled={readOnly} />
                                    <FormSelect label="Agama" value={formData.religion} onChange={(v: string) => handleChange('religion', v)} options={['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU']} disabled={readOnly} />
                                    <FormSelect label="Golongan Darah" value={formData.blood_type} onChange={(v: string) => handleChange('blood_type', v)} options={['A', 'B', 'AB', 'O']} disabled={readOnly} />
                                    <FormSelect label="Status Pernikahan" value={formData.marital_status} onChange={(v: string) => handleChange('marital_status', v)} options={['BELUM KAWIN', 'KAWIN', 'CERAI HIDUP', 'CERAI MATI']} disabled={readOnly} />
                                    {['KAWIN', 'CERAI HIDUP', 'CERAI MATI'].includes(formData.marital_status || '') && (
                                        <FormInput label="Jumlah Anak" type="number" value={formData.children_count} onChange={(v: string) => handleChange('children_count', parseInt(v))} disabled={readOnly} />
                                    )}
                                    <FormInput label="Alamat Lengkap" value={formData.address} onChange={(v: string) => handleChange('address', v)} className="md:col-span-2" textarea disabled={readOnly} />
                                    <FormSelect label="Status Tempat Tinggal" value={formData.residence_status} onChange={(v: string) => handleChange('residence_status', v)} options={['RUMAH SENDIRI', 'RUMAH KELUARGA', 'KONTRAK/SEWA', 'RUMAH DINAS']} disabled={readOnly} />

                                    <div className="md:col-span-2 mt-4">
                                        <h4 className="text-cyan-400 font-medium mb-4 uppercase text-xs tracking-wider">Kontak Darurat</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormInput label="Nama Kontak" value={formData.emergency_contact_name} onChange={(v: string) => handleChange('emergency_contact_name', v)} disabled={readOnly} />
                                            <FormInput label="Nomor Telepon" value={formData.emergency_contact_phone} onChange={(v: string) => handleChange('emergency_contact_phone', v)} disabled={readOnly} />
                                            <FormInput label="Hubungan" value={formData.emergency_contact_relation} onChange={(v: string) => handleChange('emergency_contact_relation', v)} disabled={readOnly} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EMPLOYMENT TAB */}
                        {activeTab === 'employment' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput label="Jabatan / Posisi" value={formData.position} onChange={(v: string) => handleChange('position', v)} required />
                                <FormSelect label="Lokasi Kantor" value={formData.office_id} onChange={(v: string) => handleChange('office_id', v)} options={offices.map(o => ({ value: o.id, label: o.name }))} required />

                                <FormInput label="Mulai Bekerja" type="date" value={formatDate(formData.start_date)} onChange={(v: string) => handleChange('start_date', v)} required />
                                <FormSelect label="Status Karyawan" value={formData.employment_status} onChange={(v: string) => handleChange('employment_status', v)} options={['PKWT', 'PKWTT', 'MAGANG', 'FREELANCE']} />

                                {formData.employment_status === 'PKWT' && (
                                    <FormInput label="Akhir Kontrak" type="date" value={formatDate(formData.end_contract_date)} onChange={(v: string) => handleChange('end_contract_date', v)} />
                                )}

                                <FormSelect label="Atasan Langsung (Manager)" value={formData.manager_id} onChange={(v: string) => handleChange('manager_id', v)} options={users.map(u => ({ value: u.id, label: u.name }))} />

                                <div className="flex flex-col gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.is_manager} onChange={e => handleChange('is_manager', e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                                        <span className="text-slate-300">Posisi Manager</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.is_evaluator} onChange={e => handleChange('is_evaluator', e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-cyan-500" />
                                        <span className="text-slate-300">Dapat Melakukan Evaluasi</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* COMPETENCY TAB */}
                        {activeTab === 'competency' && (
                            <div className="grid grid-cols-1 gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormSelect label="Pendidikan Terakhir" value={formData.education} onChange={(v: string) => handleChange('education', v)} options={['SD', 'SMP', 'SMA/SMK', 'D3', 'S1', 'S2', 'S3']} />
                                    <FormSelect label="Grade Jabatan" value={formData.grade} onChange={(v: string) => handleChange('grade', v)} options={Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`)} />
                                </div>
                                <FormInput label="Kompetensi / Skill" value={formData.competencies} onChange={(v: string) => handleChange('competencies', v)} textarea placeholder="Contoh: Java, React, Project Management..." />

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Lampiran Sertifikat / Dokumen</label>
                                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-cyan-500/50 hover:bg-white/5 transition-colors cursor-pointer group">
                                        <Upload className="mx-auto text-slate-500 group-hover:text-cyan-400 mb-2" />
                                        <div className="text-slate-400 text-sm">Upload File (Placeholder)</div>
                                    </div>
                                    {/* Link to uploaded files would go here */}
                                </div>
                            </div>
                        )}

                        {/* EXPERIENCE TAB */}
                        {activeTab === 'experience' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-white font-medium">Riwayat Pekerjaan</h3>
                                    <button type="button" onClick={addWorkExperience} className="text-xs flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-cyan-500/20">
                                        <Plus size={14} /> Tambah
                                    </button>
                                </div>

                                {formData.work_experiences?.map((exp, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 relative group">
                                        <button type="button" onClick={() => removeWorkExperience(idx)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput label="Nama Perusahaan" value={exp.company_name} onChange={(v: string) => updateWorkExperience(idx, 'company_name', v)} />
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormInput label="Mulai" type="date" value={formatDate(exp.start_date)} onChange={(v: string) => updateWorkExperience(idx, 'start_date', v)} />
                                                <FormInput label="Selesai" type="date" value={formatDate(exp.end_date)} onChange={(v: string) => updateWorkExperience(idx, 'end_date', v)} />
                                            </div>
                                            <FormInput label="Keterangan / Job Desc" value={exp.description} onChange={(v: string) => updateWorkExperience(idx, 'description', v)} className="md:col-span-2" />
                                        </div>
                                    </div>
                                ))}
                                {formData.work_experiences?.length === 0 && (
                                    <div className="text-center py-8 text-slate-500 italic border border-dashed border-white/10 rounded-xl">Belum ada data pengalaman</div>
                                )}
                            </div>
                        )}

                        {/* EVALUATION TAB */}
                        {activeTab === 'evaluation' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-white font-medium">Riwayat Evaluasi</h3>
                                    <button type="button" onClick={addEvaluation} className="text-xs flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg hover:bg-cyan-500/20">
                                        <Plus size={14} /> Tambah
                                    </button>
                                </div>

                                {formData.employee_evaluations?.map((evalItem, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 relative group flex items-start gap-4">
                                        <button type="button" onClick={() => removeEvaluation(idx)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormInput label="Tahun" type="number" value={evalItem.year} onChange={(v: string) => updateEvaluation(idx, 'year', parseInt(v))} />
                                            <FormSelect label="Nilai" value={evalItem.score} onChange={(v: string) => updateEvaluation(idx, 'score', v)} options={['CUKUP', 'CUKUP BAIK', 'BAIK', 'SANGAT BAIK', 'ISTIMEWA']} />
                                            {/* Evaluator selection would link to users with is_evaluator=true */}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* PAYROLL TAB */}
                        {activeTab === 'payroll' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormInput label="Gaji Pokok" type="number" value={formData.basic_salary} onChange={(v: string) => handleChange('basic_salary', parseFloat(v))} />
                                <FormInput label="Nomor NPWP" value={formData.npwp} onChange={(v: string) => handleChange('npwp', v)} />
                                <FormInput label="BPJS Kesehatan" value={formData.bpjs_kesehatan} onChange={(v: string) => handleChange('bpjs_kesehatan', v)} />
                                <FormInput label="BPJS Ketenagakerjaan" value={formData.bpjs_tenaga_kerja} onChange={(v: string) => handleChange('bpjs_tenaga_kerja', v)} />

                                <div className="md:col-span-2 border-t border-white/10 pt-4">
                                    <h4 className="text-white font-medium mb-4">Rekening Bank</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormInput label="Nama Bank" value={formData.bank_name} onChange={(v: string) => handleChange('bank_name', v)} />
                                        <FormInput label="Nomor Rekening" value={formData.bank_account} onChange={(v: string) => handleChange('bank_account', v)} />
                                    </div>
                                </div>
                            </div>
                        )}

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-slate-900 rounded-b-2xl">
                    {readOnly ? (
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">
                            Tutup
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-white/5 transition-colors font-medium">
                                Batal
                            </button>
                            <button onClick={handleSubmit} disabled={isLoading} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all">
                                {isLoading ? 'Menyimpan...' : 'Simpan Data'}
                            </button>
                        </>
                    )}
                </div>
            </div >
        </div >
    );
}

// Reusable Components
interface FormInputProps {
    label: string;
    value: string | number | undefined;
    onChange: (value: string) => void;
    type?: string;
    textarea?: boolean;
    options?: any[];
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

const FormInput = ({ label, value, onChange, type = 'text', textarea, required, disabled, placeholder, className }: FormInputProps) => (
    <div className={className}>
        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            {label} {required && <span className="text-red-400">*</span>}
        </label>
        {textarea ? (
            <textarea
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500/50 min-h-[100px]"
            />
        ) : (
            <input
                type={type}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
            />
        )}
    </div>
);

interface FormSelectProps {
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    options: (string | { value: string | number; label: string })[];
    required?: boolean;
    disabled?: boolean;
}

const FormSelect = ({ label, value, onChange, options, required, disabled }: FormSelectProps) => (
    <div>
        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
            {label} {required && <span className="text-red-400">*</span>}
        </label>
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500/50 appearance-none disabled:opacity-50"
        >
            <option value="">Pilih...</option>
            {options.map((opt) => (
                <option key={typeof opt === 'object' ? opt.value : opt} value={typeof opt === 'object' ? opt.value : opt}>
                    {typeof opt === 'object' ? opt.label : opt}
                </option>
            ))}
        </select>
    </div>
);

const formatDate = (date: any) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
};
