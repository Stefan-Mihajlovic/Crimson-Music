/** Distinguishes React echoes from intentional external changes to native input. */
export class NativeTextSync {
  private previousProp: string;
  private pending: string[] = [];

  constructor(value: string) {
    this.previousProp = value;
  }

  nativeChanged(value: string) {
    this.pending.push(value);
    if (this.pending.length > 1_000) this.pending.shift();
  }

  shouldWriteProp(value: string) {
    if (value === this.previousProp) return false;
    this.previousProp = value;
    const echo = this.pending.indexOf(value);
    if (echo !== -1) {
      this.pending.splice(0, echo + 1);
      return false;
    }
    this.pending = [];
    return true;
  }
}
