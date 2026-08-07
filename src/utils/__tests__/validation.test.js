import { validateSaleForm } from '../validation';

describe('validateSaleForm', () => {
  it('requires an individual positive price for every sale entry', () => {
    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 1,
      pricePerBottle: '',
    })).toEqual({
      pricePerBottle: 'Unit price must be greater than 0',
    });

    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 1,
      pricePerBottle: 0,
    })).toEqual({
      pricePerBottle: 'Unit price must be greater than 0',
    });
  });

  it('accepts a valid per-entry price', () => {
    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 2,
      pricePerBottle: 350,
    })).toEqual({});
  });

  it('rejects negative and overpaid sale amounts', () => {
    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 2,
      pricePerBottle: 350,
      amountPaid: -1,
    })).toEqual({
      amountPaid: 'Amount paid cannot be negative',
    });

    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 2,
      pricePerBottle: 350,
      amountPaid: 701,
    })).toEqual({
      amountPaid: 'Amount paid cannot exceed the sale total',
    });
  });

  it.each([0, 350, 700])('accepts a valid payment amount of %s', (amountPaid) => {
    expect(validateSaleForm({
      bottleType: '19L',
      quantity: 2,
      pricePerBottle: 350,
      amountPaid,
    })).toEqual({});
  });
});
