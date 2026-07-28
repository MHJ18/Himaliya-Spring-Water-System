jest.mock('../../cloud/supabaseClient', () => ({
  dbRequest: jest.fn(),
}));

const { dbRequest } = require('../../cloud/supabaseClient');
const {
  getCustomerBottlePrices,
  getOwnCustomerBottlePrices,
  saveCustomerBottlePrices,
} = require('../customerBottlePriceApi');

describe('customerBottlePriceApi', () => {
  beforeEach(() => dbRequest.mockReset());

  it('loads only the prices assigned to the requested customer', async () => {
    dbRequest.mockResolvedValueOnce([
      { bottle_type: 'Gallon', price: 275 },
      { bottle_type: 'Small Bottle', price: 35 },
    ]);

    await expect(getCustomerBottlePrices('customer-1')).resolves.toEqual({
      Gallon: 275,
      'Small Bottle': 35,
    });
    expect(dbRequest).toHaveBeenCalledWith('/rpc/get_customer_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({ p_customer_id: 'customer-1' }),
    });
  });

  it('loads portal prices from the signed-in customer identity', async () => {
    dbRequest.mockResolvedValueOnce([
      { bottle_type: 'Gallon', price: 175 },
    ]);

    await expect(getOwnCustomerBottlePrices()).resolves.toEqual({
      Gallon: 175,
    });
    expect(dbRequest).toHaveBeenCalledWith('/rpc/get_customer_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({ p_customer_id: null }),
    });
  });

  it('saves the normalized per-customer price map through the protected RPC', async () => {
    dbRequest.mockResolvedValueOnce([
      { bottle_type: 'Gallon', price: 300 },
      { bottle_type: 'Large Bottle', price: 80 },
    ]);

    await expect(saveCustomerBottlePrices('customer-2', {
      Gallon: '300',
      'Large Bottle': '80',
    })).resolves.toEqual({
      Gallon: 300,
      'Large Bottle': 80,
    });
    expect(dbRequest).toHaveBeenCalledWith('/rpc/set_customer_bottle_prices', {
      method: 'POST',
      body: JSON.stringify({
        p_customer_id: 'customer-2',
        p_prices: { Gallon: 300, 'Large Bottle': 80 },
      }),
    });
  });

  it('falls back to the assigned-price table when the RPC migration is pending', async () => {
    dbRequest
      .mockRejectedValueOnce(Object.assign(new Error('function missing from schema cache'), { code: 'PGRST202' }))
      .mockResolvedValueOnce([{ bottle_type: 'Gallon', price: 250 }]);

    await expect(getCustomerBottlePrices('customer-3')).resolves.toEqual({ Gallon: 250 });
    expect(dbRequest).toHaveBeenNthCalledWith(
      2,
      '/customer_bottle_prices?customer_id=eq.customer-3&select=bottle_type,price',
    );
  });
});
