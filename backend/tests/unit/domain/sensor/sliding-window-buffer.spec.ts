import { SlidingWindowBuffer } from '../../../../src/domain/sensor/SlidingWindowBuffer';
import { DomainInvariantException } from '../../../../src/domain/common/exceptions/DomainInvariantException';

describe('SlidingWindowBuffer', () => {
  it('rejects capacities outside [1,128]', () => {
    expect(() => new SlidingWindowBuffer(0)).toThrow(DomainInvariantException);
    expect(() => new SlidingWindowBuffer(129)).toThrow(DomainInvariantException);
    expect(() => new SlidingWindowBuffer(2.5)).toThrow(DomainInvariantException);
  });

  it('rejects non-finite pushes', () => {
    const b = new SlidingWindowBuffer(4);
    expect(() => b.push(NaN)).toThrow(DomainInvariantException);
    expect(() => b.push(Infinity)).toThrow(DomainInvariantException);
  });

  it('grows up to capacity then rolls over FIFO', () => {
    const b = new SlidingWindowBuffer(3);
    b.push(1); b.push(2); b.push(3);
    expect(b.size).toBe(3);
    expect(b.snapshot()).toEqual([1, 2, 3]);
    b.push(4);
    expect(b.snapshot()).toEqual([2, 3, 4]);
    expect(b.isFull).toBe(true);
  });

  it('computes moving average and median (odd/even)', () => {
    const odd = new SlidingWindowBuffer(5);
    [1, 2, 3, 4, 5].forEach((v) => odd.push(v));
    expect(odd.movingAverage()).toBe(3);
    expect(odd.movingMedian()).toBe(3);

    const even = new SlidingWindowBuffer(4);
    [10, 20, 30, 40].forEach((v) => even.push(v));
    expect(even.movingAverage()).toBe(25);
    expect(even.movingMedian()).toBe(25);
  });

  it('returns 0/empty for empty buffer', () => {
    const b = new SlidingWindowBuffer(3);
    expect(b.movingAverage()).toBe(0);
    expect(b.movingMedian()).toBe(0);
    expect(b.snapshot()).toEqual([]);
  });

  it('clear() resets state', () => {
    const b = new SlidingWindowBuffer(3);
    b.push(1); b.push(2);
    b.clear();
    expect(b.size).toBe(0);
    expect(b.snapshot()).toEqual([]);
  });
});