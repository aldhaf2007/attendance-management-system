import React, { useState, useEffect } from 'react';
import { 
  UserCheck, History, Award, BookOpen, Clock, Lock, 
  CheckCircle2, XCircle, LogIn, ShieldAlert, RefreshCw, GraduationCap,
  Building2, Search, Filter, Layers, ChevronRight, FileSpreadsheet,
  CalendarDays, RotateCcw, ListChecks, AlertTriangle, Users,
  LayoutGrid, Table as TableIcon, Calendar
} from 'lucide-react';
import { authApi, staffPortalApi } from '../api';

export default function StaffPortal() {
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'prof_smith', password: 'staff123' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [historyData, setHistoryData] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mobile responsive view mode: 'cards' on mobile (<768px), 'table' on desktop
  const [displayMode, setDisplayMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'shortage' | 'good'

  // Table Filter Controls
  const [tableFilterType, setTableFilterType] = useState('all'); // 'all' | 'monthly' | 'yearly' | 'daily' | 'custom'
  const [tableYear, setTableYear] = useState(new Date().getFullYear());
  const [tableMonth, setTableMonth] = useState(new Date().getMonth() + 1);
  const [tableDate, setTableDate] = useState(new Date().toISOString().split('T')[0]);
  const [tableStartDate, setTableStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [tableEndDate, setTableEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [appliedFilters, setAppliedFilters] = useState({ filter_type: 'all' });
  const [isFiltering, setIsFiltering] = useState(false);

  // View switch: 'daily' (Daily Attendance with Period 1-5) | 'roster' (Summary Roster) | 'audit' (Raw Records)
  const [viewMode, setViewMode] = useState('daily');

  // Excel Export Controls
  const [exportMode, setExportMode] = useState('all'); // 'all' | 'monthly' | 'yearly' | 'custom'
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportStartDate, setExportStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    checkStaffSession();
  }, []);

  const checkStaffSession = async () => {
    try {
      const meRes = await authApi.getMe();
      if (meRes.data.role === 'Staff' || meRes.data.role === 'Admin') {
        setIsStaffLoggedIn(true);
        fetchStaffHistory(selectedDeptId, appliedFilters);
      }
    } catch (err) {
      setIsStaffLoggedIn(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await authApi.login(loginForm.username, loginForm.password);
      const data = res.data;
      if (data.role !== 'Staff' && data.role !== 'Admin') {
        setLoginError('Account does not have Staff Portal access privileges.');
        return;
      }
      localStorage.setItem('active_jwt_token', data.access_token);
      setIsStaffLoggedIn(true);
      fetchStaffHistory(null, { filter_type: 'all' });
    } catch (err) {
      console.error('Staff login error:', err);
      setLoginError(err.response?.data?.detail || 'Invalid Staff ID or password.');
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchStaffHistory = async (deptId = selectedDeptId, customFilters = appliedFilters, fromFilterButton = false) => {
    if (fromFilterButton) {
      setIsFiltering(true);
    } else if (!historyData) {
      setLoading(true);
    }
    setError('');
    try {
      const params = {
        ...(deptId !== null && { department_id: deptId }),
        ...customFilters,
      };
      const res = await staffPortalApi.getMyHistory(params);
      setHistoryData(res.data);
      if (res.data?.available_years?.length > 0) {
        if (!res.data.available_years.includes(tableYear)) {
          setTableYear(res.data.available_years[0]);
          setExportYear(res.data.available_years[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff history:', err);
      setError(err.response?.data?.detail || 'Failed to load personal teaching history.');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const handleSelectDept = (deptId) => {
    setSelectedDeptId(deptId);
    fetchStaffHistory(deptId, appliedFilters);
  };

  const handleApplyFilter = async (customFilters = null) => {
    let filters = customFilters;
    if (!filters) {
      filters = { filter_type: tableFilterType };
      if (tableFilterType === 'yearly') {
        filters.year_date = tableYear;
      } else if (tableFilterType === 'monthly') {
        filters.year_date = tableYear;
        filters.month = tableMonth;
      } else if (tableFilterType === 'daily') {
        filters.target_date = tableDate;
      } else if (tableFilterType === 'custom') {
        filters.start_date = tableStartDate;
        filters.end_date = tableEndDate;
      }
    }
    setAppliedFilters(filters);
    await fetchStaffHistory(selectedDeptId, filters, true);
  };

  const handleResetFilter = () => {
    setTableFilterType('all');
    setAppliedFilters({ filter_type: 'all' });
    fetchStaffHistory(selectedDeptId, { filter_type: 'all' }, true);
  };

  const handleStaffExcelExport = async () => {
    setDownloading(true);
    try {
      const params = {
        export_type: exportMode,
      };
      if (selectedDeptId !== null) {
        params.department_id = selectedDeptId;
      }
      if (exportMode === 'yearly') {
        params.year_date = exportYear;
      } else if (exportMode === 'monthly') {
        params.year_date = exportYear;
        params.month = exportMonth;
      } else if (exportMode === 'custom') {
        if (!exportStartDate || !exportEndDate) {
          alert('Please select both Start Date and End Date for custom export.');
          setDownloading(false);
          return;
        }
        params.start_date = exportStartDate;
        params.end_date = exportEndDate;
      }
      await staffPortalApi.downloadExcel(params);
    } catch (err) {
      console.error('Failed to export staff attendance:', err);
      alert('Failed to download staff attendance report.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isStaffLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center">
            <div className="inline-flex p-2 rounded-3xl bg-white border border-slate-200 mb-3 shadow-md ring-4 ring-blue-50">
              <img 
                src="/logo.png" 
                alt="ARIGNAR ANNA COLLEGE" 
                className="w-16 h-16 object-contain rounded-2xl" 
              />
            </div>
            <p className="text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
              ARIGNAR ANNA COLLEGE
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900">Staff Personal Portal</h1>
            <p className="text-xs text-slate-500 mt-1">Level 3 Read-Only Teaching History & Analytics</p>
          </div>

          {loginError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Staff ID (Username)</label>
              <input
                type="text"
                placeholder="e.g. prof_smith"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-800 text-sm font-medium focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-800 text-sm font-medium focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? (
                <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In to Staff Portal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !historyData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
        <p className="text-slate-500 font-medium text-sm">Loading your personal teaching history & analytics...</p>
      </div>
    );
  }

  const rawRecords = historyData?.records || [];
  const records = rawRecords.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      rec.roll_no?.toLowerCase().includes(q) ||
      rec.student_name?.toLowerCase().includes(q) ||
      rec.department_name?.toLowerCase().includes(q) ||
      rec.date?.includes(q) ||
      `p${rec.hour_number}`.toLowerCase().includes(q) ||
      rec.status?.toLowerCase().includes(q)
    );
  });

  const availableYears = historyData?.available_years?.length > 0
    ? historyData.available_years
    : [new Date().getFullYear(), new Date().getFullYear() - 1];

  // 1. Group records for Daily Attendance Table (Period 1 to 5)
  // All records in historyData.records are ALREADY strictly those taken by this staff member.
  const dailyAttendanceMap = {};
  records.forEach((rec) => {
    const key = `${rec.date}_${rec.department_name}_${rec.roll_no}`;
    if (!dailyAttendanceMap[key]) {
      dailyAttendanceMap[key] = {
        key,
        date: rec.date,
        roll_no: rec.roll_no,
        student_name: rec.student_name,
        department_name: rec.department_name,
        year: rec.year,
        periods: { 1: null, 2: null, 3: null, 4: null, 5: null },
        presentCount: 0,
        absentCount: 0,
        odCount: 0,
        conductedCount: 0,
      };
    }
    dailyAttendanceMap[key].periods[rec.hour_number] = {
      status: rec.status,
      id: rec.id,
    };
    dailyAttendanceMap[key].conductedCount += 1;
    const sLower = (rec.status || '').toLowerCase();
    if (sLower === 'present') {
      dailyAttendanceMap[key].presentCount += 1;
    } else if (sLower === 'absent') {
      dailyAttendanceMap[key].absentCount += 1;
    } else if (sLower === 'od') {
      dailyAttendanceMap[key].odCount += 1;
      dailyAttendanceMap[key].presentCount += 1;
    }
  });

  const dailyAttendanceRows = Object.values(dailyAttendanceMap).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.roll_no.localeCompare(b.roll_no);
  });

  // 2. Aggregate student summary roster for periods taught by this staff member
  const summaryRosterMap = {};
  records.forEach((rec) => {
    const key = `${rec.roll_no}_${rec.department_name}`;
    if (!summaryRosterMap[key]) {
      summaryRosterMap[key] = {
        key,
        roll_no: rec.roll_no,
        student_name: rec.student_name,
        department_name: rec.department_name,
        year: rec.year,
        total_conducted: 0,
        present: 0,
        absent: 0,
        od: 0,
      };
    }
    summaryRosterMap[key].total_conducted += 1;
    const sLower = (rec.status || '').toLowerCase();
    if (sLower === 'present') {
      summaryRosterMap[key].present += 1;
    } else if (sLower === 'absent') {
      summaryRosterMap[key].absent += 1;
    } else if (sLower === 'od') {
      summaryRosterMap[key].od += 1;
    }
  });

  const summaryRosterRows = Object.values(summaryRosterMap).map((st) => {
    const effectivePresent = st.present + st.od;
    const pct = st.total_conducted > 0 ? Math.round((effectivePresent / st.total_conducted) * 1000) / 10 : 100.0;
    return {
      ...st,
      attendance_percentage: pct,
      has_shortage: pct < 75.0,
    };
  }).sort((a, b) => a.roll_no.localeCompare(b.roll_no));

  const shortageCount = summaryRosterRows.filter((st) => st.has_shortage).length;
  const goodCount = summaryRosterRows.filter((st) => !st.has_shortage && st.total_conducted > 0).length;

  const displayedRoster = summaryRosterRows.filter((st) => {
    if (statusFilter === 'shortage') return st.has_shortage;
    if (statusFilter === 'good') return !st.has_shortage && st.total_conducted > 0;
    return true;
  });

  const departmentThemes = [
    {
      badge: 'bg-blue-100 text-blue-900 border-blue-200',
      tabActive: 'bg-blue-900 text-white shadow-md shadow-blue-900/20',
      iconBg: 'bg-blue-50 text-blue-900 border-blue-200',
      border: 'border-blue-200',
      bar: 'bg-blue-600',
    },
    {
      badge: 'bg-purple-100 text-purple-900 border-purple-200',
      tabActive: 'bg-purple-900 text-white shadow-md shadow-purple-900/20',
      iconBg: 'bg-purple-50 text-purple-900 border-purple-200',
      border: 'border-purple-200',
      bar: 'bg-purple-600',
    },
    {
      badge: 'bg-teal-100 text-teal-900 border-teal-200',
      tabActive: 'bg-teal-900 text-white shadow-md shadow-teal-900/20',
      iconBg: 'bg-teal-50 text-teal-900 border-teal-200',
      border: 'border-teal-200',
      bar: 'bg-teal-600',
    },
    {
      badge: 'bg-amber-100 text-amber-900 border-amber-200',
      tabActive: 'bg-amber-900 text-white shadow-md shadow-amber-900/20',
      iconBg: 'bg-amber-50 text-amber-900 border-amber-200',
      border: 'border-amber-200',
      bar: 'bg-amber-600',
    },
  ];

  const getThemeForDept = (deptName) => {
    const index = historyData?.departments?.findIndex((d) => d.department_name === deptName);
    return departmentThemes[(index >= 0 ? index : 0) % departmentThemes.length];
  };

  const selectedDeptObj = historyData?.departments?.find((d) => d.department_id === selectedDeptId);

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-3 sm:py-8 space-y-4 sm:space-y-8">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img 
            src="/logo.png" 
            alt="ARIGNAR ANNA COLLEGE" 
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain border border-slate-200 bg-white shadow-xs shrink-0" 
          />
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
              ARIGNAR ANNA COLLEGE
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {historyData?.staff_name || historyData?.staff_username || 'Staff Portal'}
              </h1>
              {historyData?.staff_initials && (
                <span className="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-900 font-mono font-black text-xs border border-blue-200">
                  {historyData.staff_initials}
                </span>
              )}
              {historyData?.primary_department_name && (
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-200">
                  Dept: {historyData.primary_department_name}
                </span>
              )}
              {historyData?.departments && historyData.departments.length > 1 && (
                <span className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 font-extrabold text-xs border border-purple-200 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  Multi-Dept Faculty ({historyData.departments.length} Depts)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-blue-800 shrink-0" />
              Level 3 Read-Only Personal Teaching Records & Period Audit Trail
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchStaffHistory(selectedDeptId)}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-2 text-xs font-extrabold cursor-pointer shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh History
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Department Filter Selector Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="px-2.5 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Building2 className="w-4 h-4 text-slate-600" />
          <span>Department:</span>
        </div>

        <button
          onClick={() => handleSelectDept(null)}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
            selectedDeptId === null
              ? 'bg-blue-900 text-white shadow-md shadow-blue-900/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>All Departments</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
            selectedDeptId === null ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {historyData?.departments?.reduce((acc, d) => acc + d.classes_conducted, 0) || 0} classes
          </span>
        </button>

        {historyData?.departments?.map((dept, idx) => {
          const isSelected = selectedDeptId === dept.department_id;
          const theme = departmentThemes[idx % departmentThemes.length];
          return (
            <button
              key={dept.department_id}
              onClick={() => handleSelectDept(dept.department_id)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? theme.tabActive
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{dept.department_name}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {dept.classes_conducted} classes
              </span>
            </button>
          );
        })}
      </div>

      {/* Multi-Department Teaching Portfolio (Visible when viewing All Departments) */}
      {selectedDeptId === null && historyData?.departments && historyData.departments.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-50 text-purple-900 border border-purple-200">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Multi-Department Teaching Portfolio
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Summary breakdown across each department you teach in
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:inline-block">
              {historyData.departments.length} Active Teaching Departments
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyData.departments.map((dept, idx) => {
              const theme = departmentThemes[idx % departmentThemes.length];
              const isPrimary = dept.department_name === historyData.primary_department_name;
              return (
                <div
                  key={dept.department_id}
                  className={`border ${theme.border} rounded-2xl p-4.5 bg-gradient-to-br from-white to-slate-50 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl border ${theme.iconBg}`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">
                            {dept.department_name}
                          </h3>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isPrimary ? 'bg-blue-100 text-blue-900 border-blue-200' : 'bg-purple-50 text-purple-900 border-purple-200'
                          }`}>
                            {isPrimary ? 'Primary Dept' : 'Cross-Dept Teaching'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-base font-black text-slate-900 block">{dept.classes_conducted}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Classes</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-base font-black text-slate-900 block">{dept.records_logged}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Records</span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                        <span className="text-base font-black text-emerald-800 block">{dept.attendance_percentage}%</span>
                        <span className="text-[10px] text-emerald-700 font-medium">Attendance</span>
                      </div>
                    </div>

                    {/* Attendance Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Attendance Rate</span>
                        <span>{dept.attendance_percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${theme.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, dept.attendance_percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectDept(dept.department_id)}
                    className={`w-full mt-2 py-2 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer bg-white hover:bg-slate-100 text-slate-800 ${theme.border}`}
                  >
                    <span>Filter to {dept.department_name}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teaching Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200">
            <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Classes Taught</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">{historyData?.total_classes_conducted || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {selectedDeptObj ? selectedDeptObj.department_name : 'Across All Departments'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Award className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 font-medium block">Average Attendance Rate</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-800">{historyData?.average_attendance_percentage || 100}%</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {selectedDeptObj ? `${selectedDeptObj.department_name} Average` : 'All Taught Periods'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200">
            <History className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-amber-800 font-medium block">Total Records Logged</span>
            <span className="text-xl sm:text-2xl font-black text-amber-900">{historyData?.total_records_logged || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {selectedDeptObj ? `${selectedDeptObj.department_name} Records` : 'Logged Under Staff ID'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Attendance Table Card (Admin-style with Period 1-5 columns, Excel Export, & Filters) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        
        {/* Card Header with Title, Active Filter Badge, and View Mode Switch */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-900" />
                <span>Personal Teaching Attendance Table</span>
              </h3>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Showing: {historyData?.filter_label || 'All Days & Years'}
              </span>
              {selectedDeptObj && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200">
                  {selectedDeptObj.department_name}
                </span>
              )}
              {historyData?.total_classes_conducted > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {historyData.total_classes_conducted} Class{historyData.total_classes_conducted > 1 ? 'es' : ''} Taught
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Strictly displays and exports attendance for periods conducted by{' '}
              <strong className="text-slate-800">{historyData?.staff_name || historyData?.staff_username}</strong>. Unconducted periods display as '-'.
            </p>
          </div>

          {/* View Mode & Display Mode Toggles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
            {/* View Mode: Daily vs Summary Roster vs Audit Trail */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300 w-full sm:w-auto overflow-x-auto no-scrollbar justify-start sm:justify-center">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  viewMode === 'daily'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View attendance by date and individual periods 1 to 5"
              >
                <Clock className="w-3.5 h-3.5" />
                Daily Periods ({dailyAttendanceRows.length})
              </button>
              <button
                onClick={() => setViewMode('roster')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  viewMode === 'roster'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View student percentage summaries for periods taught by you"
              >
                <ListChecks className="w-3.5 h-3.5" />
                Summary Roster ({summaryRosterRows.length})
              </button>
              <button
                onClick={() => setViewMode('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  viewMode === 'audit'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View full audit log of individual student period entries"
              >
                <History className="w-3.5 h-3.5" />
                Audit Trail ({records.length})
              </button>
            </div>

            {/* Display Mode Toggle: Mobile Cards vs Full Table */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDisplayMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'cards'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mobile Cards view (Touch-friendly for smartphones)"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-900" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full Matrix Table view"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Status Filter Chips for Summary Roster */}
        {viewMode === 'roster' && (
          <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">Quick Filter:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All ({summaryRosterRows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('shortage')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'shortage'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              Shortage &lt;75% ({shortageCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('good')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'good'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Good ≥75% ({goodCount})
            </button>
          </div>
        )}

        {/* Excel Export Sub-Bar */}
        <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-200/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Staff Excel Export:
            </span>

            <div className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
              <label className="block text-[8px] uppercase font-bold text-emerald-800">Export Scope</label>
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value)}
                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Records (All Time)</option>
                <option value="monthly">By Month</option>
                <option value="yearly">Full Academic Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {(exportMode === 'monthly' || exportMode === 'yearly') && (
              <div className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                <label className="block text-[8px] uppercase font-bold text-emerald-800">Year</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {exportMode === 'monthly' && (
              <div className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                <label className="block text-[8px] uppercase font-bold text-emerald-800">Month</label>
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m}>
                      Month {m} ({new Date(exportYear, m - 1, 1).toLocaleString('default', { month: 'short' })})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {exportMode === 'custom' && (
              <>
                <div className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                  <label className="block text-[8px] uppercase font-bold text-emerald-800">Start Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                  <label className="block text-[8px] uppercase font-bold text-emerald-800">End Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleStaffExcelExport}
            disabled={downloading}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs shadow-emerald-700/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download formatted Excel workbook of periods conducted by you"
          >
            {downloading ? (
              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>{downloading ? 'Generating Excel...' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Filter Controls Bar (Admin-style) */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1">
            
            {/* Filter Mode Selector */}
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <label className="block text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-slate-400" />
                Filter Timeframe
              </label>
              <select
                value={tableFilterType}
                onChange={(e) => setTableFilterType(e.target.value)}
                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Days & Years (All Time)</option>
                <option value="monthly">By Month</option>
                <option value="yearly">By Year</option>
                <option value="daily">By Specific Day</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Year Selector */}
            {(tableFilterType === 'monthly' || tableFilterType === 'yearly') && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Year</label>
                <select
                  value={tableYear}
                  onChange={(e) => setTableYear(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Month Selector */}
            {tableFilterType === 'monthly' && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Month</label>
                <select
                  value={tableMonth}
                  onChange={(e) => setTableMonth(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m}>
                      Month {m} ({new Date(tableYear, m - 1, 1).toLocaleString('default', { month: 'short' })})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Selector for Specific Day */}
            {tableFilterType === 'daily' && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Select Date</label>
                <input
                  type="date"
                  value={tableDate}
                  onChange={(e) => setTableDate(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {/* Custom Range */}
            {tableFilterType === 'custom' && (
              <>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Start Date</label>
                  <input
                    type="date"
                    value={tableStartDate}
                    onChange={(e) => setTableStartDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">End Date</label>
                  <input
                    type="date"
                    value={tableEndDate}
                    onChange={(e) => setTableEndDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Action Buttons: Filter & Reset */}
            <button
              onClick={() => handleApplyFilter()}
              disabled={isFiltering}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Apply selected timeframe filter"
            >
              {isFiltering ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              ) : (
                <Filter className="w-4 h-4" />
              )}
              <span>{isFiltering ? 'Filtering...' : 'Filter'}</span>
            </button>

            {tableFilterType !== 'all' && (
              <button
                onClick={handleResetFilter}
                disabled={isFiltering}
                className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Reset to All Days & Years"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Show All</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student, roll, dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Zero Sessions Notification Banner */}
        {records.length === 0 && (
          <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">No sessions found for {historyData?.filter_label || 'selected filter'}.</span>
                <span className="block text-[11px] text-amber-700 mt-0.5">
                  Zero periods were conducted under your Staff ID during this timeframe. Try selecting another month, date, or reset to show all days.
                </span>
              </div>
            </div>
            <button
              onClick={handleResetFilter}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer"
            >
              Show All Days
            </button>
          </div>
        )}

        {/* VIEW 1: Daily Attendance (Cards vs Table) */}
        {viewMode === 'daily' && (
          displayMode === 'cards' ? (
            /* Mobile Cards View for Daily Periods */
            <div className={`p-3 sm:p-5 transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              {dailyAttendanceRows.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="font-bold text-sm">No daily attendance records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try selecting another timeframe or resetting filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {dailyAttendanceRows.map((row) => {
                    const theme = getThemeForDept(row.department_name);
                    return (
                      <div
                        key={row.key}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-blue-300 transition-all"
                      >
                        {/* Top Header: Date, Department, Year */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            {row.date}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                              <Building2 className="w-3 h-3 opacity-70" />
                              {row.department_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Y{row.year || 2}
                            </span>
                          </div>
                        </div>

                        {/* Student Roll No & Name */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-extrabold text-slate-900 truncate">{row.student_name}</h4>
                          </div>
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs shrink-0">
                            {row.roll_no}
                          </span>
                        </div>

                        {/* Periods 1 to 5 Status Micro-Row */}
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Periods (1 – 5)</span>
                          <div className="grid grid-cols-5 gap-1 text-center">
                            {[1, 2, 3, 4, 5].map((hour) => {
                              const pData = row.periods[hour];
                              if (!pData) {
                                return (
                                  <div
                                    key={hour}
                                    className="py-1.5 px-0.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-300 font-mono text-[10px]"
                                  >
                                    <span className="block text-[8px] text-slate-400 font-bold">P{hour}</span>
                                    -
                                  </div>
                                );
                              }
                              const sLower = (pData.status || '').toLowerCase();
                              const isPresent = sLower === 'present';
                              const isAbsent = sLower === 'absent';
                              return (
                                <div
                                  key={hour}
                                  className={`py-1.5 px-0.5 rounded-xl border text-[10px] font-black ${
                                    isPresent
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : isAbsent
                                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                                      : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}
                                >
                                  <span className="block text-[8px] text-slate-500 font-bold">P{hour}</span>
                                  {isPresent ? 'Pres' : isAbsent ? 'Abs' : 'OD'}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Footer: Taught Total & Taken By */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Taught Total</span>
                            <span className="font-mono font-bold text-slate-800">
                              {row.presentCount}/{row.conductedCount}{' '}
                              <span className="text-slate-500 font-normal">
                                ({row.conductedCount > 0 ? `${Math.round((row.presentCount / row.conductedCount) * 100)}%` : '0%'})
                              </span>
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-[11px] font-semibold truncate">
                            {historyData?.staff_initials && (
                              <span className="font-mono font-black text-[9px] bg-blue-200/80 px-1 rounded text-blue-950 shrink-0">
                                {historyData.staff_initials}
                              </span>
                            )}
                            <span className="truncate max-w-[110px]">{historyData?.staff_name || historyData?.staff_username}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Desktop Full Matrix Table View */
            <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              <table className="w-full text-left border-collapse min-w-[950px] bg-white">
                <thead className="sticky top-0 z-20 shadow-xs bg-slate-100">
                  <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Date</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3">Department</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Year</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 font-mono">Roll No</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4">Student Name</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 1</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 2</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 3</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 4</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 5</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Staff Taught Total</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Attendance Taken By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium bg-white">
                  {dailyAttendanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500 bg-white">
                        No daily attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    dailyAttendanceRows.map((row) => {
                      const theme = getThemeForDept(row.department_name);
                      return (
                        <tr key={row.key} className="hover:bg-slate-50 transition-colors bg-white">
                          <td className="py-3 px-4 sm:px-6 font-mono text-slate-800 font-semibold whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                              <Building2 className="w-3 h-3 opacity-70" />
                              {row.department_name}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Year {row.year || 2}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-extrabold text-blue-900 whitespace-nowrap">
                            {row.roll_no}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {row.student_name}
                          </td>

                          {/* Periods 1 to 5 Columns */}
                          {[1, 2, 3, 4, 5].map((hour) => {
                            const pData = row.periods[hour];
                            if (!pData) {
                              return (
                                <td key={hour} className="py-3 px-3 text-center text-slate-300 font-bold text-xs" title="Not taken by you / unrecorded">
                                  -
                                </td>
                              );
                            }
                            const sLower = (pData.status || '').toLowerCase();
                            const isPresent = sLower === 'present';
                            const isAbsent = sLower === 'absent';

                            return (
                              <td key={hour} className="py-3 px-3 text-center">
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wide ${
                                      isPresent
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isAbsent
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                  >
                                    {isPresent ? 'Present' : isAbsent ? 'Absent' : 'OD'}
                                  </span>
                                  {historyData?.staff_initials && (
                                    <span
                                      className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200"
                                      title={`Conducted by ${historyData?.staff_name || historyData?.staff_username}`}
                                    >
                                      {historyData.staff_initials}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Staff Taught Day Total */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {row.presentCount}/{row.conductedCount}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-semibold">
                              {row.conductedCount > 0 ? `${Math.round((row.presentCount / row.conductedCount) * 100)}%` : '0%'}
                            </span>
                          </td>

                          {/* Staff Taken By Attribution */}
                          <td className="py-3 px-4 sm:px-6 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold">
                              {historyData?.staff_initials && (
                                <span className="font-mono font-black text-[10px] bg-blue-200/80 px-1.5 py-0.5 rounded text-blue-950">
                                  {historyData.staff_initials}
                                </span>
                              )}
                              <span>{historyData?.staff_name || historyData?.staff_username}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* VIEW 2: Summary Roster (Cards vs Table) */}
        {viewMode === 'roster' && (
          displayMode === 'cards' ? (
            /* Mobile Cards View for Summary Roster */
            <div className={`p-3 sm:p-5 transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              {displayedRoster.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="font-bold text-sm">No student records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing the search or quick status filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {displayedRoster.map((st) => {
                    const theme = getThemeForDept(st.department_name);
                    return (
                      <div
                        key={st.key}
                        className={`bg-white border rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 ${
                          st.has_shortage
                            ? 'border-rose-300 ring-1 ring-rose-200/70 bg-rose-50/20'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {/* Top Header: Roll No badge, Department, Status */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
                            {st.roll_no}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                              <Building2 className="w-3 h-3 opacity-70" />
                              {st.department_name}
                            </span>
                            {st.has_shortage ? (
                              <span className="text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                &lt;75%
                              </span>
                            ) : (
                              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                ≥75%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Student Name & Year */}
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{st.student_name}</h4>
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            Year {st.year || 2}
                          </span>
                        </div>

                        {/* Visual Progress Bar & Big % */}
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Attendance Rate</span>
                            <span className={`font-mono font-black text-sm ${st.has_shortage ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {st.attendance_percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                st.has_shortage ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(st.attendance_percentage, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Breakdown Tally Badges */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                          <div className="bg-slate-100 py-1.5 px-1 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[9px]">TOTAL</span>
                            <span className="text-slate-800 font-black">{st.total_conducted}</span>
                          </div>
                          <div className="bg-emerald-50 py-1.5 px-1 rounded-lg border border-emerald-200">
                            <span className="text-emerald-600 block text-[9px]">PRES</span>
                            <span className="text-emerald-800 font-black">{st.present}</span>
                          </div>
                          <div className="bg-rose-50 py-1.5 px-1 rounded-lg border border-rose-200">
                            <span className="text-rose-600 block text-[9px]">ABS</span>
                            <span className="text-rose-800 font-black">{st.absent}</span>
                          </div>
                          <div className="bg-amber-50 py-1.5 px-1 rounded-lg border border-amber-200">
                            <span className="text-amber-700 block text-[9px]">OD</span>
                            <span className="text-amber-900 font-black">{st.od}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Desktop Full Matrix Table View */
            <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              <table className="w-full text-left border-collapse min-w-[750px] bg-white">
                <thead className="sticky top-0 z-20 shadow-xs bg-slate-100">
                  <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Roll No</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Student Name</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3">Department</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Year</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Periods Taught</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Present</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Absent</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">OD</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Attendance %</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium bg-white">
                  {displayedRoster.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 bg-white">
                        No student records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedRoster.map((st) => {
                      const theme = getThemeForDept(st.department_name);
                      return (
                        <tr key={st.key} className="hover:bg-slate-50 transition-colors bg-white">
                          <td className="py-3.5 px-4 sm:px-6 font-mono font-extrabold text-blue-900">{st.roll_no}</td>
                          <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">{st.student_name}</td>
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                              <Building2 className="w-3 h-3 opacity-70" />
                              {st.department_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Year {st.year || 2}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-700 font-bold">{st.total_conducted}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-700">{st.present}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-700">{st.absent}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-amber-700">{st.od}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`font-mono font-extrabold px-2.5 py-1 rounded-xl text-xs ${
                                st.has_shortage
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {st.attendance_percentage}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {st.has_shortage ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                Shortage (&lt;75%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Satisfactory
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* VIEW 3: Raw Audit Trail Records (Cards vs Table) */}
        {viewMode === 'audit' && (
          displayMode === 'cards' ? (
            /* Mobile Cards View for Audit Trail */
            <div className={`p-3 sm:p-5 transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              {records.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="font-bold text-sm">No audit records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting filter or choosing another timeframe.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {records.map((rec) => {
                    const theme = getThemeForDept(rec.department_name);
                    return (
                      <div
                        key={rec.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5 hover:border-blue-300 transition-all"
                      >
                        {/* Top Header: Date, Period */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            {rec.date}
                          </span>
                          <span className="font-black text-xs px-2.5 py-1 rounded-xl bg-blue-900 text-white shadow-2xs">
                            P{rec.hour_number}
                          </span>
                        </div>

                        {/* Dept & Year */}
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                            <Building2 className="w-3 h-3 opacity-70" />
                            {rec.department_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Year {rec.year || 2}
                          </span>
                        </div>

                        {/* Student Roll No & Name */}
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">{rec.student_name}</h4>
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 shrink-0">
                            {rec.roll_no}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Marked Status</span>
                          {rec.status === 'Present' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Present
                            </span>
                          )}
                          {rec.status === 'Absent' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Absent
                            </span>
                          )}
                          {rec.status === 'OD' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              OD
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Desktop Full Matrix Table View */
            <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              <table className="w-full text-left border-collapse min-w-[700px] bg-white">
                <thead className="sticky top-0 z-20 shadow-xs bg-slate-100">
                  <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Date</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Period</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Department</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Year</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Student Roll No</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Student Name</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Marked Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium bg-white">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 bg-white">
                        No audit records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => {
                      const theme = getThemeForDept(rec.department_name);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors bg-white">
                          <td className="py-3.5 px-4 sm:px-6 font-mono text-slate-600">{rec.date}</td>
                          <td className="py-3.5 px-3 text-center font-extrabold text-blue-900">P{rec.hour_number}</td>
                          <td className="py-3.5 px-4 sm:px-6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${theme.badge}`}>
                              <Building2 className="w-3 h-3 opacity-70" />
                              {rec.department_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Year {rec.year || 2}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-blue-900">{rec.roll_no}</td>
                          <td className="py-3.5 px-4 sm:px-6 text-slate-900 font-bold">{rec.student_name}</td>
                          <td className="py-3.5 px-4 text-center">
                            {rec.status === 'Present' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Present
                              </span>
                            )}
                            {rec.status === 'Absent' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                Absent
                              </span>
                            )}
                            {rec.status === 'OD' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300">
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                OD
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

    </div>
  );
}
