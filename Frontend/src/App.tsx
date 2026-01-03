import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";

// Employee Pages
import EmployeeDashboard from "./pages/employee/Dashboard";
import Profile from "./pages/employee/Profile";
import Attendance from "./pages/employee/Attendance";
import Leave from "./pages/employee/Leave";
import Payroll from "./pages/employee/Payroll";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import AdminAttendance from "./pages/admin/Attendance";
import LeaveManagement from "./pages/admin/LeaveManagement";
import AdminPayroll from "./pages/admin/Payroll";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/signin" element={<SignIn />} />
            <Route path="/auth/signup" element={<SignUp />} />

            {/* Employee Portal */}
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole={['Employee', 'Admin', 'HR_Manager']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute requiredRole={['Employee', 'Admin', 'HR_Manager']}>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute requiredRole={['Employee', 'Admin', 'HR_Manager']}>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/leave" element={
              <ProtectedRoute requiredRole={['Employee', 'Admin', 'HR_Manager']}>
                <Leave />
              </ProtectedRoute>
            } />
            <Route path="/payroll" element={
              <ProtectedRoute requiredRole={['Employee', 'Admin', 'HR_Manager']}>
                <Payroll />
              </ProtectedRoute>
            } />

            {/* Admin Portal */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute requiredRole={['Admin', 'HR_Manager']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/employees" element={
              <ProtectedRoute requiredRole={['Admin', 'HR_Manager']}>
                <Employees />
              </ProtectedRoute>
            } />
            <Route path="/admin/attendance" element={
              <ProtectedRoute requiredRole={['Admin', 'HR_Manager']}>
                <AdminAttendance />
              </ProtectedRoute>
            } />
            <Route path="/admin/leave" element={
              <ProtectedRoute requiredRole={['Admin', 'HR_Manager']}>
                <LeaveManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/payroll" element={
              <ProtectedRoute requiredRole={['Admin', 'HR_Manager']}>
                <AdminPayroll />
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
