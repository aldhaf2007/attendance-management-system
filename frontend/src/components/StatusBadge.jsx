import React from 'react';
import { CheckCircle2, XCircle, Clock, Lock } from 'lucide-react';

export default function StatusBadge({ status, locked = false }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        Locked
      </span>
    );
  }

  switch (status) {
    case 'Present':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Present
        </span>
      );
    case 'Absent':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-xs">
          <XCircle className="w-4 h-4 text-rose-600" />
          Absent
        </span>
      );
    case 'OD':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs">
          <Clock className="w-4 h-4 text-amber-700" />
          OD (On Duty)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Not Marked
        </span>
      );
  }
}
