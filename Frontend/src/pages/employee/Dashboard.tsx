import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ClipboardList, DollarSign, LogIn, LogOut, Mail, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInvitations } from "@/hooks/useInvitations";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invitations, acceptInvitation, rejectInvitation, pendingCount } = useInvitations();
  const { toast } = useToast();
  
  const [checkInStatus, setCheckInStatus] = useState<{ checkedIn: boolean; checkedOut: boolean; checkInTime?: string; checkOutTime?: string }>({ checkedIn: false, checkedOut: false });
  const [isLoading, setIsLoading] = useState(false);

  const userName = user?.full_name?.split(' ')[0] || 'User';

  // Load check-in status on mount
  useEffect(() => {
    if (user?.id) {
      const status = apiClient.getTodayStatus(user.id);
      setCheckInStatus(status);
    }
  }, [user?.id]);

  const handleCheckIn = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.checkIn({});
      if (response.success) {
        const status = apiClient.getTodayStatus(user?.id || 0);
        setCheckInStatus(status);
        toast({
          title: "Checked In",
          description: `You checked in at ${new Date().toLocaleTimeString()}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check in",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleCheckOut = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.checkOut({});
      if (response.success) {
        const status = apiClient.getTodayStatus(user?.id || 0);
        setCheckInStatus(status);
        toast({
          title: "Checked Out",
          description: `You checked out at ${new Date().toLocaleTimeString()}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check out",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const recentActivity = [
    { id: 1, type: "attendance", message: checkInStatus.checkedIn ? `Checked in at ${checkInStatus.checkInTime || 'today'}` : "Not checked in yet", date: "Today", status: checkInStatus.checkedIn ? "present" as const : "pending" as const },
    { id: 2, type: "leave", message: "Leave request approved", date: "Jan 2, 2026", status: "approved" as const },
    { id: 3, type: "payroll", message: "December salary credited", date: "Jan 1, 2026", status: "approved" as const },
  ];

  return (
    <AppLayout role="employee" userName={user?.full_name || 'User'}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Welcome back, {userName}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleCheckIn}
              disabled={isLoading || checkInStatus.checkedIn}
            >
              <LogIn className="h-4 w-4" />
              {checkInStatus.checkedIn ? 'Checked In' : 'Check In'}
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleCheckOut}
              disabled={isLoading || !checkInStatus.checkedIn || checkInStatus.checkedOut}
            >
              <LogOut className="h-4 w-4" />
              {checkInStatus.checkedOut ? 'Checked Out' : 'Check Out'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="This Month's Attendance"
            value="22 / 23"
            subtitle="Days present"
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Leave Balance"
            value="12"
            subtitle="Days remaining"
            icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Working Hours"
            value="176h"
            subtitle="This month"
            icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Pending Invitations"
            value={pendingCount.toString()}
            subtitle="Awaiting response"
            icon={<Mail className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="rounded-md border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">Invitations</h2>
            </div>
            <div className="divide-y">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invitation.message}</p>
                      <p className="text-xs text-muted-foreground">From: {invitation.from}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {invitation.status === 'pending' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => acceptInvitation(invitation.id)}
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => rejectInvitation(invitation.id)}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </>
                    ) : (
                      <StatusBadge status={invitation.status === 'accepted' ? 'approved' : 'rejected'} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => navigate("/leave")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Apply for Leave</p>
                <p className="text-sm text-muted-foreground">Submit a new request</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/attendance")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">View Attendance</p>
                <p className="text-sm text-muted-foreground">Check your records</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/payroll")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Payroll Details</p>
                <p className="text-sm text-muted-foreground">View salary slips</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {activity.type === "attendance" && (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
                    {activity.type === "leave" && (
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    )}
                    {activity.type === "payroll" && (
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
