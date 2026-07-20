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
});
