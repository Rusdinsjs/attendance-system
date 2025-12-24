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

// Admin API
export const adminAPI = {
    // Users
    getUsers: () => apiClient.get('/admin/users'),
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
    getTodayAttendance: () => apiClient.get('/admin/attendance/today'),
    getAttendanceReport: (params: ReportParams) =>
        apiClient.get('/admin/attendance/report', { params }),

    // Face Verification
    getFaceVerifications: () => apiClient.get('/admin/face-verifications'),
    approveFaceVerification: (userId: string) =>
        apiClient.post(`/admin/face-verifications/${userId}/approve`),
    rejectFaceVerification: (userId: string, reason?: string) =>
        apiClient.post(`/admin/face-verifications/${userId}/reject`, { reason }),

    // Settings
    getSettings: () => apiClient.get('/admin/settings'),
    updateSetting: (key: string, value: string) =>
        apiClient.put(`/admin/settings/${key}`, { value }),

    // Transfer Requests
    getTransferRequests: () => apiClient.get('/admin/transfer-requests'),
    approveTransferRequest: (id: string) =>
        apiClient.post(`/admin/transfer-requests/${id}/approve`),
    rejectTransferRequest: (id: string, note?: string) =>
        apiClient.post(`/admin/transfer-requests/${id}/reject`, { admin_note: note }),
};

// Types
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
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    password?: string;
    role?: 'employee' | 'admin' | 'hr';
    is_active?: boolean;
}

export interface ReportParams {
    start_date?: string;
    end_date?: string;
    user_id?: string;
}

export default apiClient;
