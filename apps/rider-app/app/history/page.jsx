'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

const statusLabels = {
    idle: 'Idle',
    searching: 'Searching',
    accepted: 'Driver accepted',
    driver_arriving: 'Driver arriving',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export default function RideHistoryPage() {
    const router = useRouter();
    const { isAuthenticated, _hasHydrated } = useAuthStore();
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.replace('/auth/login');
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, _hasHydrated]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchRideHistory = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await api.get('/api/rides', {
                    params: { limit: 20, page: 1 },
                });
                setRides(data.data.rides || []);
            } catch (err) {
                setError(err.response?.data?.message || 'Unable to load ride history');
            } finally {
                setLoading(false);
            }
        };

        fetchRideHistory();
    }, [isAuthenticated]);

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-4">
            <div className="mx-auto max-w-4xl">
                <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
                    <h1 className="text-3xl font-bold text-slate-900">Ride History</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Review your recent rides, status, and pickup/destination details.
                    </p>
                </div>

                <div className="space-y-4">
                    {loading && (
                        <div className="rounded-3xl bg-white p-6 text-center text-slate-600 shadow-sm">
                            Loading your ride history...
                        </div>
                    )}

                    {error && (
                        <div className="rounded-3xl bg-rose-50 p-6 text-rose-700 shadow-sm">
                            {error}
                        </div>
                    )}

                    {!loading && !error && rides.length === 0 && (
                        <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
                            You have no rides yet. Book a ride from the dashboard to get started.
                        </div>
                    )}

                    {rides.map((ride) => (
                        <div key={ride._id} className="rounded-3xl bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-slate-500">Status</p>
                                    <p className="text-lg font-semibold text-slate-900">{statusLabels[ride.status] || ride.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Requested</p>
                                    <p className="text-sm text-slate-700">
                                        {new Date(ride.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-3xl bg-slate-50 p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-[0.2em]">Pickup</p>
                                    <p className="mt-2 text-sm font-medium text-slate-900">
                                        {ride.pickup?.address || `${ride.pickup?.location?.coordinates?.[1]?.toFixed(5)}, ${ride.pickup?.location?.coordinates?.[0]?.toFixed(5)}`}
                                    </p>
                                </div>
                                <div className="rounded-3xl bg-slate-50 p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-[0.2em]">Destination</p>
                                    <p className="mt-2 text-sm font-medium text-slate-900">
                                        {ride.destination?.address || `${ride.destination?.location?.coordinates?.[1]?.toFixed(5)}, ${ride.destination?.location?.coordinates?.[0]?.toFixed(5)}`}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                                <span>Driver: {ride.driver ? ride.driver : 'Not assigned'}</span>
                                <span>Fare: €{ride.fare?.actual ?? ride.fare?.estimated ?? '—'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
