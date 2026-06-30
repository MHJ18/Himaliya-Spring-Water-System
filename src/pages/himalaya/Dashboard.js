import React, { useMemo } from 'react';
import { Row, Col, Progress, Table } from 'reactstrap';
import AnimateNumber from 'react-animated-number';
import Widget from '../../components/Widget/Widget';
import Calendar from '../dashboard/components/calendar/Calendar';
import CustomerMap from '../dashboard/components/customer-map/CustomerMap';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useCustomers } from '../../context/CustomerContext';
import { formatCurrency } from '../../utils/formatters';
import { getAdminCustomerPortalStats } from '../../services/api/customerPortalApi';
import s from '../dashboard/Dashboard.module.scss';
import { ADMIN_AVATAR } from '../../utils/customerPhotos';
import LoadingState from '../../components/LoadingState/LoadingState';

function DeliveryOverviewWidget({
  totalCustomers,
  activeCustomers,
  revenueThisMonth,
  bottlesSoldToday,
  todayStats,
  monthGrowth,
}) {
  return (
    <>
      <p>Status: <strong>Live</strong></p>
      <p>
        <span className="circle bg-default text-white"><i className="fa fa-tint" /></span>
        &nbsp; {totalCustomers} Customers &middot; {activeCustomers} Active
      </p>
      <div className="row progress-stats">
        <div className="col-md-9 col-12">
          <h6 className="name fw-semi-bold">Monthly Revenue</h6>
          <p className="description deemphasize mb-xs text-white">{formatCurrency(revenueThisMonth)}</p>
          <Progress color="primary" value={monthGrowth} className="bg-subtle-blue progress-xs" />
        </div>
        <div className="col-md-3 col-12 text-center">
          <span className="status rounded rounded-lg bg-default text-light"><small><AnimateNumber value={monthGrowth} />%</small></span>
        </div>
      </div>
      <div className="row progress-stats">
        <div className="col-md-9 col-12">
          <h6 className="name fw-semi-bold">Bottles Sold Today</h6>
          <p className="description deemphasize mb-xs text-white">{bottlesSoldToday} bottles</p>
          <Progress color="success" value={Math.min(100, bottlesSoldToday * 2)} className="bg-subtle-blue progress-xs" />
        </div>
        <div className="col-md-3 col-12 text-center">
          <span className="status rounded rounded-lg bg-default text-light"><small><AnimateNumber value={bottlesSoldToday} /></small></span>
        </div>
      </div>
      <div className="row progress-stats">
        <div className="col-md-9 col-12">
          <h6 className="name fw-semi-bold">Orders Today</h6>
          <p className="description deemphasize mb-xs text-white">{todayStats.totalOrders} transactions</p>
          <Progress color="danger" value={Math.min(100, todayStats.totalOrders * 10)} className="bg-subtle-blue progress-xs" />
        </div>
        <div className="col-md-3 col-12 text-center">
          <span className="status rounded rounded-lg bg-default text-light"><small><AnimateNumber value={todayStats.totalOrders} /></small></span>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const {
    loading, revenueThisMonth, bottlesSoldToday, activeCustomers, totalCustomers,
    monthStats, todayStats, recentTransactions,
  } = useAnalytics();
  const { customers } = useCustomers();
  const [portalStats, setPortalStats] = React.useState({
    signedUpCustomers: 0,
    pendingOrders: 0,
    unreadAdminNotifications: 0,
  });

  React.useEffect(() => {
    getAdminCustomerPortalStats()
      .then(setPortalStats)
      .catch(() => {});
  }, []);
  const monthGrowth = useMemo(() => {
    if (!totalCustomers) return 0;
    return Math.min(99, Math.round((activeCustomers / totalCustomers) * 100));
  }, [activeCustomers, totalCustomers]);

  if (loading) {
    return (
      <div className={s.root}>
        <h1 className="page-title">Dashboard</h1>
        <LoadingState label="Loading dashboard..." />
      </div>
    );
  }

  const tableRows = recentTransactions.slice(0, 3);
  return (
    <div className={s.root}>
      <h1 className="page-title">
        Dashboard &nbsp;
        <small><small>Himaliya Spring Water</small></small>
      </h1>

      <Row>
        <Col lg={7} md={12}>
          <Widget className="bg-transparent" title={<h5>Customer <span className="fw-semi-bold">Coverage</span></h5>}>
            <CustomerMap customers={customers} />
          </Widget>
        </Col>
        <Col lg={5} md={12}>
          <Widget className="bg-transparent" title={<h5>Delivery <span className="fw-semi-bold">Overview</span></h5>} settings refresh close>
            <DeliveryOverviewWidget
              totalCustomers={totalCustomers}
              activeCustomers={activeCustomers}
              revenueThisMonth={revenueThisMonth}
              bottlesSoldToday={bottlesSoldToday}
              todayStats={todayStats}
              monthGrowth={monthGrowth}
            />
          </Widget>
        </Col>
      </Row>

      <Row>
        <Col lg={6} xl={4} xs={12}>
          <Widget title={<h6> MONTHLY PERFORMANCE </h6>} close settings>
            <div className="stats-row">
              <div className="stat-item"><h6 className="name">Total</h6><p className="value">{formatCurrency(revenueThisMonth)}</p></div>
              <div className="stat-item"><h6 className="name">Orders</h6><p className="value">{monthStats.totalOrders}</p></div>
              <div className="stat-item"><h6 className="name">Bottles</h6><p className="value">{monthStats.totalBottles}</p></div>
            </div>
            <Progress color="success" value={monthGrowth} className="bg-subtle-blue progress-xs" />
            <p><small><span className="circle bg-default text-white mr-2"><i className="fa fa-chevron-up" /></span></small>
              <span className="fw-semi-bold">&nbsp;{totalCustomers} customers</span> registered</p>
          </Widget>
        </Col>
        <Col lg={6} xl={4} xs={12}>
          <Widget title={<h6> TODAY&apos;S SALES </h6>} close settings>
            <div className="stats-row">
              <div className="stat-item"><h6 className="name">Revenue</h6><p className="value">{formatCurrency(todayStats.totalRevenue)}</p></div>
              <div className="stat-item"><h6 className="name">Orders</h6><p className="value">{todayStats.totalOrders}</p></div>
              <div className="stat-item"><h6 className="name">Bottles</h6><p className="value">{todayStats.totalBottles}</p></div>
            </div>
            <Progress color="danger" value={Math.min(100, todayStats.totalOrders * 10)} className="bg-subtle-blue progress-xs" />
            <p><small><span className="circle bg-default text-white mr-2"><i className="fa fa-chevron-down" /></span></small>
              <span className="fw-semi-bold">&nbsp;{bottlesSoldToday} bottles</span> sold today</p>
          </Widget>
        </Col>
        <Col lg={6} xl={4} xs={12}>
          <Widget title={<h6> CUSTOMER ACTIVITY </h6>} close settings>
            <div className="stats-row">
              <div className="stat-item"><h6 className="name fs-sm">Active</h6><p className="value">{activeCustomers}</p></div>
              <div className="stat-item"><h6 className="name fs-sm">Total</h6><p className="value">{totalCustomers}</p></div>
              <div className="stat-item"><h6 className="name fs-sm">Today</h6><p className="value">{todayStats.totalOrders}</p></div>
            </div>
            <Progress color="bg-primary" value={monthGrowth} className="bg-subtle-blue progress-xs" />
            <p><small><span className="circle bg-default text-white mr-2"><i className="fa fa-plus" /></span></small>
              <span className="fw-semi-bold">&nbsp;{formatCurrency(monthStats.totalRevenue)}</span> monthly revenue</p>
          </Widget>
        </Col>
        <Col lg={6} xl={4} xs={12}>
          <Widget title={<h6> CUSTOMER APP </h6>} close settings>
            <div className="stats-row">
              <div className="stat-item"><h6 className="name fs-sm">Signed up</h6><p className="value">{portalStats.signedUpCustomers}</p></div>
              <div className="stat-item"><h6 className="name fs-sm">Pending</h6><p className="value">{portalStats.pendingOrders}</p></div>
              <div className="stat-item"><h6 className="name fs-sm">Alerts</h6><p className="value">{portalStats.unreadAdminNotifications}</p></div>
            </div>
            <Progress color="info" value={Math.min(100, portalStats.pendingOrders * 12)} className="bg-subtle-blue progress-xs" />
            <p><small><span className="circle bg-info text-white mr-2"><i className="fa fa-bell" /></span></small>
              <span className="fw-semi-bold">&nbsp;{portalStats.pendingOrders} orders</span> waiting for acceptance</p>
          </Widget>
        </Col>
      </Row>

      <Row>
        <Col lg={4} xs={12}>
          <Widget title={<h6><span className="badge badge-success mr-2">Live</span> Recent Sales</h6>} refresh close>
            <div className="widget-body undo_padding">
              <div className="list-group list-group-lg">
                {recentTransactions.slice(0, 4).map((t) => {
                  const cust = customers.find((c) => c.id === t.customerId);
                  return (
                    <button key={t.id} type="button" className="list-group-item text-left">
                      <span className="thumb-sm float-left mr">
                        <img className="rounded-circle" src={(cust && cust.photo) || ADMIN_AVATAR} alt="" />
                        <i className="status status-bottom bg-success" />
                      </span>
                      <div>
                        <h6 className="m-0">{t.customerName}</h6>
                        <p className="help-block text-ellipsis m-0">{t.bottleType} &times; {t.quantity} - {formatCurrency(t.totalAmount)}</p>
                      </div>
                    </button>
                  );
                })}
                {!recentTransactions.length && <p className="p-3 text-muted mb-0">No sales yet</p>}
              </div>
            </div>
          </Widget>
        </Col>
        <Col lg={4} xs={12}>
          <Widget title={<h6>Sales <span className="fw-semi-bold">Ledger</span></h6>} close>
            <div className="widget-body">
              <h3>{formatCurrency(monthStats.totalRevenue)}</h3>
              <p className="fs-mini text-muted mb mt-sm">Monthly orders: <span className="fw-semi-bold">{monthStats.totalOrders}</span></p>
            </div>
            <div className={`widget-table-overflow ${s.table}`}>
              <Table striped size="sm">
                <thead className="no-bd">
                  <tr>
                    <th>Customer</th>
                    <th>Order</th>
                    <th className="text-align-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => (
                    <tr key={t.id}>
                      <td>{t.customerName}</td>
                      <td>{t.bottleType} &times; {t.quantity}</td>
                      <td className="text-align-right fw-semi-bold">{formatCurrency(t.totalAmount)}</td>
                    </tr>
                  ))}
                  {!tableRows.length && (
                    <tr><td colSpan="3" className="text-center text-muted">No sales recorded yet</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Widget>
        </Col>
        <Col lg={4} xs={12}>
          <Widget title={<h6>Calendar</h6>} settings close bodyClass="pt-2 px-0 py-0">
            <Calendar />
            <div className="list-group fs-mini">
              <button type="button" className="list-group-item text-ellipsis"><span className="badge badge-pill badge-primary float-right">AM</span>Morning delivery route</button>
              <button type="button" className="list-group-item text-ellipsis"><span className="badge badge-pill badge-success float-right">PM</span>Evening collection</button>
            </div>
          </Widget>
        </Col>
      </Row>
    </div>
  );
}
