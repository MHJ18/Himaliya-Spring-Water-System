import { isStrongStaffPassword } from '../StaffPasswordSetup';

describe('first-login staff password validation', () => {
  it('requires every displayed password criterion', () => {
    expect(isStrongStaffPassword('short')).toBe(false);
    expect(isStrongStaffPassword('alllowercase1!')).toBe(false);
    expect(isStrongStaffPassword('ALLUPPERCASE1!')).toBe(false);
    expect(isStrongStaffPassword('NoNumber!')).toBe(false);
    expect(isStrongStaffPassword('NoSpecial1')).toBe(false);
    expect(isStrongStaffPassword('Secure1!')).toBe(true);
  });
});
