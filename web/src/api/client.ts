// API Client for Admin Dashboard
import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (email: string, password: string) =>
        apiClient.post('/auth/login', { email, password }),
    logout: () => apiClient.post('/auth/logout'),
};

// Public API
export const publicAPI = {
    getCompanySettings: () => apiClient.get('/kiosk/company-settings'),
};

// Admin API
export const adminAPI = {
    // Users
    getUsers: (params?: any) => apiClient.get('/admin/users', { params }),
    createUser: (data: CreateUserRequest) => apiClient.post('/admin/users', data),
    updateUser: (id: string, data: UpdateUserRequest) =>
        apiClient.put(`/admin/users/${id}`, data),
    deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
    uploadAvatar: (id: string, file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);
        return apiClient.post(`/admin/users/${id}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Attendance
    getDashboardStats: (params: any) => apiClient.get('/admin/dashboard/stats', { params }),
    getTodayAttendance: (params?: any) => apiClient.get('/admin/attendance/today', { params }),
    getAttendanceReport: (params: ReportParams) =>
        apiClient.get('/admin/attendance/report', { params }),

    // Face Verification
    getFaceVerifications: (params?: any) => apiClient.get('/admin/face-verifications', { params }),
    approveFaceVerification: (userId: string) =>
        apiClient.post(`/admin/face-verifications/${userId}/approve`),
    rejectFaceVerification: (userId: string, reason?: string) =>
        apiClient.post(`/admin/face-verifications/${userId}/reject`, { reason }),

    // Settings
    getSettings: () => apiClient.get('/admin/settings'),
    updateSetting: (key: string, value: string) =>
        apiClient.put(`/admin/settings/${key}`, { value }),
    uploadLogo: (file: File) => {
        const formData = new FormData();
        formData.append('logo', file);
        return apiClient.post('/admin/settings/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Transfer Requests
    getTransferRequests: (params?: any) => apiClient.get('/admin/transfer-requests', { params }),
    approveTransferRequest: (id: string) =>
        apiClient.post(`/admin/transfer-requests/${id}/approve`),
    rejectTransferRequest: (id: string, note?: string) =>
        apiClient.post(`/admin/transfer-requests/${id}/reject`, { admin_note: note }),

    // Offices
    getOffices: (params?: any) => apiClient.get('/admin/offices', { params }),
    createOffice: (data: Partial<Office>) => apiClient.post('/admin/offices', data),
    updateOffice: (id: string, data: Partial<Office>) => apiClient.put(`/admin/offices/${id}`, data),
    deleteOffice: (id: string) => apiClient.delete(`/admin/offices/${id}`),

    // Kiosk Management
    getKiosks: (params?: any) => apiClient.get('/admin/kiosks', { params }),
    createKiosk: (data: CreateKioskRequest) => apiClient.post('/admin/kiosks', data),
    updateKiosk: (id: string, data: Partial<UpdateKioskRequest>) => apiClient.put(`/admin/kiosks/${id}`, data),
    deleteKiosk: (id: string) => apiClient.delete(`/admin/kiosks/${id}`),
    unpairKiosk: (id: string) => apiClient.post(`/admin/kiosks/${id}/unpair`),
};

// Types
import type { Employee } from '../types/employee';
export type { Employee };

export const employeeAPI = {
    getEmployees: (params?: any) => apiClient.get('/admin/employees', { params }),
    getAll: (params?: any) => apiClient.get('/admin/employees', { params }), // Keep for compatibility if used elsewhere
    getOne: (id: string) => apiClient.get(`/admin/employees/${id}`),
    create: (data: any) => apiClient.post('/admin/employees', data),
    update: (id: string, data: any) => apiClient.put(`/admin/employees/${id}`, data),
    delete: (id: string) => apiClient.delete(`/admin/employees/${id}`),
    uploadPhoto: (id: string, file: File) => {
        const formData = new FormData();
        formData.append('photo', file);
        return apiClient.post<{ message: string; photo_url: string }>(`/admin/employees/${id}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    importEmployees: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiClient.post<{ imported: number; skipped: number; errors: string[] }>('/admin/employees/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};
export interface Office {
    id: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    radius: number;
    is_active: boolean;
}

export interface User {
    id: string;
    employee_id: string;
    name: string;
    email: string;
    role: 'employee' | 'admin' | 'hr';
    is_active: boolean;
    avatar_url?: string;
    face_verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
    created_at: string;
    office_id?: string;
    office?: Office;
    employee?: Employee;
}

export interface Attendance {
    id: string;
    user_id: string;
    user_name?: string;
    user?: {
        id: string;
        name: string;
        employee_id: string;
    };
    check_in_time: string | null;
    check_out_time: string | null;
    is_late: boolean;
    is_mock_location: boolean;
}

export interface CreateUserRequest {
    employee_id: string;
    name: string;
    email: string;
    password: string;
    role: 'employee' | 'admin' | 'hr';
    office_id?: string;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    password?: string;
    role?: 'employee' | 'admin' | 'hr';
    is_active?: boolean;
    office_id?: string;
}

export interface ReportParams {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    position?: string;
    office_id?: string;
    status?: 'late' | 'on_time';
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
}

export interface Kiosk {
    id: string;
    kiosk_id: string;
    name: string;
    office_id: string;
    office?: Office;
    is_active: boolean;
    is_paired: boolean;
    last_seen: string;
    created_at: string;
}

export interface CreateKioskRequest {
    name: string;
    kiosk_id: string;
    office_id: string;
}

export interface UpdateKioskRequest {
    name: string;
    office_id: string;
    is_active?: boolean;
}

export default apiClient;
