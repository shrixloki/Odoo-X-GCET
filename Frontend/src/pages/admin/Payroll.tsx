import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, FileText, DollarSign } from "lucide-react";
import { apiClient } from "@/lib/api";
import { simData } from "@/lib/simulationData";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PayrollRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  month: string;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: string;
  payment_date: string;
}

export default function AdminPayroll() {
  const [searchQuery, setSearchQuery] = useState("");
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getPayroll(true);
      if (response.success) {
        setPayrollData(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch payroll:', error);
    }
    setLoading(false);
  };

  const filteredData = payrollData.filter(
    (record) =>
      record.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(record.employee_id).includes(searchQuery)
  );

  const totalPayroll = payrollData.reduce((sum, r) => sum + (r.net_salary || 0), 0);
  const paidCount = payrollData.filter((r) => r.status === "Paid").length;
  const pendingCount = payrollData.filter((r) => r.status === "Pending").length;

  const handleExportAll = () => {
    simData.exportToCSV(payrollData, 'payroll');
    toast({
      title: "Export Started",
      description: "Payroll data is being downloaded as CSV",
    });
  };

  const handleExportPayslip = (record: PayrollRecord) => {
    simData.exportPayslip({
      id: record.id,
      employee_id: record.employee_id,
      employee_name: record.employee_name,
      month: record.month,
      year: record.year,
      basic_salary: record.basic_salary,
      allowances: record.allowances || 500,
      deductions: record.deductions,
      net_salary: record.net_salary,
      status: record.status,
      payment_date: record.payment_date || ''
    });
    toast({
      title: "Payslip Downloaded",
      description: `Payslip for ${record.employee_name} has been downloaded`,
    });
  };

  const handleRunPayroll = async () => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const currentYear = new Date().getFullYear();
    
    try {
      const response = await apiClient.generatePayroll({ month: currentMonth, year: currentYear });
      if (response.success) {
        toast({
          title: "Payroll Generated",
          description: `Payroll for ${currentMonth} ${currentYear} has been generated`,
        });
        fetchPayroll();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate payroll",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout role="admin" userName={user?.full_name || "HR Admin"}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payroll Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage employee salaries and generate pay slips
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={handleExportAll}>
              <Download className="h-4 w-4" />
              Export All
            </Button>
            <Button className="gap-2" onClick={handleRunPayroll}>
              <DollarSign className="h-4 w-4" />
              Run Payroll
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="mt-1 text-2xl font-semibold">${totalPayroll.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">This period</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Employees</p>
            <p className="mt-1 text-2xl font-semibold">{payrollData.length}</p>
            <p className="text-xs text-muted-foreground">on payroll</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-semibold text-success">{paidCount}</p>
            <p className="text-xs text-muted-foreground">salaries processed</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">requires action</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Payroll Table */}
        <div className="rounded-md border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Employee</th>
                    <th>Period</th>
                    <th>Basic</th>
                    <th>Allowances</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? filteredData.map((record) => (
                    <tr key={record.id}>
                      <td className="font-medium">EMP-{String(record.employee_id).padStart(3, '0')}</td>
                      <td>{record.employee_name}</td>
                      <td>{record.month} {record.year}</td>
                      <td>${(record.basic_salary || 0).toLocaleString()}</td>
                      <td>${(record.allowances || 500).toLocaleString()}</td>
                      <td>${(record.deductions || 0).toLocaleString()}</td>
                      <td className="font-medium">${(record.net_salary || 0).toLocaleString()}</td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                            record.status === "Paid"
                              ? "bg-success/10 text-success"
                              : "bg-pending/10 text-pending"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1 text-primary"
                            onClick={() => handleExportPayslip(record)}
                          >
                            <FileText className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        No payroll records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {filteredData.length} of {payrollData.length} records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
