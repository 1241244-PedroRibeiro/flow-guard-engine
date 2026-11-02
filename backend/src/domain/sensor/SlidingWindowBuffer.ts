import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';

/**
 * Bounded Circular Ring Buffer (KB §4.3, ADR-0004).
 * Capacity N ∈ [1, 128]. O(1) push, O(W log W) moving median.
 */
export class SlidingWindowBuffer {
  static readonly MIN_CAPACITY = 1;
  static readonly MAX_CAPACITY = 128;

  private readonly buffer: number[];
  private cursor = 0;
  private count = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < SlidingWindowBuffer.MIN_CAPACITY || capacity > SlidingWindowBuffer.MAX_CAPACITY) {
      throw new DomainInvariantException(
        `SlidingWindowBuffer capacity must be integer in [${SlidingWindowBuffer.MIN_CAPACITY}, ${SlidingWindowBuffer.MAX_CAPACITY}]; got ${capacity}.`,
      );
    }
    this.buffer = new Array(capacity);
  }

  push(value: number): void {
    if (!Number.isFinite(value)) {
      throw new DomainInvariantException(`SlidingWindowBuffer rejects non-finite value: ${value}.`);
    }
    this.buffer[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  get size(): number { return this.count; }
  get isFull(): boolean { return this.count === this.capacity; }

  snapshot(): number[] {
    if (this.count === 0) return [];
    if (!this.isFull) return this.buffer.slice(0, this.count);
    return [...this.buffer.slice(this.cursor), ...this.buffer.slice(0, this.cursor)];
  }

  movingAverage(): number {
    const s = this.snapshot();
    if (s.length === 0) return 0;
    return s.reduce((a, b) => a + b, 0) / s.length;
  }

  movingMedian(): number {
    const s = this.snapshot();
    if (s.length === 0) return 0;
    const sorted = [...s].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  clear(): void {
    this.cursor = 0;
    this.count = 0;
    this.buffer.length = 0;
    this.buffer.length = this.capacity;
  }
}