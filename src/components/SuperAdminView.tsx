import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_admin?: boolean;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  interval: string;
  status: string;
  current_period_end: string;
  created_at: string;
  checkout_request_id?: string;
  user_email?: string;
}

interface PaymentCallback {
  id: string;
  checkout_request_id: string;
  result_code: number;
  result_desc: string;
  created_at: string;
  raw_response: any;
}

interface Report {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  feedback: string;
  user_email?: string;
}

interface SystemStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalReports: number;
  totalRevenue: number;
  adminUsers: number;
}

export default function SuperAdminView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscriptions' | 'payments' | 'reports'>('overview');
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalReports: 0,
    totalRevenue: 0,
    adminUsers: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PaymentCallback[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadSystemStats();
      loadUsers();
      loadSubscriptions();
      loadPayments();
      loadReports();
    }
  }, [user]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);

      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get admin users
      const { count: adminUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true);

      // Get active subscriptions
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total reports
      const { count: totalReports } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true });

      // Calculate total revenue (sum of all successful payments)
      const { data: successfulPayments } = await supabase
        .from('subscriptions')
        .select('plan, interval')
        .eq('status', 'active');

      let totalRevenue = 0;
      successfulPayments?.forEach(sub => {
        // Basic pricing logic - you can adjust based on your actual pricing
        const planPrices: { [key: string]: { month: number; year: number } } = {
          'Basic': { month: 20, year: 200 },
          'Pro': { month: 50, year: 500 },
          'Enterprise': { month: 70, year: 700 }
        };
        
        const price = planPrices[sub.plan]?.[sub.interval as 'month' | 'year'] || 0;
        totalRevenue += price;
      });

      setSystemStats({
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalReports: totalReports || 0,
        totalRevenue,
        adminUsers: adminUsers || 0
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
      toast.error('Failed to load system statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, is_admin, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get user details from auth.users (this might need to be done via an edge function in production)
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.warn('Could not fetch user details from auth.users:', usersError);
        // Fallback to profiles data only
        const usersFromProfiles = profilesData?.map(profile => ({
          id: profile.id,
          email: 'Email not available',
          created_at: profile.created_at,
          last_sign_in_at: '',
          is_admin: profile.is_admin
        })) || [];
        setUsers(usersFromProfiles);
        return;
      }

      // Combine profile and auth data
      const combinedUsers = profilesData?.map(profile => {
        const authUser = usersData.users.find(u => u.id === profile.id);
        return {
          id: profile.id,
          email: authUser?.email || 'Unknown',
          created_at: profile.created_at,
          last_sign_in_at: authUser?.last_sign_in_at || '',
          is_admin: profile.is_admin
        };
      }) || [];

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          profiles!inner(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails for subscriptions
      const subscriptionsWithEmails = await Promise.all(
        (data || []).map(async (sub) => {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
            return {
              ...sub,
              user_email: userData.user?.email || 'Unknown'
            };
          } catch {
            return {
              ...sub,
              user_email: 'Unknown'
            };
          }
        })
      );

      setSubscriptions(subscriptionsWithEmails);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      toast.error('Failed to load subscriptions');
    }
  };

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_callbacks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payment history');
    }
  };

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, user_id, title, created_at, feedback')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get user emails for reports
      const reportsWithEmails = await Promise.all(
        (data || []).map(async (report) => {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(report.user_id);
            return {
              ...report,
              user_email: userData.user?.email || 'Unknown'
            };
          } catch {
            return {
              ...report,
              user_email: 'Unknown'
            };
          }
        })
      );

      setReports(reportsWithEmails);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    }
  };

  const toggleUserAdmin = async (userId: string, currentAdminStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentAdminStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`User admin status ${!currentAdminStatus ? 'granted' : 'revoked'} successfully`);
      loadUsers(); // Reload users
    } catch (error) {
      console.error('Error updating user admin status:', error);
      toast.error('Failed to update user admin status');
    }
  };

  const cancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      if (error) throw error;

      toast.success('Subscription cancelled successfully');
      loadSubscriptions(); // Reload subscriptions
      loadSystemStats(); // Update stats
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSubscriptions = subscriptions.filter(sub => 
    sub.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.plan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = payments.filter(payment => 
    payment.checkout_request_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.result_desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReports = reports.filter(report => 
    report.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Super Admin Dashboard
        </h2>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => {
              loadSystemStats();
              loadUsers();
              loadSubscriptions();
              loadPayments();
              loadReports();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'users', label: 'Users', icon: '👥' },
            { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
            { id: 'payments', label: 'Payments', icon: '💰' },
            { id: 'reports', label: 'Reports', icon: '📄' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="text-blue-600 dark:text-blue-400 text-2xl mr-3">👥</div>
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Users</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{systemStats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 dark:text-green-400 text-2xl mr-3">✅</div>
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Active Subscriptions</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{systemStats.activeSubscriptions}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="text-purple-600 dark:text-purple-400 text-2xl mr-3">📄</div>
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Total Reports</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{systemStats.totalReports}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="text-yellow-600 dark:text-yellow-400 text-2xl mr-3">💰</div>
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Total Revenue</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{formatCurrency(systemStats.totalRevenue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 dark:text-red-400 text-2xl mr-3">👑</div>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Admin Users</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{systemStats.adminUsers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Sign In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_admin
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => toggleUserAdmin(user.id, user.is_admin || false)}
                      className={`${
                        user.is_admin
                          ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                          : 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300'
                      }`}
                    >
                      {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Period End
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSubscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {subscription.user_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {subscription.plan} ({subscription.interval}ly)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : subscription.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(subscription.current_period_end)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {subscription.status === 'active' && (
                      <button
                        onClick={() => cancelSubscription(subscription.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Request ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {payment.checkout_request_id.slice(0, 20)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.result_code === 0
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {payment.result_code === 0 ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {payment.result_desc}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(payment.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {report.user_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {report.title || 'Untitled Report'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      report.feedback
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {report.feedback ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(report.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}