export interface WorkExperience {
    id?: string;
    employee_id?: string;
    company_name: string;
    start_date: string;
    end_date: string;
    description: string;
    attachment_urls?: string[]; // JSONStringArray
}

export interface EmployeeEvaluation {
    id?: string;
    employee_id?: string;
    year: number;
    score: string; // CUKUP, CUKUP BAIK, BAIK, SANGAT BAIK, ISTIMEWA
    evaluator_id?: string;
    evaluator?: any; // User type
}

export interface Employee {
    id: string;
    user_id?: string;
    user?: any; // User type

    // Biodata
    nik: string;
    ktp_number: string;
    name: string;
    photo_url?: string;
    gender: string;
    place_of_birth: string;
    date_of_birth: string;
    marital_status: string;
    children_count: number;
    address: string;
    residence_status: string;
    religion: string;
    blood_type: string;

    // Emergency Contact
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relation: string;

    // Employment
    position: string;
    office_id: string;
    office?: any; // Office type
    start_date: string;
    employment_status: string;
    end_contract_date?: string;

    // Management
    is_manager: boolean;
    manager_id?: string;
    manager?: any; // User type
    is_evaluator: boolean;

    // Competency
    education: string;
    grade: string;
    competencies: string;
    competency_attachments?: string[];

    // Payroll
    is_allowance: boolean;
    allowances?: string[];
    bank_account: string;
    bank_name: string;
    bpjs_kesehatan: string;
    bpjs_tenaga_kerja: string;
    npwp: string;
    basic_salary: number;

    // Exit
    resignation_date?: string;
    resignation_reason?: string;

    // Leave
    leave_balance: number;
    leave_used: number;

    created_at?: string;
    updated_at?: string;

    work_experiences?: WorkExperience[];
    employee_evaluations?: EmployeeEvaluation[];
}

export interface CreateEmployeeRequest {
    create_user: boolean;
    name?: string;
    email?: string;
    password?: string;
    user_id?: string;

    // Employee fields embedded
    id?: string;
    // ... all employee fields ...
    // In TS we can overlap via interface extension or just cast payload
}
