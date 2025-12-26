import { useState } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { employeeAPI } from '../../api/client';

interface EmployeeImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EmployeeImportModal({ isOpen, onClose, onSuccess }: EmployeeImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        try {
            const res = await employeeAPI.importEmployees(file);
            setResult(res.data);
            if (res.data.imported > 0) {
                setTimeout(onSuccess, 2000); // Refresh data after a delay
            }
        } catch (error) {
            console.error(error);
            setResult({ imported: 0, skipped: 0, errors: ['Gagal mengupload file: ' + (error as any).response?.data?.error || 'Unknown error'] });
        } finally {
            setUploading(false);
        }
    };

    const generateTemplate = () => {
        const headers = [
            'NIK', 'Nama Lengkap', 'Email', 'Posisi', 'ID Kantor', 'Tanggal Bergabung (YYYY-MM-DD)',
            'Status Karyawan', 'No KTP', 'Gender (L/P)', 'Tempat Lahir', 'Tanggal Lahir (YYYY-MM-DD)',
            'Status Pernikahan', 'Jumlah Anak', 'Alamat', 'Status Tempat Tinggal', 'Agama', 'Golongan Darah',
            'Nama Kontak Darurat', 'No HP Kontak Darurat', 'Hubungan Kontak Darurat',
            'No Rekening', 'Nama Bank', 'BPJS Kesehatan', 'BPJS Ketenagakerjaan', 'NPWP',
            'Gaji Pokok', 'Pendidikan Terakhir', 'Grade', 'Kompetensi', 'Radius (m)'
        ];

        const example = [
            '2024001', 'John Doe', 'john@example.com', 'Staff IT', 'OFFICE-UUID', '2024-01-01',
            'PKWT', '3201123456780001', 'L', 'Jakarta', '1990-01-01',
            'KAWIN', '2', 'Jl. Sudirman No. 1', 'RUMAH SENDIRI', 'ISLAM', 'O',
            'Jane Doe', '08123456789', 'ISTRI',
            '1234567890', 'BCA', '000123456', '000654321', '12.345.678.9-000.000',
            '5000000', 'S1', '10', 'Programming, Networking', '100'
        ];

        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + example.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "template_lengkap_karyawan.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Upload size={24} className="text-cyan-400" />
                        Import Data Karyawan
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Template Download */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle size={20} className="text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-medium text-blue-400 mb-1">Format File CSV</h3>
                            <p className="text-xs text-slate-400 mb-3">
                                Gunakan template ini sebagai referensi. Anda dapat menghapus kolom yang tidak diperlukan.
                                <br />
                                <strong>Wajib:</strong> NIK, Nama Lengkap.
                                <br />
                                Kolom lain bersifat opsional. Header harus sesuai dengan template.
                            </p>
                            <button
                                onClick={generateTemplate}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition-colors"
                            >
                                <Download size={14} />
                                Download Template CSV
                            </button>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-4">
                        <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'}`}>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <FileSpreadsheet size={48} className={file ? 'text-cyan-400' : 'text-slate-500'} />
                                <span className="text-sm font-medium text-slate-300">
                                    {file ? file.name : 'Klik untuk upload file CSV'}
                                </span>
                                {!file && <span className="text-xs text-slate-500">Maksimal 5MB</span>}
                            </label>
                        </div>

                        {/* Result Display */}
                        {result && (
                            <div className={`rounded-xl p-4 border ${result.errors && result.errors.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {result.errors && result.errors.length > 0 ? (
                                        <AlertCircle size={20} className="text-red-400" />
                                    ) : (
                                        <CheckCircle size={20} className="text-emerald-400" />
                                    )}
                                    <span className={`font-medium ${result.errors && result.errors.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        Import Selesai
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-slate-400">Berhasil: <span className="text-white">{result.imported}</span></div>
                                    <div className="text-slate-400">Dilewati: <span className="text-white">{result.skipped}</span></div>
                                </div>
                                {result.errors && result.errors.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-red-500/20">
                                        <div className="text-xs font-medium text-red-400 mb-1">Error Log:</div>
                                        <ul className="text-xs text-red-300 space-y-1 max-h-32 overflow-y-auto">
                                            {result.errors.map((err, i) => (
                                                <li key={i}>• {err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-white/5 transition-colors font-medium disabled:opacity-50"
                    >
                        Tutup
                    </button>
                    {file && !result && (
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {uploading ? (
                                <>Processing...</>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Import File
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
