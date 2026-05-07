'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import StatCard from '@/components/StatCard';
import api from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Users, Car, DollarSign, TrendingUp,
  Shield, LogOut, Activity, AlertCircle,
  CheckCircle, Clock, XCircle,
} from 'lucide-react';

const STATUS_COLOR = {
  searching:       'bg-yellow-500/20 text-yellow-400',
  accepted:        'bg-blue-500/20   text-blue-400',
  driver_arriving: 'bg-orange-500/20 text-orange-400',
  in_progress:     'bg-green-500/20  text-green-400',
  completed:       'bg-gray-500/20   text-gray-400',
  cancelled:       'bg-red-500/20    text-red-400',
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [stats,    setStats]    = useState(null);
  const [rides,    setRides]    = useState([]);
  const [revenue,  setRevenue]  = useState(null);
  const [chart,    setChart]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user?.role !== 'admin') { router.replace('/login'); return; }
  }, [isAuthenticated, user, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ridesRes, revenueRes] = await Promise.allSettled([
        api.get('/api/rides?limit=20'),
        api.get('/api/payments/revenue'),
      ]);

      if (ridesRes.status === 'fulfilled') {
        const ridesData = ridesRes.value.data.data;
        setRides(ridesData.rides || []);


        const total     = ridesData.total || 0;
        const completed = (ridesData.rides || []).filter(r => r.status === 'completed').length;
        const cancelled = (ridesData.rides || []).filter(r => r.status === 'cancelled').length;
        const active    = (ridesData.rides || []).filter(r =>
          ['searching', 'accepted', 'driver_arriving', 'in_progress'].includes(r.status)
        ).length;

        setStats({ total, completed, cancelled, active });
      }

      if (revenueRes.status === 'fulfilled') {
        setRevenue(revenueRes.value.data.data);
      }


      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      setChart(days.map(day => ({
        day,
        revenue: Math.floor(Math.random() * 800) + 200,
        rides:   Math.floor(Math.random() * 40)  + 10,
      })));

    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950">

      {}
      <aside className="fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col z-20">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Bougons</p>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'overview', label: 'Overview',  icon: Activity },
            { id: 'rides',    label: 'Rides',     icon: Car      },
            { id: 'users',    label: 'Users',     icon: Users    },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {}
      <main className="ml-56 p-8">

        {}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">{tab}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {}
            {tab === 'overview' && (
              <div className="space-y-6">

                {}
                <div className="grid grid-cols-4 gap-4">
                  <StatCard
                    title="Total Rides"
                    value={stats?.total || 0}
                    icon={Car}
                    color="violet"
                    sub="All time"
                  />
                  <StatCard
                    title="Active Now"
                    value={stats?.active || 0}
                    icon={Activity}
                    color="green"
                    sub="Live rides"
                  />
                  <StatCard
                    title="Revenue"
                    value={`€${revenue?.total?.toFixed(2) || '0.00'}`}
                    icon={DollarSign}
                    color="blue"
                    sub={`${revenue?.count || 0} payments`}
                  />
                  <StatCard
                    title="Avg Fare"
                    value={`€${revenue?.avgFare?.toFixed(2) || '0.00'}`}
                    icon={TrendingUp}
                    color="orange"
                    sub="Per ride"
                  />
                </div>

                {}
                <div className="card">
                  <h2 className="font-semibold text-white mb-6">Weekly Revenue</h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chart}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="day" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12 }}
                        labelStyle={{ color: '#fff' }}
                        itemStyle={{ color: '#a78bfa' }}
                        formatter={(v) => [`€${v}`, 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        fill="url(#revenueGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {}
                <div className="grid grid-cols-3 gap-4">
                  <div className="card text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{stats?.completed || 0}</p>
                    <p className="text-sm text-gray-500">Completed</p>
                  </div>
                  <div className="card text-center">
                    <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{stats?.active || 0}</p>
                    <p className="text-sm text-gray-500">In Progress</p>
                  </div>
                  <div className="card text-center">
                    <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{stats?.cancelled || 0}</p>
                    <p className="text-sm text-gray-500">Cancelled</p>
                  </div>
                </div>

              </div>
            )}

            {}
            {tab === 'rides' && (
              <div className="card overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h2 className="font-semibold text-white">Recent Rides</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {['Ride ID', 'Status', 'Pickup', 'Destination', 'Fare', 'Date'].map(h => (
                          <th key={h} className="text-left px-6 py-3 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {rides.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-600">
                            No rides found
                          </td>
                        </tr>
                      ) : rides.map((ride) => (
                        <tr key={ride._id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">
                            {ride._id.slice(-8)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[ride.status] || 'bg-gray-700 text-gray-400'}`}>
                              {ride.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300 max-w-[160px] truncate">
                            {ride.pickup?.address || '—'}
                          </td>
                          <td className="px-6 py-4 text-gray-300 max-w-[160px] truncate">
                            {ride.destination?.address || '—'}
                          </td>
                          <td className="px-6 py-4 text-green-400 font-medium">
                            €{ride.fare?.estimated?.toFixed(2) || '—'}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {new Date(ride.createdAt).toLocaleDateString('en-GB')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {}
            {tab === 'users' && (
              <div className="card flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="w-10 h-10 text-gray-600" />
                <p className="text-gray-500 text-sm">User management coming soon</p>
                <p className="text-gray-700 text-xs">Add a /api/admin/users endpoint to the user-service</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
