import { createId } from '../id';

describe('createId', () => {
  it('creates unique UUID-shaped identifiers without a third-party runtime dependency', () => {
    const first = createId();
    const second = createId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
