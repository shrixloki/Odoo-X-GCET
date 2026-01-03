import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ClipboardList, AlertCircle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const pendingLeaveRequests = [
  { id: 1, employee: "Sarah Johnson", type: "Sick Leave", days: 2, date: "Jan 6-7, 2026" },
  { id: 2, employee: "Michael Chen", type: "Paid Leave", days: 5, date: "Jan 13-17, 2026" },
  { id: 3, employee: "Emily Davis", type: "Unpaid Leave", days: 1, date: "Jan 10, 2026" },
];

const todayAttendance = [
  { id: 1, employee: "John Doe", checkIn: "9:02 AM", checkOut: "—", status: "present" as const },
  { id: 2, employee: "Sarah Johnson", checkIn: "8:55 AM", checkOut: "—", status: "present" as const },
  { id: 3, employee: "Michael Chen", checkIn: "—", checkOut: "—", status: "absent" as const },
  { id: 4, employee: "Emily Davis", checkIn: "9:15 AM", checkOut: "—", status: "present" as const },
  { id: 5, employee: "Robert Wilson", checkIn: "—", checkOut: "—", status: "leave" as const },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(!forceRefresh); // Don't show loading spinner on refresh
      if (forceRefresh) setRefreshing(true);
      
      // Use the new cached dashboard data method
      const dashboardResponse = await apiClient.getDashboardData(forceRefresh) as { success: boolean; data?: any; error?: string };
      
      if (dashboardResponse.success && dashboardResponse.data) {
        const { employees: empData, leaveRequests: leaveData, attendance: attData } = dashboardResponse.data;
        
        setEmployees(empData || []);
        setLeaveRequests((leaveData || []).filter((req: any) => req.status === 'PENDING').slice(0, 3));
        setAttendance((attData || []).slice(0, 5));
        setLastUpdated(new Date());
        
        if (forceRefresh) {
          toast({
            title: "Success",
            description: "Dashboard data refreshed successfully",
          });
        }
      } else {
        throw new Error(dashboardResponse.error || 'Failed to fetch dashboard data');
      }

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Using demo data.",
        variant: "destructive",
      });
      
      // Fallback to demo data
      setLeaveRequests(pendingLeaveRequests);
      setAttendance(todayAttendance);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth/signin');
    toast({
      title: "Success",
      description: "Logged out successfully",
    });
  };

  const handleApproveLeave = async (requestId: number) => {
    try {
      const response = await apiClient.approveLeaveRequest(requestId, { approval_notes: "Approved from dashboard" });
      if (response.success) {
        toast({
          title: "Success",
          description: "Leave request approved successfully",
        });
        // Refresh data to show updated status
        fetchDashboardData(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve leave request",
        variant: "destructive",
      });
    }
  };

  const handleRejectLeave = async (requestId: number) => {
    try {
      const response = await apiClient.rejectLeaveRequest(requestId, { approval_notes: "Rejected from dashboard" });
      if (response.success) {
        toast({
          title: "Success",
          description: "Leave request rejected successfully",
        });
        // Refresh data to show updated status
        fetchDashboardData(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject leave request",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout role="admin" userName={user?.full_name || "Admin"} onRefresh={handleRefresh}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">HR Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of employee management and pending actions
              {lastUpdated && (
                <span className="ml-2 text-xs">
                  • Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>

          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Total Employees"
                value={employees.length.toString()}
                subtitle={`${new Set(employees.map((emp: any) => emp.department)).size} departments`}
                icon={<Users className="h-5 w-5 text-muted-foreground" />}
              />
              <SummaryCard
                title="Present Today"
                value={attendance.filter((att: any) => att.status === 'PRESENT').length.toString()}
                subtitle={`${Math.round((attendance.filter((att: any) => att.status === 'PRESENT').length / Math.max(attendance.length, 1)) * 100)}% attendance rate`}
                icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
              />
              <SummaryCard
                title="Pending Leave Requests"
                value={leaveRequests.length.toString()}
                subtitle="Requires action"
                icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
              />
              <SummaryCard
                title="On Leave Today"
                value={attendance.filter((att: any) => att.status === 'ABSENT').length.toString()}
                subtitle={`${Math.round((attendance.filter((att: any) => att.status === 'ABSENT').length / Math.max(attendance.length, 1)) * 100)}% of workforce`}
                icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pending Leave Requests */}
              <div className="rounded-md border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="font-medium">Pending Leave Requests</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/admin/leave")}
                  >
                    View All
                  </Button>
                </div>
                <div className="divide-y">
                  {leaveRequests.length > 0 ? leaveRequests.map((request: any) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{request.employee_name || request.employee}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.leave_type} • {request.days_requested} day{request.days_requested > 1 ? "s" : ""} • {request.start_date} - {request.end_date}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                          onClick={() => handleApproveLeave(request.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRejectLeave(request.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No pending leave requests
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Attendance */}
              <div className="rounded-md border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="font-medium">Today's Attendance</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/admin/attendance")}
                  >
                    View All
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.length > 0 ? attendance.map((record: any) => (
                        <tr key={record.id}>
                          <td className="font-medium">{record.employee_name || record.employee}</td>
                          <td>{record.check_in_time || record.checkIn || "—"}</td>
                          <td>{record.check_out_time || record.checkOut || "—"}</td>
                          <td>
                            <StatusBadge status={record.status.toLowerCase()} />
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                            No attendance records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
