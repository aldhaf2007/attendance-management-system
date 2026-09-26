import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach stored JWT token
api.interceptors.request.use((config) => {
  if (config.headers.Authorization) {
    return config;
  }
  const isKioskPath = config.url?.startsWith('/attendance/submit') || config.url?.startsWith('/auth/kiosk/select-department');
  const token = isKioskPath
    ? (localStorage.getItem('kiosk_submission_token') || localStorage.getItem('active_jwt_token') || localStorage.getItem('kiosk_jwt_token'))
    : (localStorage.getItem('active_jwt_token') || localStorage.getItem('kiosk_submission_token') || localStorage.getItem('kiosk_jwt_token'));

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const authApi = {
  login: (username, password) => 
    api.post('/auth/login', { username, password }),
  
  getKioskStaffList: () => 
    api.get('/auth/kiosk/staff-list'),

  getPublicStaffList: () =>
    api.get('/auth/kiosk/public-staff-list'),
  
  kioskUnlock: (staff_id, pin, hour_number) => 
    api.post('/auth/kiosk/unlock', { staff_id, pin, hour_number }),

  directKioskUnlock: (data) =>
    api.post('/auth/kiosk/direct-unlock', data),

  selectKioskDepartment: (data) =>
    api.post('/auth/kiosk/select-department', data),

  getStaffDepartments: (staffId) =>
    api.get(`/auth/kiosk/staff/${staffId}/departments`),

  getKioskDepartments: () =>
    api.get('/auth/kiosk/departments'),
  
  getMe: () => 
    api.get('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),
};

export const studentApi = {
  getClassStudents: (dept_id, year) => 
    api.get(`/students/class/${dept_id}/${year}`),
};

export const attendanceApi = {
  getGrid: (department_id, year, target_date) => 
    api.get(`/attendance/grid`, { params: { department_id, year, target_date } }),
  
  submitAttendance: (payload, bypassTimeLock = false) => {
    const headers = {};
    if (bypassTimeLock) {
      headers['X-Bypass-Time-Lock'] = 'bypass-secret-test';
    }
    return api.post('/attendance/submit', payload, { headers });
  },

  getTodayCalendarStatus: (target_date = null) =>
    api.get('/attendance/calendar/today', { params: target_date ? { target_date } : {} }),
};

export const analyticsApi = {
  getSummary: (department_id = null, year = null, filters = {}) => {
    const params = { ...filters };
    if (department_id !== null && department_id !== undefined && department_id !== 'all') {
      params.department_id = department_id;
    }
    if (year !== null && year !== undefined && year !== 'all') {
      params.year = year;
    }
    return api.get('/analytics/attendance-summary', { params });
  },

  getGlobalOverview: (filters = {}) =>
    api.get('/analytics/global-overview', { params: filters }),
};

export const exportApi = {
  getAvailableYears: () => api.get('/export/available-years'),

  downloadExcel: async (dept_id, year, month = 1, year_date = 2026, start_date = null, end_date = null, export_type = 'monthly', report_format = 'comprehensive') => {
    const params = { export_type, year_date, month, report_format };
    if (export_type === 'custom') {
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
    }

    const response = await api.get(`/export/attendance/${dept_id}/${year}/${month}`, {
      params,
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from response header if present
    const contentDisposition = response.headers['content-disposition'];
    let filename = `Attendance_Dept${dept_id}_Y${year}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/);
      if (match && match[1]) {
        filename = match[1].replace(/["']/g, '');
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  },

  downloadGlobalExcel: async ({
    department_id = null,
    year = null,
    export_type = 'all',
    year_date = 2026,
    month = 1,
    target_date = null,
    start_date = null,
    end_date = null,
    report_format = 'comprehensive'
  } = {}) => {
    const params = { export_type, year_date, month, report_format };
    if (department_id !== null && department_id !== undefined && department_id !== 'all') {
      params.department_id = department_id;
    }
    if (year !== null && year !== undefined && year !== 'all') {
      params.year = year;
    }
    if (target_date) {
      params.target_date = target_date;
    }
    if (export_type === 'custom') {
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
    }

    const response = await api.get('/export/global-attendance-excel', {
      params,
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers['content-disposition'];
    let filename = report_format === 'daily_log' ? 'Daily_Attendance_Logs.xlsx' : 'Global_Attendance_Report.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/);
      if (match && match[1]) {
        filename = match[1].replace(/["']/g, '');
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  },

  downloadDailyLogExcel: async ({
    department_id = null,
    year = null,
    export_type = 'all',
    year_date = 2026,
    month = 1,
    target_date = null,
    start_date = null,
    end_date = null
  } = {}) => {
    const params = { export_type, year_date, month };
    if (department_id !== null && department_id !== undefined && department_id !== 'all') {
      params.department_id = department_id;
    }
    if (year !== null && year !== undefined && year !== 'all') {
      params.year = year;
    }
    if (target_date) {
      params.target_date = target_date;
    }
    if (export_type === 'custom') {
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
    }

    const response = await api.get('/export/daily-attendance-log-excel', {
      params,
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'Daily_Attendance_Logs.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/);
      if (match && match[1]) {
        filename = match[1].replace(/["']/g, '');
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  }
};

export const adminApi = {
  // Department CRUD
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (name, account_username = null, account_password = null) =>
    api.post('/admin/departments', { name, account_username, account_password }),
  updateDepartment: (id, name, account_username = null, account_password = null) =>
    api.put(`/admin/departments/${id}`, { name, account_username, account_password }),
  deleteDepartment: (id) =>
    api.delete(`/admin/departments/${id}`),

  // Staff User Management
  getStaff: () => api.get('/admin/staff'),
  createStaff: (name, initials, username, password, pin, department_id, additional_department_ids = []) =>
    api.post('/admin/staff', { name, initials, username, password, pin, department_id, additional_department_ids }),
  updateStaff: (id, name, initials, username, password, pin, department_id, additional_department_ids = undefined) =>
    api.put(`/admin/staff/${id}`, { name, initials, username, password, pin, department_id, additional_department_ids }),
  deleteStaff: (id) =>
    api.delete(`/admin/staff/${id}`),

  // Student CRUD
  getStudents: () => api.get('/admin/students'),
  createStudent: (roll_no, name, year, department_id) =>
    api.post('/admin/students', { roll_no, name, year, department_id }),
  updateStudent: (roll_no, name, year, department_id) =>
    api.put(`/admin/students/${roll_no}`, { name, year, department_id }),
  deleteStudent: (roll_no) =>
    api.delete(`/admin/students/${roll_no}`),

  // Academic Calendar & Holiday Management
  getCalendarOverrides: (params = {}) =>
    api.get('/admin/calendar/overrides', { params }),
  setCalendarOverride: ({ date, day_type, active_periods, description }) =>
    api.post('/admin/calendar/override', { date, day_type, active_periods, description }),
  deleteCalendarOverride: (dateStr) =>
    api.delete(`/admin/calendar/override/${dateStr}`),
};

export const staffPortalApi = {
  getMyHistory: (params = {}) => {
    const queryParams = typeof params === 'number' || typeof params === 'string'
      ? { department_id: params }
      : params;
    return api.get('/staff/my-history', { params: queryParams });
  },

  downloadExcel: async (params = {}) => {
    const response = await api.get('/staff/export-excel', {
      params,
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'Staff_Attendance_Report.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=(.+)/);
      if (match && match[1]) {
        filename = match[1].replace(/["']/g, '');
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  }
};

export default api;
