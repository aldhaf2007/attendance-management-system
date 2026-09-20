import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Users, UserCheck, UserX, AlertTriangle, 
  TrendingUp, ShieldAlert, CheckCircle2, RefreshCw,
  Filter, Calendar, RotateCcw, Search, Clock, ListChecks, CalendarDays,
  Building2, Award, ChevronRight, BarChart3, Layers, ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react';
import { analyticsApi, exportApi, adminApi } from '../api';

export default function AdminDashboard({
  departmentId = 'all',
  year = 'all',
  onDepartmentChange = () => {},
  onYearChange = () => {}
}) {
  const [departments, setDepartments] = useState([]);
  const [globalOverview, setGlobalOverview] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  // Active View Tab: 'overview' (Benchmarks & KPIs) | 'roster' (Student Roster) | 'logs' (Daily Period Logs)
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Active applied filter
  const [appliedFilters, setAppliedFilters] = useState({ filter_type: 'all' });

  // Excel Export Controls
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [exportMode, setExportMode] = useState('all'); // 'all' | 'monthly' | 'custom' | 'yearly'
  const [exportFormat, setExportFormat] = useState('comprehensive'); // 'comprehensive' | 'daily_log'
  const [availableYears, setAvailableYears] = useState([2026, 2025]);
  const [selectedYearDate, setSelectedYearDate] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // Load departments and available years on mount
  useEffect(() => {
    fetchDepartments();
    fetchAvailableYears();
  }, []);

  // Re-fetch analytics whenever scope or filters change
  useEffect(() => {
    fetchAllData(appliedFilters);
  }, [departmentId, year]);

  const fetchDepartments = async () => {
    try {
      const res = await adminApi.getDepartments();
      if (res.data) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch departments for analytics:', err);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      const res = await exportApi.getAvailableYears();
      if (res.data?.years && res.data.years.length > 0) {
        const merged = Array.from(new Set([...res.data.years, 2026, 2025])).sort((a, b) => b - a);
        setAvailableYears(merged);
        setSelectedYearDate(merged[0]);
        setTableYear(merged[0]);
      }
    } catch (err) {
      console.error('Failed to fetch available years:', err);
    }
  };

  const fetchAllData = async (filtersToUse = appliedFilters, fromFilterButton = false) => {
    if (fromFilterButton) {
      setIsFiltering(true);
    } else if (!summaryData && !globalOverview) {
      setLoading(true);
    }
    setError('');

    try {
      const [overviewRes, summaryRes] = await Promise.allSettled([
        analyticsApi.getGlobalOverview(filtersToUse),
        analyticsApi.getSummary(departmentId, year, filtersToUse)
      ]);

      if (overviewRes.status === 'fulfilled') {
        setGlobalOverview(overviewRes.value.data);
      } else {
        console.warn('Global overview fetch failed:', overviewRes.reason);
      }

      if (summaryRes.status === 'fulfilled') {
        setSummaryData(summaryRes.value.data);
      } else {
        console.warn('Attendance summary fetch failed:', summaryRes.reason);
        if (overviewRes.status !== 'fulfilled') {
          setError(summaryRes.reason?.response?.data?.detail || 'Failed to load attendance analytics data.');
        }
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError('An unexpected error occurred while loading analytics.');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
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
    await fetchAllData(filters, true);
  };

  const handleResetFilter = () => {
    setTableFilterType('all');
    handleApplyFilter({ filter_type: 'all' });
  };

  const handleExcelExport = async (overrideFormat = null) => {
    setDownloading(true);
    const formatToUse = overrideFormat || exportFormat;
    try {
      if (exportMode === 'custom' && (!startDate || !endDate)) {
        alert('Please select both Start Date and End Date for custom export.');
        setDownloading(false);
        return;
      }
      if (formatToUse === 'daily_log') {
        await exportApi.downloadDailyLogExcel({
          department_id: departmentId === 'all' ? null : departmentId,
          year: year === 'all' ? null : year,
          export_type: exportMode,
          year_date: selectedYearDate,
          month: selectedMonth,
          start_date: startDate,
          end_date: endDate
        });
      } else {
        await exportApi.downloadGlobalExcel({
          department_id: departmentId === 'all' ? null : departmentId,
          year: year === 'all' ? null : year,
          export_type: exportMode,
          year_date: selectedYearDate,
          month: selectedMonth,
          start_date: startDate,
          end_date: endDate,
          report_format: 'comprehensive'
        });
      }
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert(err.response?.data?.detail || 'Failed to download Excel report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportDailyTableDirect = async () => {
    setDownloading(true);
    try {
      await exportApi.downloadDailyLogExcel({
        department_id: departmentId === 'all' ? null : departmentId,
        year: year === 'all' ? null : year,
        export_type: tableFilterType,
        year_date: tableYear,
        month: tableMonth,
        target_date: tableDate,
        start_date: tableStartDate,
        end_date: tableEndDate
      });
    } catch (err) {
      console.error('Failed to export daily table view:', err);
      alert(err.response?.data?.detail || 'Failed to download daily table view.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !summaryData && !globalOverview) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
        <p className="text-slate-500 font-bold text-sm">Computing institution-wide analytics and benchmarks...</p>
      </div>
    );
  }

  // Prepared data
  const allStudents = summaryData?.all_students || [];
  const dailyLogs = summaryData?.daily_logs || [];
  const shortageStudents = globalOverview?.shortage_students || allStudents.filter(s => s.has_shortage);

  // Filtered students for Roster table
  const filteredStudents = allStudents.filter(st =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (st.department_name && st.department_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group daily logs into date + roll_no rows with Period 1 to 5
  const dailyAttendanceMap = {};
  dailyLogs.forEach((log) => {
    const key = `${log.date}_${log.roll_no}`;
    if (!dailyAttendanceMap[key]) {
      dailyAttendanceMap[key] = {
        key,
        date: log.date,
        roll_no: log.roll_no,
        student_name: log.student_name,
        department_name: log.department_name,
        year: log.year,
        periods: { 1: null, 2: null, 3: null, 4: null, 5: null },
        staffMap: {},
        presentCount: 0,
        absentCount: 0,
        conductedCount: 0
      };
    }
    dailyAttendanceMap[key].periods[log.hour_number] = {
      status: log.status,
      staff_name: log.staff_name,
      staff_initials: log.staff_initials
    };
    dailyAttendanceMap[key].conductedCount += 1;
    if (log.status?.toLowerCase() === 'present' || log.status?.toLowerCase() === 'od') {
      dailyAttendanceMap[key].presentCount += 1;
    } else if (log.status?.toLowerCase() === 'absent') {
      dailyAttendanceMap[key].absentCount += 1;
    }
    if (log.staff_initials) {
      dailyAttendanceMap[key].staffMap[log.staff_initials] = log.staff_name || log.staff_initials;
    }
  });

  const dailyAttendanceRows = Object.values(dailyAttendanceMap).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.roll_no.localeCompare(b.roll_no);
  });

  const filteredDailyRows = dailyAttendanceRows.filter((row) =>
    row.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.date.includes(searchQuery) ||
    (row.department_name && row.department_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    Object.keys(row.staffMap).some((init) => init.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Active KPI numbers
  const displayPercentage = summaryData?.class_average_percentage ?? globalOverview?.overall_percentage ?? 0.0;
  const displayStudents = summaryData?.total_students ?? globalOverview?.total_students ?? 0;
  const displayConducted = summaryData?.total_hours_in_period ?? globalOverview?.total_hours_conducted ?? 0;
  const displayShortages = globalOverview?.shortage_count ?? allStudents.filter(s => s.has_shortage).length;
  const displayTodayPresent = summaryData?.today_present ?? globalOverview?.today_present ?? 0;
  const displayTodayAbsent = summaryData?.today_absent ?? globalOverview?.today_absent ?? 0;

  // Selected scope description label
  const selectedDeptObj = departments.find(d => d.id === departmentId);
  const scopeLabel = departmentId === 'all'
    ? 'All Departments (College-Wide)'
    : `${selectedDeptObj ? selectedDeptObj.name : `Dept #${departmentId}`}`;
  const yearScopeLabel = year === 'all' ? 'All Years (1st, 2nd, 3rd)' : `Year ${year}`;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* Top Header & Global Multi-Sheet Excel Export Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div>
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
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Institutional Analytics & Intelligence
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Comprehensive college-wide attendance monitoring, cross-department benchmarking & reporting
              </p>
            </div>
          </div>
        </div>

        {/* Global Scope Selectors & Multi-Sheet Excel Export */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
          
          {/* Department Scope Selector */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Department</label>
            <select
              value={departmentId}
              onChange={(e) => onDepartmentChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900 font-bold">All Departments (College-Wide)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id} className="bg-white text-slate-900">
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Class Year Selector */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Academic Year</label>
            <select
              value={year}
              onChange={(e) => onYearChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900 font-bold">All Years (1st, 2nd, 3rd)</option>
              <option value={1} className="bg-white text-slate-900">1st Year</option>
              <option value={2} className="bg-white text-slate-900">2nd Year</option>
              <option value={3} className="bg-white text-slate-900">3rd Year</option>
            </select>
          </div>

          {/* Report Format Selector */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Report Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="comprehensive" className="bg-white text-slate-900 font-semibold">
                📊 Comprehensive (Multi-Sheet)
              </option>
              <option value="daily_log" className="bg-white text-slate-900 font-semibold">
                📋 Daily Attendance View (Table)
              </option>
            </select>
          </div>

          {/* Excel Export Mode */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Export Scope</label>
            <select
              value={exportMode}
              onChange={(e) => setExportMode(e.target.value)}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900 font-semibold">Complete (All Time)</option>
              <option value="monthly" className="bg-white text-slate-900 font-semibold">Monthly Breakdown</option>
              <option value="yearly" className="bg-white text-slate-900 font-semibold">Full Academic Year</option>
              <option value="custom" className="bg-white text-slate-900 font-semibold">Custom Date Range</option>
            </select>
          </div>

          {/* Export Year / Month Pickers */}
          {exportMode === 'yearly' && (
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <label className="block text-[9px] uppercase font-bold text-slate-500">Calendar Year</label>
              <select
                value={selectedYearDate}
                onChange={(e) => setSelectedYearDate(parseInt(e.target.value))}
                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-white text-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {exportMode === 'monthly' && (
            <>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Year</label>
                <select
                  value={selectedYearDate}
                  onChange={(e) => setSelectedYearDate(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-white text-slate-900">{y}</option>
                  ))}
                </select>
              </div>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                    <option key={m} value={m} className="bg-white text-slate-900">
                      {new Date(selectedYearDate, m - 1, 1).toLocaleString('default', { month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {exportMode === 'custom' && (
            <>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </>
          )}

          {/* Export Button */}
          <button
            onClick={() => handleExcelExport()}
            disabled={downloading}
            className="col-span-2 sm:col-span-1 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            title={`Download ${exportFormat === 'daily_log' ? 'Daily Attendance Table View' : '4-sheet Comprehensive Institutional'} Excel workbook`}
          >
            {downloading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export {exportFormat === 'daily_log' ? 'Daily Table' : 'Multi-Sheet'} (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Card 1: Attendance Percentage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">Attendance Rate</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {displayPercentage}%
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate max-w-[140px]">
              {summaryData?.filter_label || 'All Days'}
            </span>
          </div>
        </div>

        {/* Card 2: Enrolled Students */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">Total Enrolled</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {displayStudents}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate max-w-[140px]">
              {scopeLabel}
            </span>
          </div>
        </div>

        {/* Card 3: Conducted Sessions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-cyan-50 text-cyan-900 border border-cyan-200">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">Sessions Held</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {displayConducted}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Period Hours Logged
            </span>
          </div>
        </div>

        {/* Card 4: Today's Roll Call */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-emerald-700 font-bold block uppercase tracking-wider">Today's Roll Call</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-800">{displayTodayPresent}</span>
              <span className="text-xs font-semibold text-slate-400">/</span>
              <span className="text-xs font-bold text-rose-700">{displayTodayAbsent} abs</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              Today's Attendance
            </span>
          </div>
        </div>

        {/* Card 5: Shortage Alert */}
        <div className={`col-span-2 lg:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4 transition-all ${
          displayShortages > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className={`p-3 rounded-2xl border ${
            displayShortages > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-[11px] font-bold block uppercase tracking-wider ${
              displayShortages > 0 ? 'text-rose-800' : 'text-slate-500'
            }`}>
              Shortage (&lt;75%)
            </span>
            <span className={`text-xl sm:text-2xl font-black ${
              displayShortages > 0 ? 'text-rose-900' : 'text-slate-900'
            }`}>
              {displayShortages}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
              {displayShortages > 0 ? 'Students require review' : 'No shortage issues'}
            </span>
          </div>
        </div>

      </div>

      {/* Main Container with Tab Bar & Timeframe Filters */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        
        {/* Navigation Tabs Bar */}
        <div className="p-4 sm:p-6 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Views:</span>
            <div className="inline-flex rounded-2xl bg-slate-200/80 p-1 border border-slate-300 w-full md:w-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span>Overview & Benchmarks</span>
              </button>
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === 'roster'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListChecks className="w-4 h-4 text-emerald-700" />
                <span>Student Roster ({filteredStudents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4 text-indigo-700" />
                <span>Daily Period Logs ({dailyAttendanceRows.length})</span>
              </button>
            </div>
          </div>

          {/* Active Scope Badge */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-blue-50 text-blue-900 border border-blue-200">
              <Building2 className="w-3.5 h-3.5" />
              {scopeLabel}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full font-bold bg-slate-200 text-slate-800">
              {yearScopeLabel}
            </span>
          </div>

        </div>

        {/* Dedicated Timeframe Filter Bar */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1">
            
            {/* Filter Mode Selector */}
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <label className="block text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-slate-400" />
                Timeframe
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

            {/* Year Selector for Monthly & Yearly */}
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

            {/* Month Selector for Monthly */}
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

            {/* Custom Range: Start & End */}
            {tableFilterType === 'custom' && (
              <>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">From Date</label>
                  <input
                    type="date"
                    value={tableStartDate}
                    onChange={(e) => setTableStartDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">To Date</label>
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
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Apply selected filter"
            >
              {isFiltering ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              ) : (
                <Filter className="w-3.5 h-3.5" />
              )}
              <span>{isFiltering ? 'Filtering...' : 'Apply Filter'}</span>
            </button>

            {tableFilterType !== 'all' && (
              <button
                onClick={handleResetFilter}
                disabled={isFiltering}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Reset to All Days & Years"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student, roll no, dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
        </div>

        {/* TAB 1: OVERVIEW & BENCHMARKS */}
        {activeTab === 'overview' && (
          <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
            
            {/* 1. Department Benchmark Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-800" />
                    Department Performance & Benchmarks
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparative attendance rates, student cohorts, and shortage counts across departments
                  </p>
                </div>
                {departmentId !== 'all' && (
                  <button
                    onClick={() => onDepartmentChange('all')}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Show All Departments</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(globalOverview?.departments || []).map((dept) => {
                  const isCurrent = departmentId === dept.department_id;
                  const isHigh = dept.attendance_percentage >= 75.0;
                  return (
                    <div
                      key={dept.department_id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isCurrent 
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20' 
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                            {dept.department_code}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 mt-2">{dept.department_name}</h4>
                          <span className="text-xs text-slate-500 font-medium">
                            {dept.total_students} Enrolled • {dept.total_hours_conducted} Periods
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-black ${isHigh ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {dept.attendance_percentage}%
                          </span>
                          <span className="block text-[10px] text-slate-400 font-medium">Average</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${isHigh ? 'bg-emerald-600' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, dept.attendance_percentage))}%` }}
                        ></div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {dept.shortage_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              {dept.shortage_count} &lt;75%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Satisfactory
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            onDepartmentChange(dept.department_id);
                            setActiveTab('roster');
                          }}
                          className="font-bold text-blue-900 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Roster</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Academic Year Benchmarks (1st, 2nd, 3rd Year) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-800" />
                    Academic Year Benchmarks (Years 1, 2, 3)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cross-cohort comparison between 1st Year, 2nd Year, and 3rd Year classes
                  </p>
                </div>
                {year !== 'all' && (
                  <button
                    onClick={() => onYearChange('all')}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Show All Years</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(globalOverview?.year_benchmarks || [
                  { year: 1, year_label: '1st Year', total_students: 0, total_hours_conducted: 0, attendance_percentage: 0, shortage_count: 0 },
                  { year: 2, year_label: '2nd Year', total_students: 0, total_hours_conducted: 0, attendance_percentage: 0, shortage_count: 0 },
                  { year: 3, year_label: '3rd Year', total_students: 0, total_hours_conducted: 0, attendance_percentage: 0, shortage_count: 0 }
                ]).map((yr) => {
                  const isCurrent = year === yr.year;
                  const isHigh = yr.attendance_percentage >= 75.0;
                  return (
                    <div
                      key={yr.year}
                      className={`p-5 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-black text-indigo-900 bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200">
                            {yr.year_label}
                          </span>
                          <span className="block text-xs text-slate-500 font-medium mt-2">
                            {yr.total_students} Students • {yr.total_hours_conducted} Sessions
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-black ${isHigh ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {yr.attendance_percentage}%
                          </span>
                          <span className="block text-[10px] text-slate-400 font-medium">Rate</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${isHigh ? 'bg-emerald-600' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, yr.attendance_percentage))}%` }}
                        ></div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        {yr.shortage_count > 0 ? (
                          <span className="text-rose-700 font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {yr.shortage_count} in Shortage
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Good Standing
                          </span>
                        )}

                        <button
                          onClick={() => {
                            onYearChange(yr.year);
                            setActiveTab('roster');
                          }}
                          className="font-bold text-indigo-900 hover:text-indigo-950 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Filter Year</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Shortage Alert Watchlist */}
            <div className="border border-rose-200 bg-rose-50/40 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-rose-950">
                      Attendance Shortage Watchlist (&lt;75% Attendance)
                    </h4>
                    <p className="text-xs text-rose-700">
                      Students flagged as in danger of semester exam debarment due to attendance shortages
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-200 text-rose-900 font-black text-xs rounded-full border border-rose-300">
                  {shortageStudents.length} Students Flagged
                </span>
              </div>

              {shortageStudents.length === 0 ? (
                <div className="p-6 bg-white rounded-xl border border-emerald-200 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
                  <p className="text-xs font-black text-emerald-900">Zero Attendance Shortages</p>
                  <p className="text-[11px] text-emerald-700">All students are currently meeting or exceeding the 75% attendance requirement.</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-rose-200 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-rose-100/70 text-rose-950 font-bold border-b border-rose-200">
                        <th className="py-2.5 px-4 font-mono">Roll No</th>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-3 text-center">Year</th>
                        <th className="py-2.5 px-3 text-center">Hours</th>
                        <th className="py-2.5 px-3 text-center">Present</th>
                        <th className="py-2.5 px-3 text-center">Absent</th>
                        <th className="py-2.5 px-4 text-center">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {shortageStudents.slice(0, 15).map((st) => (
                        <tr key={st.roll_no} className="hover:bg-rose-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-extrabold text-blue-900">{st.roll_no}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{st.name}</td>
                          <td className="py-2.5 px-4 text-slate-600">{st.department_name || 'N/A'}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">{st.year}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">{st.total_hours_conducted}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">{st.present_hours}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-700">{st.absent_hours}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="font-mono font-black px-2 py-0.5 rounded-lg text-xs bg-rose-100 text-rose-900 border border-rose-300">
                              {st.attendance_percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {shortageStudents.length > 15 && (
                    <div className="p-2.5 text-center bg-rose-50/50 border-t border-rose-100 text-[11px] font-bold text-rose-800">
                      Showing first 15 of {shortageStudents.length} shortage students. View full list in the Student Roster tab.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: STUDENT ATTENDANCE ROSTER */}
        {activeTab === 'roster' && (
          <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="sticky top-0 z-20 shadow-xs">
                <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Roll No</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Student Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4">Department</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Year</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Hours</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Present</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Absent</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">OD</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Attendance %</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-2">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-700 text-sm">
                          {departmentId !== 'all' && selectedDeptObj
                            ? `No students are currently enrolled in ${selectedDeptObj.name}`
                            : 'No student records found matching the criteria'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {departmentId !== 'all'
                            ? 'Students must be registered in this department before attendance records can be tracked or displayed.'
                            : 'Try adjusting your search query or scope filters.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.roll_no} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono font-extrabold text-blue-900">{st.roll_no}</td>
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">{st.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {st.department_name || `Dept #${st.department_id}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">Yr {st.year}</td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-700">{st.total_hours_conducted}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-700">{st.present_hours}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-700">{st.absent_hours}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-amber-700">{st.od_hours}</td>
                      <td className="py-3.5 px-4 text-center">
                        {st.total_hours_conducted === 0 ? (
                          <span className="font-mono font-bold px-2.5 py-1 rounded-xl text-xs bg-slate-100 text-slate-400 border border-slate-200">
                            0.0%
                          </span>
                        ) : (
                          <span
                            className={`font-mono font-extrabold px-2.5 py-1 rounded-xl text-xs ${
                              st.has_shortage
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {st.attendance_percentage}%
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {st.total_hours_conducted === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            No Sessions
                          </span>
                        ) : st.attendance_percentage < 75 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            &lt;75% Shortage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Satisfactory
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: PERIOD MATRIX & DAILY ATTENDANCE LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            {/* Quick Export Bar for Daily Attendance Table */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-700" />
                <span className="font-extrabold text-slate-800">
                  Daily Period Attendance View
                </span>
                <span className="text-slate-500 font-medium">
                  ({filteredDailyRows.length} daily entries)
                </span>
              </div>
              <button
                onClick={handleExportDailyTableDirect}
                disabled={downloading}
                className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Download this filtered daily table directly as Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Daily Table (.xlsx)</span>
              </button>
            </div>

            <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead className="sticky top-0 z-20 shadow-xs">
                <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Date</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 font-mono">Roll No</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4">Student Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3">Department</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-2 text-center">Yr</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 1</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 2</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 3</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 4</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 5</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Day Total</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Taken By (Staff)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                {filteredDailyRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-700 text-sm">
                          {departmentId !== 'all' && selectedDeptObj
                            ? `No attendance records logged for ${selectedDeptObj.name}`
                            : 'No daily attendance records found matching the criteria'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {departmentId !== 'all'
                            ? 'Once students are enrolled in this department and staff submit attendance, period logs will appear here.'
                            : 'Try adjusting your search query, date filter, or scope selection.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDailyRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 sm:px-6 font-mono text-slate-800 font-semibold whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-blue-900">
                        {row.roll_no}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {row.student_name}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {row.department_name || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700">
                        {row.year || '-'}
                      </td>

                      {/* Period 1 to 5 Columns */}
                      {[1, 2, 3, 4, 5].map((hour) => {
                        const pData = row.periods[hour];
                        if (!pData) {
                          return (
                            <td key={hour} className="py-3 px-3 text-center text-slate-300 font-bold text-xs">
                              -
                            </td>
                          );
                        }
                        const isPresent = pData.status?.toLowerCase() === 'present';
                        const isAbsent = pData.status?.toLowerCase() === 'absent';

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
                              {pData.staff_initials && (
                                <span
                                  className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200"
                                  title={pData.staff_name ? `Taken by ${pData.staff_name}` : `Staff: ${pData.staff_initials}`}
                                >
                                  {pData.staff_initials}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Day Total */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {row.presentCount}/{row.conductedCount}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-semibold">
                          {row.conductedCount > 0 ? `${Math.round((row.presentCount / row.conductedCount) * 100)}%` : '0%'}
                        </span>
                      </td>

                      {/* Staff Taken By Attribution */}
                      <td className="py-3 px-4 sm:px-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Object.keys(row.staffMap).length === 0 ? (
                            <span className="text-slate-400 text-xs">-</span>
                          ) : (
                            Object.entries(row.staffMap).map(([initials, name]) => (
                              <span
                                key={initials}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-medium"
                                title={name}
                              >
                                <span className="font-mono font-black text-[10px] bg-blue-200/80 px-1 rounded text-blue-950">
                                  {initials}
                                </span>
                                <span className="truncate max-w-[120px]">{name}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
