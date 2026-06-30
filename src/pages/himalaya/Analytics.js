import React from 'react';
import { Row, Col, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import MonthlyRevenueChart from '../../components/charts/MonthlyRevenueChart';
import DailySalesChart from '../../components/charts/DailySalesChart';
import BottlePieChart from '../../components/charts/BottlePieChart';
import CustomerGrowthChart from '../../components/charts/CustomerGrowthChart';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { formatCurrency } from '../../utils/formatters';
import { exportSalesToCsv } from '../../utils/exportCsv';
import LoadingState from '../../components/LoadingState/LoadingState';

export default function Analytics() {
  const {
    loading, revenueThisMonth, bottlesSoldToday, activeCustomers, totalCustomers,
    monthlyRevenueChart, dailySalesChart, bottleDistribution, customerGrowth,
  } = useAnalytics();
  const { customers } = useCustomers();

  if (loading) return <PageShell title="Monthly Analytics"><LoadingState label="Loading analytics..." /></PageShell>;

  return (
    <PageShell title="Monthly Analytics" subtitle="Charts and business insights">
      <div className="text-right mb-3">
        <Button color="info" onClick={() => { exportSalesToCsv(customers); toast.success('CSV exported'); }}>
          <i className="fa fa-download mr-1" /> Export Sales CSV
        </Button>
      </div>
      <Row>
        <Col lg={3} md={6} className="mb-4"><Widget title={<h6>Revenue</h6>} close><h3>{formatCurrency(revenueThisMonth)}</h3></Widget></Col>
        <Col lg={3} md={6} className="mb-4"><Widget title={<h6>Bottles Today</h6>} close><h3>{bottlesSoldToday}</h3></Widget></Col>
        <Col lg={3} md={6} className="mb-4"><Widget title={<h6>Active</h6>} close><h3>{activeCustomers}</h3></Widget></Col>
        <Col lg={3} md={6} className="mb-4"><Widget title={<h6>Customers</h6>} close><h3>{totalCustomers}</h3></Widget></Col>
      </Row>
      <Row>
        <Col lg={6} className="mb-4"><Widget title={<h5>Monthly Revenue</h5>} refresh close><MonthlyRevenueChart data={monthlyRevenueChart} /></Widget></Col>
        <Col lg={6} className="mb-4"><Widget title={<h5>Daily Sales</h5>} refresh close><DailySalesChart data={dailySalesChart} /></Widget></Col>
        <Col lg={6} className="mb-4"><Widget title={<h5>Bottle Distribution</h5>} refresh close><BottlePieChart data={bottleDistribution} /></Widget></Col>
        <Col lg={6} className="mb-4"><Widget title={<h5>Customer Growth</h5>} refresh close><CustomerGrowthChart data={customerGrowth} /></Widget></Col>
      </Row>
    </PageShell>
  );
}
