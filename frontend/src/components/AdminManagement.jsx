import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, UserPlus, Users, Plus, Trash2, Edit, ShieldCheck, 
  CheckCircle2, AlertCircle, RefreshCw, Search, Filter, X, GraduationCap,
  LayoutDashboard, CheckSquare, Square
} from 'lucide-react';
import { adminApi } from '../api';

const formatApiError = (err, fallback = 'An unexpected error occurred.') => {
  if (!err) return fallback;
  const data = err.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  const detail = data?.detail;
  if (!detail) return err.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        if (typeof item === 'string') return item;
        if (item?.msg) {
          const loc = Array.isArray(item.loc) ? item.loc.filter(x => x !== 'body').join(' -> ') : '';
          return loc ? `${loc}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail);
  }
  return String(detail);
};

export default function AdminManagement() {
  const [activeTab, setActiveTab] = useState('departments');
  const staffFormRef = useRef(null);
  
  const [departments, setDepartments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [deptForm, setDeptForm] = useState({ name: '', account_username: '', account_password: '' });
  const [editDeptId, setEditDeptId] = useState(null);

  const [staffForm, setStaffForm] = useState({ 
    name: '', 
    initials: '', 
    username: '', 
    password: '', 
    pin: '', 
    department_id: '',
    additional_department_ids: []
  });
  const [editStaffId, setEditStaffId] = useState(null);

  const [studentForm, setStudentForm] = useState({ roll_no: '', name: '', year: 2, department_id: '' });
  const [editStudentRoll, setEditStudentRoll] = useState(null);

  // --- Filter states for easy roster & management access ---
  const [deptSearch, setDeptSearch] = useState('');

  const [staffSearch, setStaffSearch] = useState('');
  const [staffDeptFilter, setStaffDeptFilter] = useState('all');

  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('all');
  const [studentYearFilter, setStudentYearFilter] = useState('all');

  // Filtered lists
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase().trim();
    return departments.filter(d => 
      d.name?.toLowerCase().includes(q) ||
      String(d.id).includes(q) ||
      d.account_username?.toLowerCase().includes(q)
    );
  }, [departments, deptSearch]);

  const filteredStaff = useMemo(() => {
    return staffList.filter(st => {
      if (staffDeptFilter !== 'all') {
        const matchesPrimary = String(st.department_id) === String(staffDeptFilter);
        const matchesAdditional = Array.isArray(st.additional_department_ids) && 
          st.additional_department_ids.some(id => String(id) === String(staffDeptFilter));
        if (!matchesPrimary && !matchesAdditional) {
          return false;
        }
      }
      if (!staffSearch.trim()) return true;
      const q = staffSearch.toLowerCase().trim();
      const dept = departments.find(d => d.id === st.department_id);
      const additionalNames = (st.additional_departments || [])
        .map(d => (typeof d === 'string' ? d : (d?.name || '')))
        .join(' ')
        .toLowerCase();
      return (
        st.name?.toLowerCase().includes(q) ||
        st.initials?.toLowerCase().includes(q) ||
        st.username?.toLowerCase().includes(q) ||
        dept?.name?.toLowerCase().includes(q) ||
        st.department_name?.toLowerCase().includes(q) ||
        additionalNames.includes(q)
      );
    });
  }, [staffList, staffDeptFilter, staffSearch, departments]);

  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (studentDeptFilter !== 'all' && String(st.department_id) !== String(studentDeptFilter)) {
        return false;
      }
      if (studentYearFilter !== 'all' && String(st.year) !== String(studentYearFilter)) {
        return false;
      }
      if (!studentSearch.trim()) return true;
      const q = studentSearch.toLowerCase().trim();
      const dept = departments.find(d => d.id === st.department_id);
      return (
        st.roll_no?.toLowerCase().includes(q) ||
        st.name?.toLowerCase().includes(q) ||
        dept?.name?.toLowerCase().includes(q)
      );
    });
  }, [students, studentDeptFilter, studentYearFilter, studentSearch, departments]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async (preserveMessage = false) => {
    setLoading(true);
    if (!preserveMessage) {
      setMessage({ type: '', text: '' });
    }
    try {
      const [deptRes, staffRes, studentRes] = await Promise.all([
        adminApi.getDepartments(),
        adminApi.getStaff(),
        adminApi.getStudents()
      ]);
      setDepartments(deptRes.data);
      setStaffList(staffRes.data);
      setStudents(studentRes.data);

      if (deptRes.data.length > 0) {
        if (!staffForm.department_id) setStaffForm(prev => ({ ...prev, department_id: deptRes.data[0].id }));
        if (!studentForm.department_id) setStudentForm(prev => ({ ...prev, department_id: deptRes.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load admin management data:', err);
      setMessage({ type: 'error', text: 'Failed to load management data. Verify Admin token.' });
    } finally {
      setLoading(false);
    }
  };

  // --- Department Handlers ---
  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name) return;
    try {
      if (editDeptId) {
        const res = await adminApi.updateDepartment(
          editDeptId,
          deptForm.name.trim(),
          deptForm.account_username?.trim() || null,
          deptForm.account_password?.trim() || null
        );
        const username = res.data?.account_username || deptForm.account_username;
        setMessage({ 
          type: 'success', 
          text: `Department ID #${editDeptId} updated! Dedicated Dashboard Login: @${username}` 
        });
        setEditDeptId(null);
      } else {
        const res = await adminApi.createDepartment(
          deptForm.name.trim(),
          deptForm.account_username?.trim() || null,
          deptForm.account_password?.trim() || null
        );
        const username = res.data?.account_username;
        setMessage({ 
          type: 'success', 
          text: `Department '${deptForm.name}' created successfully with dedicated Dashboard account: @${username}!` 
        });
      }
      setDeptForm({ name: '', account_username: '', account_password: '' });
      loadAllData(true);
    } catch (err) {
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to save department.') });
    }
  };

  const handleEditDeptClick = (d) => {
    setEditDeptId(d.id);
    setDeptForm({
      name: d.name,
      account_username: d.account_username || '',
      account_password: ''
    });
  };

  const handleDeleteDepartment = async (id, name) => {
    if (!window.confirm(`Delete department '${name}'?`)) return;
    try {
      await adminApi.deleteDepartment(id);
      setMessage({ type: 'success', text: `Department '${name}' deleted.` });
      loadAllData(true);
    } catch (err) {
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to delete department.') });
    }
  };

  // --- Staff Handlers ---
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    const validDeptIds = departments.map(d => Number(d.id));
    let primaryDeptId = Number(staffForm.department_id);
    if (!validDeptIds.includes(primaryDeptId)) {
      primaryDeptId = departments[0]?.id ? Number(departments[0].id) : null;
    }
    if (!primaryDeptId) {
      setMessage({ type: 'error', text: 'No valid department available. Please create at least one department first.' });
      return;
    }

    if (!staffForm.name?.trim() || !staffForm.initials?.trim() || !staffForm.username?.trim()) {
      setMessage({ type: 'error', text: 'Please fill out all required staff fields (Name, Initials, Username).' });
      return;
    }

    const cleanInitials = staffForm.initials.trim().toUpperCase();
    if (cleanInitials.length < 2 || cleanInitials.length > 5 || !/^[A-Z0-9.]+$/.test(cleanInitials)) {
      setMessage({ type: 'error', text: 'Staff initials must be 2 to 5 characters (letters or digits, e.g. JS, SD, AJ).' });
      return;
    }

    const cleanAdditionalIds = [...new Set(
      (staffForm.additional_department_ids || [])
        .map(Number)
        .filter(id => !isNaN(id) && id > 0 && id !== primaryDeptId && validDeptIds.includes(id))
    )];

    const primaryDeptName = departments.find(d => Number(d.id) === primaryDeptId)?.name || `Dept #${primaryDeptId}`;
    const crossDeptNames = cleanAdditionalIds.map(id => departments.find(d => Number(d.id) === id)?.name || `Dept #${id}`);

    try {
      if (editStaffId) {
        await adminApi.updateStaff(
          editStaffId,
          staffForm.name.trim(),
          cleanInitials,
          staffForm.username.trim(),
          staffForm.password ? staffForm.password.trim() : undefined,
          staffForm.pin ? staffForm.pin.trim() : undefined,
          primaryDeptId,
          cleanAdditionalIds
        );
        setMessage({ 
          type: 'success', 
          text: `Staff '${staffForm.name.trim()}' (${cleanInitials}) updated! Primary: ${primaryDeptName}${crossDeptNames.length > 0 ? ` | Cross-Teaching: ${crossDeptNames.join(', ')}` : ''}` 
        });
        setEditStaffId(null);
      } else {
        if (!staffForm.password || !staffForm.pin) {
          setMessage({ type: 'error', text: 'Password and 4-digit PIN are required for new staff accounts.' });
          return;
        }
        await adminApi.createStaff(
          staffForm.name.trim(),
          cleanInitials,
          staffForm.username.trim(),
          staffForm.password.trim(),
          staffForm.pin.trim(),
          primaryDeptId,
          cleanAdditionalIds
        );
        setMessage({ 
          type: 'success', 
          text: `Staff '${staffForm.name.trim()}' (${cleanInitials}) registered! Primary: ${primaryDeptName}${crossDeptNames.length > 0 ? ` | Cross-Teaching: ${crossDeptNames.join(', ')}` : ''}` 
        });
      }
      setStaffForm({ 
        name: '', 
        initials: '', 
        username: '', 
        password: '', 
        pin: '', 
        department_id: departments[0]?.id ? Number(departments[0].id) : '',
        additional_department_ids: []
      });
      loadAllData(true);
    } catch (err) {
      console.error('Failed to save staff member:', err);
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to save staff member.') });
    }
  };

  const handleEditStaffClick = (st) => {
    setEditStaffId(st.id);
    const validDeptIds = departments.map(d => Number(d.id));
    let targetPrimaryId = Number(st.department_id);
    if (!validDeptIds.includes(targetPrimaryId)) {
      const matchByName = departments.find(d => d.name === st.department_name);
      targetPrimaryId = matchByName ? Number(matchByName.id) : (departments[0]?.id ? Number(departments[0].id) : targetPrimaryId);
    }
    const existingAddIds = [
      ...(st.additional_department_ids || []),
      ...(st.all_department_ids || [])
    ].map(Number).filter(id => !isNaN(id) && id > 0 && id !== targetPrimaryId && validDeptIds.includes(id));
    const uniqueAddIds = [...new Set(existingAddIds)];
    setStaffForm({
      name: st.name || '',
      initials: st.initials || '',
      username: st.username,
      password: '',
      pin: '',
      department_id: targetPrimaryId,
      additional_department_ids: uniqueAddIds
    });
    // Smoothly scroll to the staff form so the admin immediately sees the edit form
    if (staffFormRef.current) {
      staffFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleAdditionalDept = (deptId) => {
    const numId = Number(deptId);
    setStaffForm(prev => {
      const current = (prev.additional_department_ids || []).map(Number);
      const exists = current.includes(numId);
      let next;
      if (exists) {
        next = current.filter(id => id !== numId);
      } else {
        if (current.length >= 8) {
          setMessage({ type: 'error', text: 'Maximum 8 cross-teaching departments allowed (total 9 department slots in database).' });
          return prev;
        }
        next = [...new Set([...current, numId])];
      }
      return { ...prev, additional_department_ids: next };
    });
  };

  const handleDeleteStaff = async (id, username) => {
    if (!window.confirm(`Delete staff member '${username}'?`)) return;
    try {
      await adminApi.deleteStaff(id);
      setMessage({ type: 'success', text: `Staff user '${username}' deleted.` });
      loadAllData(true);
    } catch (err) {
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to delete staff member.') });
    }
  };

  // --- Student Handlers ---
  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.roll_no || !studentForm.name || !studentForm.department_id) {
      setMessage({ type: 'error', text: 'Please fill out all student fields.' });
      return;
    }
    try {
      if (editStudentRoll) {
        await adminApi.updateStudent(
          editStudentRoll,
          studentForm.name,
          parseInt(studentForm.year),
          parseInt(studentForm.department_id)
        );
        setMessage({ type: 'success', text: `Student '${editStudentRoll}' updated.` });
        setEditStudentRoll(null);
      } else {
        await adminApi.createStudent(
          studentForm.roll_no,
          studentForm.name,
          parseInt(studentForm.year),
          parseInt(studentForm.department_id)
        );
        setMessage({ type: 'success', text: `Student '${studentForm.roll_no}' added.` });
      }
      setStudentForm({ roll_no: '', name: '', year: 2, department_id: departments[0]?.id || '' });
      loadAllData(true);
    } catch (err) {
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to save student.') });
    }
  };

  const handleEditStudentClick = (st) => {
    setEditStudentRoll(st.roll_no);
    setStudentForm({
      roll_no: st.roll_no,
      name: st.name,
      year: st.year,
      department_id: st.department_id
    });
  };

  const handleDeleteStudent = async (roll_no) => {
    if (!window.confirm(`Delete student '${roll_no}'?`)) return;
    try {
      await adminApi.deleteStudent(roll_no);
      setMessage({ type: 'success', text: `Student '${roll_no}' deleted.` });
      loadAllData(true);
    } catch (err) {
      setMessage({ type: 'error', text: formatApiError(err, 'Failed to delete student.') });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
        <p className="text-slate-400 font-medium text-sm">Loading Admin Management Records...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Admin System Setup & Roster Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Manage Departments, Staff Accounts, and Student Rosters
            </p>
          </div>
        </div>

        <button
          onClick={() => loadAllData(false)}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-2 text-xs font-extrabold cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Records
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{typeof message.text === 'string' ? message.text : JSON.stringify(message.text)}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'departments'
              ? 'bg-blue-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departments {deptSearch.trim() ? `(${filteredDepartments.length}/${departments.length})` : `(${departments.length})`}
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'staff'
              ? 'bg-blue-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Staff Setup {(staffSearch.trim() || staffDeptFilter !== 'all') ? `(${filteredStaff.length}/${staffList.length})` : `(${staffList.length})`}
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'students'
              ? 'bg-blue-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Student CRUD {(studentSearch.trim() || studentDeptFilter !== 'all' || studentYearFilter !== 'all') ? `(${filteredStudents.length}/${students.length})` : `(${students.length})`}
        </button>
      </div>

      {/* --- TAB 1: DEPARTMENTS --- */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-800" />
                {editDeptId ? 'Edit Department' : 'Create Department'}
              </span>
              {editDeptId && (
                <button
                  onClick={() => {
                    setEditDeptId(null);
                    setDeptForm({ name: '', account_username: '', account_password: '' });
                  }}
                  className="text-xs text-blue-700 underline cursor-pointer font-bold"
                >
                  Cancel
                </button>
              )}
            </h2>

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={deptForm.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setDeptForm(prev => {
                      if (editDeptId) return { ...prev, name: newName };
                      const slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                      return {
                        ...prev,
                        name: newName,
                        account_username: slug ? `${slug}_dept` : ''
                      };
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  required
                />
              </div>

              <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Automated Dashboard Creation:</span>
                  <p className="text-[11px] text-blue-800/90 mt-0.5">
                    A dedicated Level 2 Department Dashboard account is automatically created for this department with the credentials below.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Dashboard Login Username {editDeptId ? '(Optional)' : ''}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Username used by the department head/staff to sign in to their dedicated dashboard.
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. cs_dept"
                    value={deptForm.account_username}
                    onChange={(e) => setDeptForm({ ...deptForm, account_username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    {editDeptId ? 'Dashboard Password (Optional)' : 'Dashboard Password (Optional)'}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    {editDeptId
                      ? 'Leave blank to keep current dashboard password.'
                      : 'Set a password, or leave blank for instant passwordless dashboard access.'}
                  </p>
                  <input
                    type="password"
                    placeholder={editDeptId ? 'Leave blank to keep current password' : 'Enter password or leave blank'}
                    value={deptForm.account_password}
                    onChange={(e) => setDeptForm({ ...deptForm, account_password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {editDeptId ? 'Update Department' : 'Add Department & Create Dashboard'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-800" />
                  Active Departments List
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Showing {filteredDepartments.length} of {departments.length} departments
                </p>
              </div>

              {/* Department Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by name, ID, or user..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                />
                {deptSearch && (
                  <button
                    onClick={() => setDeptSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredDepartments.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No departments match your filter</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try a different name, department ID, or user handle</p>
                {deptSearch && (
                  <button
                    onClick={() => setDeptSearch('')}
                    className="mt-3 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredDepartments.map((d) => (
                  <div key={d.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-blue-800 font-bold">Department ID: #{d.id}</span>
                        {d.account_username ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                            <LayoutDashboard className="w-3 h-3 text-emerald-600 shrink-0" />
                            Dashboard Active: @{d.account_username}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                            No dashboard account
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">{d.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditDeptClick(d)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(d.id, d.name)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: STAFF USER SETUP & CRUD --- */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div ref={staffFormRef} className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-800" />
                {editStaffId ? 'Edit Staff Account' : 'Create Staff Account'}
              </span>
              {editStaffId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditStaffId(null);
                    setStaffForm({ 
                      name: '', 
                      initials: '', 
                      username: '', 
                      password: '', 
                      pin: '', 
                      department_id: departments[0]?.id ? Number(departments[0].id) : '',
                      additional_department_ids: []
                    });
                  }}
                  className="text-xs text-blue-700 hover:text-blue-900 underline cursor-pointer font-bold"
                >
                  Cancel
                </button>
              )}
            </h2>

            {editStaffId && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between text-xs text-blue-900 font-medium animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Edit className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Editing: <strong>{staffForm.name || staffForm.username}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditStaffId(null);
                    setStaffForm({ 
                      name: '', 
                      initials: '', 
                      username: '', 
                      password: '', 
                      pin: '', 
                      department_id: departments[0]?.id ? Number(departments[0].id) : '',
                      additional_department_ids: []
                    });
                  }}
                  className="text-[11px] font-bold text-blue-800 hover:text-blue-950 underline cursor-pointer"
                >
                  Reset Form
                </button>
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-4">
              {/* Primary Department Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Primary Department <span className="text-rose-600">*</span>
                </label>
                <select
                  value={departments.some(d => Number(d.id) === Number(staffForm.department_id)) ? Number(staffForm.department_id) : (departments[0]?.id ? Number(departments[0].id) : '')}
                  onChange={(e) => {
                    const newPrimary = Number(e.target.value);
                    setStaffForm(prev => ({ 
                      ...prev, 
                      department_id: newPrimary,
                      additional_department_ids: (prev.additional_department_ids || []).map(Number).filter(id => id !== newPrimary)
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  required
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} (ID: #{d.id})</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Primary department assigned to this faculty member.
                </p>
              </div>

              {/* Additional Cross-Teaching Departments */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Cross-Teaching Departments (Slots 2–9)
                  </label>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {(staffForm.additional_department_ids || []).length} / 8 Selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Click below to add/remove departments this faculty teaches. These are stored in database columns (department_2_id to department_9_id) and will appear as quick-select options on the Attendance Terminal.
                </p>

                {departments.filter(d => Number(d.id) !== (departments.some(dep => Number(dep.id) === Number(staffForm.department_id)) ? Number(staffForm.department_id) : Number(departments[0]?.id))).length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                    No other departments available. Create more departments to enable cross-teaching.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {departments
                      .filter(d => Number(d.id) !== (departments.some(dep => Number(dep.id) === Number(staffForm.department_id)) ? Number(staffForm.department_id) : Number(departments[0]?.id)))
                      .map((d) => {
                        const numId = Number(d.id);
                        const selectedIdx = (staffForm.additional_department_ids || []).map(Number).indexOf(numId);
                        const isChecked = selectedIdx !== -1;
                        return (
                          <button
                            type="button"
                            key={d.id}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleAdditionalDept(numId);
                            }}
                            className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer text-left ${
                              isChecked
                                ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-400/30'
                                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-purple-700 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-900 block truncate">{d.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">ID: #{d.id}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isChecked && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900">
                                  Slot {selectedIdx + 2}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isChecked ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {isChecked ? '✓ Added' : '+ Add'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Staff Actual Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. John Smith"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Initials</label>
                    <span className="text-[10px] text-blue-700 font-bold">2-5 Letters</span>
                  </div>
                  <input
                    type="text"
                    minLength={2}
                    maxLength={5}
                    placeholder="e.g. JS"
                    value={staffForm.initials}
                    onChange={(e) => setStaffForm({ ...staffForm, initials: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-blue-900 font-mono font-black text-sm uppercase focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Terminal login</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. prof_smith"
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium text-sm focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Web login</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {editStaffId ? 'Password (Opt)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                    required={!editStaffId}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {editStaffId ? 'PIN (Opt)' : 'Terminal PIN'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="1234"
                    value={staffForm.pin}
                    onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-blue-900 font-mono tracking-widest text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                    required={!editStaffId}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                {editStaffId ? 'Update Staff Member' : 'Register Staff Member'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 pb-3 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-800" />
                    Registered Staff Members
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Showing {filteredStaff.length} of {staffList.length} staff accounts
                  </p>
                </div>
                {(staffSearch || staffDeptFilter !== 'all') && (
                  <button
                    onClick={() => { setStaffSearch(''); setStaffDeptFilter('all'); }}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Staff Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-7 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by name, initials, username..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                  {staffSearch && (
                    <button
                      onClick={() => setStaffSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="sm:col-span-5 relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={staffDeptFilter}
                    onChange={(e) => setStaffDeptFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Departments ({staffList.length})</option>
                    {departments.map((d) => {
                      const count = staffList.filter(s => Number(s.department_id) === Number(d.id)).length;
                      return (
                        <option key={d.id} value={d.id}>
                          {d.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <UserPlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No staff members found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try clearing search query or changing department filter</p>
                <button
                  onClick={() => { setStaffSearch(''); setStaffDeptFilter('all'); }}
                  className="mt-3 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="table-scrollbar">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-3">Initials</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4">Staff Name</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-3">Username</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4">Department</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-3 text-center">PIN Status</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                    {filteredStaff.map((st) => {
                      const primaryDeptId = departments.some(d => Number(d.id) === Number(st.department_id))
                        ? Number(st.department_id)
                        : (departments.find(d => d.name === st.department_name)?.id || Number(st.department_id));
                      const dept = departments.find(d => Number(d.id) === primaryDeptId);
                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          {/* 1. Initials */}
                          <td className="py-3 px-3 font-mono font-black text-blue-900">
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-lg text-xs font-black">
                              {st.initials}
                            </span>
                          </td>

                          {/* 2. Staff Name */}
                          <td className="py-3 px-4 text-slate-900 font-bold">
                            <div>{st.name}</div>
                          </td>

                          {/* 3. Username */}
                          <td className="py-3 px-3 text-slate-600 font-mono text-xs font-semibold">
                            @{st.username}
                          </td>

                          {/* 4. Department & Cross-Teaching */}
                          <td className="py-3 px-4 text-slate-900">
                            <div className="font-bold text-slate-800">{st.department_name || dept?.name || `Dept #${primaryDeptId}`}</div>
                            {st.additional_departments && st.additional_departments.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {st.additional_departments
                                  .filter(addDept => (typeof addDept === 'string' ? addDept !== st.department_name && addDept !== dept?.name : addDept?.id !== primaryDeptId))
                                  .map((addDept, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                                    >
                                      + {typeof addDept === 'string' ? addDept : (addDept?.name || `Dept #${addDept?.id || idx}`)}
                                    </span>
                                  ))}
                              </div>
                            ) : st.additional_department_ids && st.additional_department_ids.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {st.additional_department_ids
                                  .filter(addId => Number(addId) !== primaryDeptId)
                                  .map((addId) => {
                                    const addDept = departments.find(d => Number(d.id) === Number(addId));
                                    return (
                                      <span
                                        key={addId}
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                                      >
                                        + {addDept?.name || `Dept #${addId}`}
                                      </span>
                                    );
                                  })}
                              </div>
                            ) : null}
                          </td>

                          {/* 5. PIN Status */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Configured
                            </span>
                          </td>

                          {/* 6. Actions */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditStaffClick(st)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                title="Edit Staff Member"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(st.id, st.username)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete Staff Member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: STUDENT CRUD --- */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-800" />
                {editStudentRoll ? 'Edit Student' : 'Add Student'}
              </span>
              {editStudentRoll && (
                <button
                  onClick={() => {
                    setEditStudentRoll(null);
                    setStudentForm({ roll_no: '', name: '', year: 2, department_id: departments[0]?.id || '' });
                  }}
                  className="text-xs text-blue-700 underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </h2>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Roll Number</label>
                <input
                  type="text"
                  placeholder="e.g. 22CS001"
                  disabled={!!editStudentRoll}
                  value={studentForm.roll_no}
                  onChange={(e) => setStudentForm({ ...studentForm, roll_no: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-blue-900 font-mono font-bold text-sm focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Student Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Vance"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Year</label>
                  <select
                    value={studentForm.year}
                    onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Department</label>
                  <select
                    value={studentForm.department_id}
                    onChange={(e) => setStudentForm({ ...studentForm, department_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {editStudentRoll ? 'Update Student' : 'Add Student'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 pb-3 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-800" />
                    Full Student Roster
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Showing {filteredStudents.length} of {students.length} students
                  </p>
                </div>
                {(studentSearch || studentDeptFilter !== 'all' || studentYearFilter !== 'all') && (
                  <button
                    onClick={() => { setStudentSearch(''); setStudentDeptFilter('all'); setStudentYearFilter('all'); }}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Student Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by roll no or student name..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="sm:col-span-3 relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={studentDeptFilter}
                    onChange={(e) => setStudentDeptFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 relative">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={studentYearFilter}
                    onChange={(e) => setStudentYearFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">No students found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try changing the department, year, or roll number search</p>
                <button
                  onClick={() => { setStudentSearch(''); setStudentDeptFilter('all'); setStudentYearFilter('all'); }}
                  className="mt-3 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="table-scrollbar">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4">Roll No</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4">Student Name</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-3">Year</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4">Department</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                    {filteredStudents.map((st) => {
                      const dept = departments.find(d => d.id === st.department_id);
                      return (
                        <tr key={st.roll_no} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-blue-900">{st.roll_no}</td>
                          <td className="py-3 px-4 text-slate-900 font-bold">{st.name}</td>
                          <td className="py-3 px-3 text-slate-600">Yr {st.year}</td>
                          <td className="py-3 px-4 text-slate-600">{dept?.name || `Dept #${st.department_id}`}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditStudentClick(st)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                title="Edit Student"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(st.roll_no)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete Student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
