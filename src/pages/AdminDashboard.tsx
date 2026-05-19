import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, AlertCircle, BarChart3, ShieldCheck, ShieldAlert, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function AdminDashboard() {
  const { token, user, isLoading, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState<any>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'disputes'>('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (token && user?.isAdmin) {
      fetchAdminData();
      fetchReports();
      fetchDisputes();
    }
  }, [token, user]);

  const fetchDisputes = async () => {
    try {
      const { ok, data } = await apiFetch('/api/admin/disputes');
      if (ok) setDisputes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReports = async () => {
    try {
      const { ok, data } = await apiFetch('/api/reports/admin');
      if (ok && Array.isArray(data)) {
        setReports(data);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveReport = async (reportId: string, action: string) => {
    try {
      const { ok } = await apiFetch(`/api/reports/${reportId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });
      if (ok) {
        fetchReports();
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [resStats, resUsers] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users')
      ]);
      
      setStatsData(resStats.data);
      if (Array.isArray(resUsers.data)) {
        setUserList(resUsers.data);
      } else {
        setUserList([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: statsData?.totalUsers || '0', icon: Users, color: 'bg-sky-500/10 text-sky-400', border: 'border-sky-500/10' },
    { label: 'Active Items', value: statsData?.activeItems || '0', icon: Package, color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/10' },
    { label: 'Pending Requests', value: statsData?.pendingRequests || '0', icon: AlertCircle, color: 'bg-orange-500/10 text-orange-400', border: 'border-orange-500/10' },
    { label: 'Security Alerts', value: statsData?.pendingReports || '0', icon: ShieldAlert, color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/10' },
    { label: 'Escrow Disputes', value: disputes.filter(d => d.status !== 'resolved').length.toString(), icon: AlertCircle, color: 'bg-purple-500/10 text-purple-400', border: 'border-purple-500/10' },
  ];

  return (
    <div className="space-y-10">
      <div className="glass-card flex flex-col md:flex-row justify-between items-center p-8 md:p-10 border-sky-500/10 overflow-hidden relative gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-1 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tighter uppercase tracking-wide">Command Center</h1>
          <p className="text-[10px] text-sky-100/40 uppercase tracking-[0.4em] font-bold">Node status: active & healthy</p>
        </div>
        <div className="flex items-center gap-3 bg-sky-500 text-white px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-sky-500/20 w-full md:w-auto justify-center">
          <ShieldCheck size={18} />
          Certified Protocol
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`glass-card p-10 flex flex-col border-sky-500/10 group hover:-translate-y-1 hover:shadow-2xl`}
          >
            <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-sky-500/20`}>
              <stat.icon size={28} />
            </div>
            <p className="text-sky-100/30 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">{stat.label}</p>
            <h3 className="text-5xl font-bold text-white tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-card p-10 space-y-8 border-sky-500/10">
          <div className="flex items-center justify-between border-b border-sky-500/10 pb-6">
            <div className="flex gap-8">
              <button 
                onClick={() => setActiveTab('users')}
                className={`text-[10px] font-bold uppercase tracking-[0.3em] pb-4 transition-all ${
                  activeTab === 'users' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-sky-100/20'
                }`}
              >
                Neighbor Nodes
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`text-[10px] font-bold uppercase tracking-[0.3em] pb-4 transition-all relative ${
                  activeTab === 'reports' ? 'text-rose-400 border-b-2 border-rose-400' : 'text-sky-100/20'
                }`}
              >
                Security Reports
                {reports.filter(r => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-2 -right-4 bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                    {reports.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('disputes')}
                className={`text-[10px] font-bold uppercase tracking-[0.3em] pb-4 transition-all relative ${
                  activeTab === 'disputes' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-sky-100/20'
                }`}
              >
                Escrow Disputes
                {disputes.filter(d => d.status !== 'resolved').length > 0 && (
                  <span className="absolute -top-2 -right-4 bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                    {disputes.filter(d => d.status !== 'resolved').length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex gap-4">
              <button 
                className="text-[10px] text-sky-400 font-bold uppercase tracking-[0.3em] bg-sky-500/5 px-6 py-2 rounded-xl hover:bg-sky-500/10 transition-all border border-sky-500/10" 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/export', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Export failed');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sharelocal_backup_${new Date().toISOString().split('T')[0]}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (err) {
                    alert('Export protocol failure: Check neural link status.');
                  }
                }}
              >
                Export Backup (ZIP)
              </button>
              <button className="text-[10px] text-sky-400 font-bold uppercase tracking-[0.3em] bg-sky-500/5 px-6 py-2 rounded-xl" onClick={() => { fetchAdminData(); fetchReports(); fetchDisputes(); }}>Hot Reload</button>
            </div>
          </div>

          <div className="space-y-4">
            {activeTab === 'users' ? (
              Array.isArray(userList) && userList.slice(0, 8).map((u, i) => (
                <div key={u._id} className="flex items-center justify-between p-6 bg-sky-500/5 backdrop-blur-md rounded-[2rem] border border-sky-500/10 group hover:border-sky-500/30 transition-all shadow-inner">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-3xl bg-slate-950 flex items-center justify-center text-sm font-bold text-sky-100/20 uppercase overflow-hidden border border-sky-500/10 shadow-xl">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name[0]}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white uppercase tracking-tight">{u.name}</p>
                      <p className="text-[10px] text-sky-100/30 font-bold uppercase tracking-[0.2em]">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button className="glass-button px-6 bg-sky-500/10 text-sky-400 border-sky-500/20">Audit</button>
                    {u.isAdmin && <span className="bg-sky-500 text-white px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center shadow-lg shadow-sky-500/20">Protocol Lead</span>}
                  </div>
                </div>
              ))
            ) : activeTab === 'reports' ? (
              <div className="space-y-6">
                {Array.isArray(reports) && reports.length > 0 ? (
                  reports.map((report) => (
                    <div key={report._id} className="glass-card p-8 border-rose-500/10 bg-rose-500/[0.02] flex flex-col gap-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            report.status === 'pending' ? 'bg-rose-500/20 text-rose-500' : 'bg-sky-500/20 text-sky-400'
                          } border border-white/5 shadow-inner`}>
                            <ShieldAlert size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white uppercase">{report.reason}</p>
                            <p className="text-[10px] text-sky-100/30 font-bold uppercase tracking-widest italic">Reporter: {report.reporter?.name}</p>
                          </div>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                          report.status === 'pending' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {report.status}
                        </span>
                      </div>
                      
                      <div className="p-6 bg-slate-950/40 rounded-2xl border border-white/5 italic text-sm text-sky-100/60 leading-relaxed shadow-inner">
                        "{report.description || 'No description provided.'}"
                      </div>

                      {report.targetData && (
                        <div className="p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10 flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-900 rounded-xl overflow-hidden border border-white/5">
                            {report.targetType === 'item' && report.targetData.images?.[0] ? (
                              <img src={report.targetData.images[0]} className="w-full h-full object-cover" />
                            ) : <div className="w-full h-full flex items-center justify-center text-sky-400"><Package size={16} /></div>}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white uppercase">{report.targetData.title || report.targetData.name}</p>
                            <p className="text-[9px] text-sky-100/30 font-bold uppercase tracking-widest">Target Node Type: {report.targetType}</p>
                          </div>
                        </div>
                      )}

                      {report.status === 'pending' && (
                        <div className="flex gap-4">
                          {report.targetType === 'item' && (
                            <button 
                              onClick={() => handleResolveReport(report._id, 'delete')}
                              className="flex-1 glass-button bg-rose-500 text-white border-transparent text-[10px] font-bold py-3 uppercase tracking-widest"
                            >
                              Destroy Resource
                            </button>
                          )}
                          <button 
                            onClick={() => handleResolveReport(report._id, 'dismiss')}
                            className="flex-1 glass-button bg-white/5 text-sky-100/40 border-white/10 text-[10px] font-bold py-3 uppercase tracking-widest"
                          >
                            Dismiss Report
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-20 glass-card bg-sky-500/5 border-dashed border-sky-500/10 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-100/20 italic">No active security threats logged</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {disputes.map(dispute => (
                  <div key={dispute._id} className="glass-card p-8 border-purple-500/10 bg-purple-500/[0.02] space-y-6">
                    <div className="flex justify-between items-start">
                       <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white uppercase">{dispute.reason}</h4>
                          <p className="text-[9px] text-sky-100/30 uppercase font-bold tracking-widest">Request: {dispute.request?.item?.title}</p>
                       </div>
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                         dispute.status === 'open' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                       }`}>
                         {dispute.status}
                       </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-sky-100/20 uppercase mb-2">Owner</p>
                          <p className="text-xs font-bold text-white">{dispute.request?.owner?.name}</p>
                       </div>
                       <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-sky-100/20 uppercase mb-2">Borrower</p>
                          <p className="text-xs font-bold text-white">{dispute.request?.requester?.name}</p>
                       </div>
                    </div>

                    <div className="p-6 bg-slate-950/40 rounded-2xl border border-white/5 italic text-sm text-sky-100/60 leading-relaxed shadow-inner">
                      "{dispute.description}"
                    </div>

                    {dispute.status === 'open' && (
                       <div className="flex gap-4">
                          <button 
                            onClick={async () => {
                              const amount = prompt("Compensation amount for Owner ($)?", "0");
                              if (amount === null) return;
                              await apiFetch(`/api/admin/disputes/${dispute._id}/resolve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  winner: 'owner', 
                                  ownerAmount: parseFloat(amount), 
                                  borrowerAmount: 0,
                                  adminNotes: 'Resolved by admin compensation'
                                })
                              });
                              fetchDisputes();
                            }}
                            className="flex-1 glass-button bg-emerald-500 text-white text-[9px] font-bold py-3 uppercase tracking-widest"
                          >
                            Compensate Owner
                          </button>
                          <button 
                             onClick={async () => {
                              await apiFetch(`/api/admin/disputes/${dispute._id}/resolve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  winner: 'borrower', 
                                  ownerAmount: 0, 
                                  borrowerAmount: dispute.request?.depositAmount || 0,
                                  adminNotes: 'Full refund to borrower'
                                })
                              });
                              fetchDisputes();
                            }}
                            className="flex-1 glass-button bg-sky-500 text-white text-[9px] font-bold py-3 uppercase tracking-widest"
                          >
                            Refund Borrower
                          </button>
                       </div>
                    )}
                  </div>
                ))}
                {disputes.length === 0 && (
                  <div className="p-20 glass-card bg-sky-500/5 border-dashed border-sky-500/10 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-sky-100/20 italic">No disputes requiring mediation</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 glass-card bg-slate-900 border-none text-white overflow-hidden shadow-3xl p-10 space-y-8">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.4em]">Real-time Telemetry</h3>
            <div className="h-px bg-white/10 w-full" />
          </div>
          <div className="font-mono text-[10px] space-y-4 text-slate-400 overflow-y-auto max-h-[400px] leading-relaxed scrollbar-hide">
            <p className="flex gap-3"><span className="text-blue-400 text-xs">[0x7F]</span> AUTH_SIG: VERIFIED for {user?.name}</p>
            <p className="flex gap-3"><span className="text-emerald-400 text-xs">[0x34]</span> DB_SYNC: Successful at 48ms</p>
            <p className="flex gap-3"><span className="text-slate-600 text-xs">[0xAD]</span> CACHE_HIT: 94.2%</p>
            <p className="flex gap-3"><span className="text-blue-400 text-xs">[0x12]</span> WEBSOCKET: Connected via AIS-Internal</p>
            <p className="flex gap-3"><span className="text-slate-600 text-xs">[0x88]</span> LOG_DUMP: Monitoring neighbors match protocol...</p>
            <p className="flex gap-3"><span className="text-pink-400 text-xs">●</span> LIVE_PULSE: OK</p>
          </div>
        </div>
      </div>
    </div>
  );
}
