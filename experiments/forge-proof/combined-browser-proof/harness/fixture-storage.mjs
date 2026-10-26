// LOCAL_TEST_NOT_DEPLOYABLE. In-memory storage for the synthetic browser fixture.
// Data and the one alarm commit together; rejected transactions change neither.
export class MemoryStorage {
  constructor() {
    this.data = new Map();
    this.tail = Promise.resolve();
    this.alarmAt = Infinity;
    this.alarming = false;
  }
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k, v) { this.data.set(k, structuredClone(v)); }
  async delete(k) { return this.data.delete(k); }
  async list({ prefix }) {
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k, structuredClone(v)]));
  }
  async getAlarm() { return Number.isFinite(this.alarmAt) ? this.alarmAt : null; }
  async setAlarm(t) { this.alarmAt = t; }
  transaction(fn) {
    const run = this.tail.then(async () => {
      const staged = new MemoryStorage();
      staged.data = structuredClone(this.data);
      staged.alarmAt = this.alarmAt;
      const result = await fn(staged);
      this.data = staged.data;
      this.alarmAt = staged.alarmAt;
      return result;
    });
    this.tail = run.catch(() => {});
    return run;
  }
}
