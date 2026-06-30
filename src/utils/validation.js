import { DEFAULT_COUNTRY_CODE } from '../data/constants';

const PHONE_REGEX = /^\+92[0-9]{10}$/;

export function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `${DEFAULT_COUNTRY_CODE}${digits.slice(0, 10)}`;
}

export function isValidPhone(phone) {
  return PHONE_REGEX.test(normalizePhone(phone));
}

export function isValidEmail(email) {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateCustomerForm({ name, phone, address, email }) {
  const errors = {};
  if (!name?.trim()) errors.name = 'Full name is required';
  if (!address?.trim()) errors.address = 'Address is required';
  if (!isValidPhone(phone)) errors.phone = 'Enter valid phone (+92 + 10 digits)';
  if (!isValidEmail(email)) errors.email = 'Enter a valid email';
  return errors;
}

export function validateSaleForm({ bottleType, quantity, pricePerBottle }) {
  const errors = {};
  if (!bottleType) errors.bottleType = 'Select a bottle type';
  const qty = Number(quantity);
  if (!qty || qty < 1) errors.quantity = 'Quantity must be at least 1';
  const price = Number(pricePerBottle);
  if (Number.isNaN(price) || price < 0) errors.pricePerBottle = 'Enter a valid price';
  return errors;
}
