const RESERVED_LABELS = new Set([
  "studentId",
  "email",
  "token",
  "requestId",
  "authorization",
  "cookie",
]);

const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_LABEL_VALUE_LENGTH = 256;
const MAX_LABEL_COUNT = 16;

export interface Labels {
  [key: string]: string;
}

export interface MetricDefinition {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  labelNames?: string[];
}

export interface HistogramSample {
  sum: number;
  count: number;
  buckets: Record<string, number>;
}

interface MetricRecord {
  definition: MetricDefinition;
  values: Map<string, number | HistogramSample>;
}

export class Registry {
  private readonly metrics = new Map<string, MetricRecord>();

  register(definition: MetricDefinition): void {
    const existing = this.metrics.get(definition.name);
    if (existing) {
      if (!definitionsMatch(existing.definition, definition)) {
        throw new Error(
          `Metric conflict: ${definition.name} already registered with different definition`,
        );
      }
      return;
    }

    for (const label of definition.labelNames ?? []) {
      validateLabelName(label);
    }

    this.metrics.set(definition.name, {
      definition,
      values: new Map(),
    });
  }

  private getRecord(name: string): MetricRecord {
    const record = this.metrics.get(name);
    if (!record) {
      throw new Error(`Metric not registered: ${name}`);
    }
    return record;
  }

  private key(labels: Labels): string {
    return JSON.stringify(labels, Object.keys(labels).sort());
  }

  private validateLabels(definition: MetricDefinition, labels: Labels): void {
    const labelNames = Object.keys(labels);
    const allowed = new Set(definition.labelNames ?? []);

    if (labelNames.length > MAX_LABEL_COUNT) {
      throw new Error(
        `Too many labels for ${definition.name}: ${labelNames.length} > ${MAX_LABEL_COUNT}`,
      );
    }

    for (const name of labelNames) {
      validateLabelName(name);
      if (!allowed.has(name)) {
        throw new Error(
          `Label ${name} is not declared for metric ${definition.name}`,
        );
      }
      const value = labels[name];
      if (value === undefined) {
        throw new Error(`Label ${name} value is undefined`);
      }
      if (value.length > MAX_LABEL_VALUE_LENGTH) {
        throw new Error(`Label ${name} value exceeds maximum length`);
      }
      if (name === "route" && /^https?:\/\//i.test(value)) {
        throw new Error(
          `Label route must use template path, got URL: ${value}`,
        );
      }
    }
  }

  inc(name: string, labels: Labels = {}, value = 1): void {
    const record = this.getRecord(name);
    if (record.definition.type !== "counter") {
      throw new Error(`Metric ${name} is not a counter`);
    }
    this.validateLabels(record.definition, labels);
    const key = this.key(labels);
    const current = (record.values.get(key) as number) ?? 0;
    record.values.set(key, current + value);
  }

  set(name: string, labels: Labels = {}, value: number): void {
    const record = this.getRecord(name);
    if (record.definition.type !== "gauge") {
      throw new Error(`Metric ${name} is not a gauge`);
    }
    this.validateLabels(record.definition, labels);
    record.values.set(this.key(labels), value);
  }

  getValue(name: string, labels: Labels = {}): number {
    const record = this.getRecord(name);
    if (
      record.definition.type !== "counter" &&
      record.definition.type !== "gauge"
    ) {
      throw new Error(`Metric ${name} is not a counter or gauge`);
    }
    return (record.values.get(this.key(labels)) as number) ?? 0;
  }

  observe(name: string, labels: Labels = {}, value: number): void {
    const record = this.getRecord(name);
    if (record.definition.type !== "histogram") {
      throw new Error(`Metric ${name} is not a histogram`);
    }
    this.validateLabels(record.definition, labels);
    const key = this.key(labels);
    const current = (record.values.get(key) as HistogramSample) ?? {
      sum: 0,
      count: 0,
      buckets: {},
    };
    current.sum += value;
    current.count += 1;
    for (const bucket of [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
      if (value <= bucket) {
        current.buckets[String(bucket)] =
          (current.buckets[String(bucket)] ?? 0) + 1;
      }
    }
    record.values.set(key, current);
  }

  getSnapshot(): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [name, record] of this.metrics) {
      output[name] = {
        help: record.definition.help,
        type: record.definition.type,
        values: Object.fromEntries(record.values),
      };
    }
    return output;
  }
}

function validateLabelName(name: string): void {
  if (!LABEL_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid label name: ${name}`);
  }
  if (RESERVED_LABELS.has(name)) {
    throw new Error(`Reserved label name not allowed: ${name}`);
  }
}

function definitionsMatch(a: MetricDefinition, b: MetricDefinition): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.help === b.help &&
    JSON.stringify((a.labelNames ?? []).sort()) ===
      JSON.stringify((b.labelNames ?? []).sort())
  );
}

export class Counter {
  constructor(
    private readonly registry: Registry,
    private readonly definition: MetricDefinition,
  ) {
    this.registry.register(definition);
  }

  inc(labels: Labels = {}, value = 1): void {
    this.registry.inc(this.definition.name, labels, value);
  }
}

export class Gauge {
  constructor(
    private readonly registry: Registry,
    private readonly definition: MetricDefinition,
  ) {
    this.registry.register(definition);
  }

  set(labels: Labels = {}, value: number): void {
    this.registry.set(this.definition.name, labels, value);
  }

  inc(labels: Labels = {}, value = 1): void {
    const now = this.registry.getValue(this.definition.name, labels);
    this.set(labels, now + value);
  }

  dec(labels: Labels = {}, value = 1): void {
    this.inc(labels, -value);
  }
}

export class Histogram {
  constructor(
    private readonly registry: Registry,
    private readonly definition: MetricDefinition,
  ) {
    this.registry.register(definition);
  }

  observe(labels: Labels = {}, value: number): void {
    this.registry.observe(this.definition.name, labels, value);
  }
}

export function createRegistry(): Registry {
  return new Registry();
}
