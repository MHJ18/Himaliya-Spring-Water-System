import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Button, ButtonGroup, FormGroup, Label, Input, CustomInput } from 'reactstrap';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import { useSettings } from '../../context/SettingsContext';
import { useCustomers } from '../../context/CustomerContext';
import { exportCustomersToCsv, exportSalesToCsv } from '../../utils/exportCsv';
import { isSupabaseConfigured } from '../../services/cloud/supabaseClient';
import { changeSidebarPosition, changeSidebarVisibility } from '../../actions/navigation';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getBottlePrices, saveBottlePrices } from '../../services/api/bottlePriceApi';
import { getCurrentAdminProfile } from '../../utils/adminAuth';
import PasswordChangeForm from '../../components/PasswordChangeForm/PasswordChangeForm';
import { getInventory, saveInventory } from '../../services/api/inventoryApi';
import './UtilityPages.css';

const defaultBottlePrices = BOTTLE_TYPES.reduce((acc, type) => ({ ...acc, [type]: '' }), {});

export default function Settings() {
  const { settings, updateSettings, toggleDarkMode } = useSettings();
  const dispatch = useDispatch();
  const sidebarPosition = useSelector((state) => state.navigation.sidebarPosition);
  const sidebarVisibility = useSelector((state) => state.navigation.sidebarVisibility);
  const { customers } = useCustomers();
  const cloudStatus = {
    status: isSupabaseConfigured() ? 'synced' : 'error',
    message: isSupabaseConfigured() ? 'Supabase is the only data store' : 'Supabase is not configured',
  };
  const [form, setForm] = useState({
    businessName: settings.businessName,
    businessPhone: settings.businessPhone,
    businessAddress: settings.businessAddress,
    autoAcceptOrders: settings.autoAcceptOrders,
    adminOrderNotifications: settings.adminOrderNotifications,
    requireDeliveryConfirmation: settings.requireDeliveryConfirmation,
    allowCustomerCancellation: settings.allowCustomerCancellation,
    invoiceDueDays: settings.invoiceDueDays,
    lowStockThreshold: settings.lowStockThreshold,
    orderCutoffTime: settings.orderCutoffTime,
  });
  const [bottlePrices, setBottlePrices] = useState(defaultBottlePrices);
  const [savingPrices, setSavingPrices] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState('');
  const [inventory, setInventory] = useState(defaultBottlePrices);
  const [savingInventory, setSavingInventory] = useState(false);

  useEffect(() => {
    getBottlePrices(defaultBottlePrices)
      .then((prices) => setBottlePrices({ ...defaultBottlePrices, ...prices }))
      .catch(() => toast.error('Could not load bottle prices.'));
  }, []);

  useEffect(() => { getCurrentAdminProfile().then((admin) => setCurrentAdminEmail(admin.email)).catch(() => {}); }, []);
  useEffect(() => { getInventory().then((stock) => setInventory({ ...defaultBottlePrices, ...stock })).catch(() => {}); }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, ...settings }));
  }, [settings]);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings(form);
    toast.success('Settings saved');
  };

  const updateWorkflow = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleWorkflowSave = (event) => {
    event.preventDefault();
    updateSettings({
      autoAcceptOrders: Boolean(form.autoAcceptOrders),
      adminOrderNotifications: Boolean(form.adminOrderNotifications),
      requireDeliveryConfirmation: Boolean(form.requireDeliveryConfirmation),
      allowCustomerCancellation: Boolean(form.allowCustomerCancellation),
      invoiceDueDays: Math.max(0, Number(form.invoiceDueDays) || 0),
      lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
      orderCutoffTime: form.orderCutoffTime || '18:00',
    });
    toast.success('Order workflow updated');
  };

  const updateBottlePrice = (type, value) => {
    setBottlePrices((current) => ({ ...current, [type]: value }));
  };

  const handleSavePrices = async (event) => {
    event.preventDefault();
    setSavingPrices(true);
    try {
      await saveBottlePrices(bottlePrices);
      toast.success('Bottle prices saved for all customers.');
    } catch (error) {
      toast.error(error.message || 'Could not save bottle prices.');
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSaveInventory = async (event) => {
    event.preventDefault();
    setSavingInventory(true);
    try { await saveInventory(inventory); toast.success('Inventory levels updated.'); }
    catch (error) { toast.error(error.message || 'Apply the inventory migration before saving stock.'); }
    finally { setSavingInventory(false); }
  };

  return (
    <PageShell title="Settings" subtitle="Business profile and preferences">
      <Row>
        <Col lg={6}>
          <Widget title={<h5>Appearance</h5>} collapse collapsed>
            <CustomInput type="switch" id="darkMode" label="Dark mode" checked={settings.darkMode} onChange={toggleDarkMode} />
            <hr />
            <FormGroup>
              <Label className="d-block">Sidebar position</Label>
              <ButtonGroup size="sm">
                <Button color="primary" outline={sidebarPosition !== 'left'} onClick={() => dispatch(changeSidebarPosition('left'))}>Left</Button>
                <Button color="primary" outline={sidebarPosition !== 'right'} onClick={() => dispatch(changeSidebarPosition('right'))}>Right</Button>
              </ButtonGroup>
            </FormGroup>
            <FormGroup className="mb-0">
              <Label className="d-block">Sidebar visibility</Label>
              <ButtonGroup size="sm">
                <Button color="primary" outline={sidebarVisibility !== 'show'} onClick={() => dispatch(changeSidebarVisibility('show'))}>Show</Button>
                <Button color="primary" outline={sidebarVisibility !== 'hide'} onClick={() => dispatch(changeSidebarVisibility('hide'))}>Hide</Button>
              </ButtonGroup>
            </FormGroup>
          </Widget>
          <Widget title={<h5>Business Profile</h5>} className="mt-4" collapse collapsed>
            <form onSubmit={handleSave}>
              <FormGroup><Label>Business Name</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></FormGroup>
              <FormGroup><Label>Phone</Label><Input value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} /></FormGroup>
              <FormGroup><Label>Address</Label><Input type="textarea" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} /></FormGroup>
              <Button color="primary" type="submit">Save</Button>
            </form>
          </Widget>
          <Widget title={<h5>Order Workflow</h5>} className="mt-4 workflow-settings-card">
            <div className="workflow-settings-intro">
              <span><i className="fa fa-random" /></span>
              <div><h4>Operational rules</h4><p>Control how customer orders move through acceptance, delivery, and billing.</p></div>
            </div>
            <form onSubmit={handleWorkflowSave}>
              <div className="workflow-switch-list">
                <CustomInput
                  type="switch"
                  id="autoAcceptOrders"
                  label="Automatically accept new customer orders"
                  checked={Boolean(form.autoAcceptOrders)}
                  onChange={(event) => updateWorkflow('autoAcceptOrders', event.target.checked)}
                />
                <CustomInput
                  type="switch"
                  id="adminOrderNotifications"
                  label="Notify admins when a customer places an order"
                  checked={Boolean(form.adminOrderNotifications)}
                  onChange={(event) => updateWorkflow('adminOrderNotifications', event.target.checked)}
                />
                <CustomInput
                  type="switch"
                  id="requireDeliveryConfirmation"
                  label="Require confirmation before marking delivered"
                  checked={Boolean(form.requireDeliveryConfirmation)}
                  onChange={(event) => updateWorkflow('requireDeliveryConfirmation', event.target.checked)}
                />
                <CustomInput
                  type="switch"
                  id="allowCustomerCancellation"
                  label="Allow customers to cancel pending orders"
                  checked={Boolean(form.allowCustomerCancellation)}
                  onChange={(event) => updateWorkflow('allowCustomerCancellation', event.target.checked)}
                />
              </div>
              <Row form className="mt-3">
                <Col sm={4}>
                  <FormGroup><Label for="invoiceDueDays">Invoice due days</Label><Input id="invoiceDueDays" type="number" min="0" max="90" value={form.invoiceDueDays} onChange={(event) => updateWorkflow('invoiceDueDays', event.target.value)} /></FormGroup>
                </Col>
                <Col sm={4}>
                  <FormGroup><Label for="lowStockThreshold">Low-stock alert</Label><Input id="lowStockThreshold" type="number" min="0" value={form.lowStockThreshold} onChange={(event) => updateWorkflow('lowStockThreshold', event.target.value)} /></FormGroup>
                </Col>
                <Col sm={4}>
                  <FormGroup><Label for="orderCutoffTime">Daily cutoff</Label><Input id="orderCutoffTime" type="time" value={form.orderCutoffTime} onChange={(event) => updateWorkflow('orderCutoffTime', event.target.value)} /></FormGroup>
                </Col>
              </Row>
              <Button color="primary" type="submit">Save Workflow</Button>
            </form>
          </Widget>
        </Col>
        <Col lg={6}>
          <Widget title={<h5>Fixed Bottle Prices</h5>} className="mb-4 settings-price-card">
            <div className="settings-price-intro">
              <span><i className="fa fa-tint" /></span>
              <div>
                <h4>Customer order prices</h4>
                <p>Set the fixed unit price for each bottle type. Customers will see these prices before placing an order.</p>
              </div>
            </div>
            <form onSubmit={handleSavePrices}>
              <Row>
                {BOTTLE_TYPES.map((type) => (
                  <Col sm={6} className="mb-3" key={type}>
                    <FormGroup className="settings-price-item mb-0">
                      <Label for={`settings-price-${type}`}>
                        {BOTTLE_TYPE_LABELS[type] || type}
                        <small>PKR per unit</small>
                      </Label>
                      <Input
                        id={`settings-price-${type}`}
                        type="number"
                        min="0"
                        step="1"
                        value={bottlePrices[type] || ''}
                        onChange={(e) => updateBottlePrice(type, e.target.value)}
                        placeholder="0"
                      />
                    </FormGroup>
                  </Col>
                ))}
              </Row>
              <Button color="primary" type="submit" disabled={savingPrices}>
                {savingPrices ? 'Saving...' : 'Save Bottle Prices'}
              </Button>
            </form>
          </Widget>
          <Widget title={<h5>Cloud & CSV Storage</h5>} className="mb-4 cloud-storage-card">
            <div className="cloud-storage-status">
              <span className={`cloud-status-dot ${cloudStatus.status}`} />
              <div>
                <strong>{isSupabaseConfigured() ? 'Supabase cloud storage ready' : 'Configuration required'}</strong>
                <p>{cloudStatus.message}</p>
              </div>
            </div>
            <p className="text-muted mb-3">
              Customers, sales, bottle prices, settings, and administrator profiles are stored in Supabase. CSV files are generated only when you export them.
            </p>
            <div className="cloud-storage-actions">
              <Button color="info" onClick={() => exportCustomersToCsv(customers)}>
                <i className="fa fa-download mr-1" /> Customers CSV
              </Button>
              <Button color="info" outline onClick={() => exportSalesToCsv(customers)}>
                <i className="fa fa-download mr-1" /> Sales CSV
              </Button>
            </div>
          </Widget>
          <Widget title={<h5>Live Bottle Inventory</h5>} className="mb-4 settings-price-card">
            <p className="text-muted">Sales automatically reduce these quantities. Alerts use the low-stock threshold configured in Order Workflow.</p>
            <form onSubmit={handleSaveInventory}><Row>{BOTTLE_TYPES.map((type) => <Col sm={6} className="mb-3" key={type}><FormGroup className="settings-price-item mb-0"><Label for={`stock-${type}`}>{BOTTLE_TYPE_LABELS[type] || type}<small>units available</small></Label><Input id={`stock-${type}`} type="number" min="0" step="1" value={inventory[type] || ''} onChange={(event) => setInventory((current) => ({ ...current, [type]: event.target.value }))} /></FormGroup></Col>)}</Row><Button color="primary" type="submit" disabled={savingInventory}>{savingInventory ? 'Saving...' : 'Save Inventory'}</Button></form>
          </Widget>
          {currentAdminEmail && <Widget title={<h5>Account Security</h5>} className="mb-4"><PasswordChangeForm email={currentAdminEmail} compact /></Widget>}
        </Col>
      </Row>
    </PageShell>
  );
}
