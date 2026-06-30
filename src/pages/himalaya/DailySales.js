import React, { useState, useMemo, useEffect } from 'react';
import {
  Row, Col, Input, Button, InputGroup, InputGroupAddon, InputGroupText, Badge, FormGroup, Label,
} from 'reactstrap';
import { toast } from 'react-toastify';
import PageShell from '../../components/PageShell/PageShell';
import Widget from '../../components/Widget/Widget';
import CustomerSummary from '../../components/common/CustomerSummary';
import SalesFormBootstrap from '../../components/forms/SalesFormBootstrap';
import { useCustomers } from '../../context/CustomerContext';
import { useSales } from '../../context/SalesContext';
import { normalizePhone } from '../../utils/validation';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { BOTTLE_TYPES, BOTTLE_TYPE_LABELS } from '../../data/constants';
import { getBottlePrices, saveBottlePrices } from '../../services/api/bottlePriceApi';
import LoadingState from '../../components/LoadingState/LoadingState';

const defaultPriceTypes = BOTTLE_TYPES;
const defaultPrices = defaultPriceTypes.reduce((acc, type) => ({ ...acc, [type]: '' }), {});

export default function DailySales() {
  const {
    customers, findByPhone, searchCustomers, loading,
  } = useCustomers();
  const { recordSale } = useSales();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searched, setSearched] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);
  const [priceDefaults, setPriceDefaults] = useState(defaultPrices);

  useEffect(() => {
    getBottlePrices(defaultPrices).then(setPriceDefaults);
  }, []);

  const customer = useMemo(() => {
    if (!selectedId) return null;
    return customers.find((c) => c.id === selectedId) || null;
  }, [customers, selectedId]);

  const resolveMatches = (query) => {
    const q = query.trim();
    if (!q) return [];
    const hasEnoughPhoneDigits = q.replace(/\D/g, '').length >= 3;
    const exactPhoneMatch = hasEnoughPhoneDigits ? findByPhone(normalizePhone(q)) : null;
    return exactPhoneMatch ? [exactPhoneMatch] : searchCustomers(q);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    setSearched(true);

    if (!q) {
      setMatches([]);
      setSelectedId(null);
      return;
    }

    const nextMatches = resolveMatches(q);
    setMatches(nextMatches);
    setSelectedId(nextMatches.length === 1 ? nextMatches[0].id : null);
  };

  const handleSale = async (form) => {
    if (!customer) return;
    setSaleLoading(true);
    try {
      await recordSale({ customerId: customer.id, ...form });
      toast.success('Sale recorded');
    } catch {
      toast.error('Failed to record sale');
    } finally {
      setSaleLoading(false);
    }
  };

  const updatePriceDefault = (type, value) => {
    const next = { ...priceDefaults, [type]: value };
    setPriceDefaults(next);
    saveBottlePrices(next);
  };

  if (loading) return <PageShell title="Daily Sales Entry"><LoadingState label="Loading sales counter..." variant="form" /></PageShell>;

  return (
    <PageShell title="Daily Sales Entry">
      <div className="daily-sales-hero">
        <div>
          <span className="daily-sales-kicker">Sales counter</span>
          <h2>Find a customer, record the delivery, keep today moving.</h2>
          <p>Search by customer name or phone number, then enter bottle quantity and price in one focused flow.</p>
        </div>
        <div className="daily-sales-bubbles" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <Widget title={<h5>Find Customer</h5>} className="mb-4 daily-sales-search-card">
        <form onSubmit={handleSearch}>
          <Row>
            <Col lg={9}>
              <InputGroup className="daily-sales-search">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText><i className="fa fa-search" /></InputGroupText>
                </InputGroupAddon>
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => {
                    const nextSearch = e.target.value;
                    const nextMatches = resolveMatches(nextSearch);
                    setSearchTerm(nextSearch);
                    setMatches(nextMatches);
                    setSearched(!!nextSearch.trim());
                    setSelectedId(null);
                  }}
                  placeholder="Search by name or phone number..."
                  className="bg-custom-dark border-0"
                />
              </InputGroup>
            </Col>
            <Col lg={3} className="mt-3 mt-lg-0">
              <Button color="primary" block type="submit" className="daily-sales-search-btn">
                Search Customer
              </Button>
            </Col>
          </Row>
        </form>
      </Widget>

      {searched && !customer && (
        matches.length === 0 ? (
          <Widget title={<h5 className="text-danger">Customer Not Found</h5>}>
            <p className="mb-0">No customer matched that name or phone number.</p>
          </Widget>
        ) : (
          <Widget title={<h5>Select Customer</h5>} className="daily-sales-results">
            <Row>
              {matches.map((match, idx) => (
                <Col md={6} xl={4} className="mb-3" key={match.id}>
                  <button type="button" className="daily-sales-customer-card" onClick={() => setSelectedId(match.id)}>
                    <img src={match.photo || getCustomerAvatar(idx)} alt="" />
                    <strong>{match.name}</strong>
                    <span>{match.phone}</span>
                    <small>{match.address}</small>
                    <Badge color="primary">{(match.purchaseHistory || []).length} orders</Badge>
                  </button>
                </Col>
              ))}
            </Row>
          </Widget>
        )
      )}

      {customer && (
        <Row className="daily-sales-workspace">
          <Col xl={5} lg={6}>
            <CustomerSummary customer={customer} />
            <Widget title={<h5>Quick Bottle Prices</h5>} className="daily-sales-price-card">
              <div className="price-card-head">
                <div>
                  <span>Saved defaults</span>
                  <p>Auto-fill sale prices by bottle type.</p>
                </div>
                <i className="fa fa-tint" />
              </div>
              <Row className="price-default-grid">
                {defaultPriceTypes.map((type) => (
                  <Col sm={6} xl={3} className="mb-3" key={type}>
                    <FormGroup className="price-default-item mb-0">
                      <Label>
                        <span>{BOTTLE_TYPE_LABELS[type] || type}</span>
                        <small>PKR</small>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={priceDefaults[type] || ''}
                        onChange={(e) => updatePriceDefault(type, e.target.value)}
                        placeholder="PKR"
                        className="bg-custom-dark border-0"
                      />
                    </FormGroup>
                  </Col>
                ))}
              </Row>
            </Widget>
          </Col>
          <Col xl={7} lg={6} className="mt-4 mt-lg-0">
            <Widget title={<h5>Record Purchase</h5>} refresh className="daily-sales-form-card">
              <SalesFormBootstrap onSubmit={handleSale} loading={saleLoading} priceDefaults={priceDefaults} />
            </Widget>
          </Col>
        </Row>
      )}
    </PageShell>
  );
}
