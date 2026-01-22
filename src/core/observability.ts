/**
 * Observability and Monitoring System
 *
 * Implements monitoring, alerting, and anomaly detection for the Doc Manager.
 * Based on research from:
 * - "Data Observability Quality Monitoring" (Datadog, 2025)
 * - "Data Quality Anomaly Detection" (Monte Carlo Data, 2024)
 * - "Observability vs Monitoring vs Testing" (Telma AI, 2024)
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags?: Record<string, string>;
  status?: 'ok' | 'error';
  error?: Error;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  category: 'data_quality' | 'performance' | 'security' | 'schema_violation' | 'placeholder';
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  enableMetrics: boolean;
  enableLogging: boolean;
  enableTracing: boolean;
  enableAlerts: boolean;
  enableHealthChecks: boolean;
  metricRetentionDays: number;
  logRetentionDays: number;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  errorRate: number; // 0-1
  latencyMs: number;
  dataQualityScore: number; // 0-100
  placeholderCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ObservabilityConfig = {
  enableMetrics: true,
  enableLogging: true,
  enableTracing: true,
  enableAlerts: true,
  enableHealthChecks: true,
  metricRetentionDays: 30,
  logRetentionDays: 7,
  alertThresholds: {
    errorRate: 0.05, // 5%
    latencyMs: 1000,
    dataQualityScore: 70,
    placeholderCount: 0,
  },
};

/**
 * Observability system singleton
 */
class ObservabilitySystem {
  private config: ObservabilityConfig;
  private metrics: Metric[] = [];
  private logs: LogEntry[] = [];
  private traces: Map<string, Span[]> = new Map();
  private alerts: Alert[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metricAggregates: Map<string, number[]> = new Map();

  constructor(config: Partial<ObservabilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize local storage persistence
    this.loadFromStorage();

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour

    // Start health check interval
    if (this.config.enableHealthChecks) {
      setInterval(() => this.runHealthChecks(), 5 * 60 * 1000); // Every 5 minutes
    }
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    if (!this.config.enableMetrics) return;

    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit,
    };

    this.metrics.push(metric);

    // Update aggregates
    if (!this.metricAggregates.has(name)) {
      this.metricAggregates.set(name, []);
    }
    this.metricAggregates.get(name)!.push(value);

    // Keep aggregates at reasonable size
    const aggregates = this.metricAggregates.get(name)!;
    if (aggregates.length > 1000) {
      aggregates.shift();
    }

    // Check thresholds
    this.checkMetricThresholds(metric);

    this.saveToStorage();
  }

  increment(name: string, tags?: Record<string, string>): void {
    const current = this.getLatestMetric(name, tags);
    this.recordMetric(name, (current || 0) + 1, tags);
  }

  decrement(name: string, tags?: Record<string, string>): void {
    const current = this.getLatestMetric(name, tags);
    this.recordMetric(name, (current || 0) - 1, tags);
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.recordMetric(name, durationMs, tags, 'ms');
  }

  getMetrics(name?: string, since?: number): Metric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (since) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    return filtered;
  }

  getMetricStats(name: string, _since?: number): {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metricAggregates.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  private getLatestMetric(name: string, tags?: Record<string, string>): number | null {
    const filtered = this.metrics.filter(m => m.name === name);
    if (tags) {
      const tagKeys = Object.keys(tags);
      return filtered
        .filter(m => tagKeys.every(k => m.tags?.[k] === tags[k]))
        .slice(-1)[0]?.value || null;
    }
    return filtered.slice(-1)[0]?.value || null;
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, { ...context, error: error?.message });
    this.recordMetric('error.count', 1, { level: 'error' });
  }

  log(level: LogEntry['level'], message: string, context?: Record<string, unknown>): void {
    if (!this.config.enableLogging) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };

    this.logs.push(entry);

    // Also log to console in development
    if (this.isDevelopment()) {
      const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      logFn(`[${level.toUpperCase()}]`, message, context || '');
    }

    this.saveToStorage();
  }

  getLogs(level?: LogEntry['level'], since?: number): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter(l => l.level === level);
    }

    if (since) {
      filtered = filtered.filter(l => l.timestamp >= since);
    }

    return filtered;
  }

  // ==========================================================================
  // TRACING
  // ==========================================================================

  startSpan(operation: string, parentSpanId?: string, tags?: Record<string, string>): Span {
    if (!this.config.enableTracing) {
      return {
        traceId: '',
        spanId: '',
        operation,
        startTime: Date.now(),
      };
    }

    const traceId = parentSpanId
      ? this.getTraceBySpan(parentSpanId) || this.generateTraceId()
      : this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: Date.now(),
      tags,
      status: 'ok',
    };

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);

    return span;
  }

  endSpan(span: Span, error?: Error): void {
    if (!this.config.enableTracing) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    if (error) {
      span.status = 'error';
      span.error = error;
      this.recordMetric('span.errors', 1, { operation: span.operation });
    } else {
      this.recordMetric('span.duration', span.duration, { operation: span.operation }, 'ms');
    }

    this.saveToStorage();
  }

  getTrace(traceId: string): Span[] | undefined {
    return this.traces.get(traceId);
  }

  // ==========================================================================
  // ALERTS
  // ==========================================================================

  createAlert(
    severity: Alert['severity'],
    title: string,
    message: string,
    category: Alert['category'],
    metadata?: Record<string, unknown>
  ): Alert {
    if (!this.config.enableAlerts) {
      const alert: Alert = {
        id: this.generateId(),
        severity,
        title,
        message,
        timestamp: Date.now(),
        category,
        metadata,
      };
      return alert;
    }

    const alert: Alert = {
      id: this.generateId(),
      severity,
      title,
      message,
      timestamp: Date.now(),
      category,
      metadata,
    };

    this.alerts.push(alert);
    this.recordMetric('alert.count', 1, { severity, category });

    // Log the alert
    this.log(
      severity === 'critical' || severity === 'error' ? 'error' : 'warn',
      `[ALERT] ${title}: ${message}`,
      metadata
    );

    this.saveToStorage();
    return alert;
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.saveToStorage();
    }
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAlertsByCategory(category: Alert['category']): Alert[] {
    return this.alerts.filter(a => a.category === category && !a.resolved);
  }

  // ==========================================================================
  // HEALTH CHECKS
  // ==========================================================================

  registerHealthCheck(name: string, check: () => Omit<HealthCheck, 'timestamp'>): void {
    if (!this.config.enableHealthChecks) return;

    const result = check();
    this.healthChecks.set(name, {
      ...result,
      timestamp: Date.now(),
    });

    this.recordMetric('health.check', result.status === 'healthy' ? 1 : 0, { name });
    this.saveToStorage();
  }

  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  isSystemHealthy(): boolean {
    const checks = this.getHealthChecks();
    return checks.every(c => c.status === 'healthy');
  }

  private runHealthChecks(): void {
    // IndexedDB health check
    this.registerHealthCheck('indexeddb', () => {
      try {
        const dbExists = !!window.indexedDB;
        return {
          name: 'indexeddb',
          status: dbExists ? 'healthy' : 'unhealthy',
          message: dbExists ? 'IndexedDB available' : 'IndexedDB not available',
        };
      } catch (error) {
        return {
          name: 'indexeddb',
          status: 'unhealthy',
          message: `IndexedDB error: ${(error as Error).message}`,
        };
      }
    });

    // LocalStorage health check
    this.registerHealthCheck('localStorage', () => {
      try {
        localStorage.setItem('__health_check__', 'test');
        localStorage.removeItem('__health_check__');
        return {
          name: 'localStorage',
          status: 'healthy',
          message: 'LocalStorage functional',
        };
      } catch (error) {
        return {
          name: 'localStorage',
          status: 'unhealthy',
          message: `LocalStorage error: ${(error as Error).message}`,
        };
      }
    });

    // Data quality health check
    this.registerHealthCheck('data_quality', () => {
      const errorLogs = this.getLogs('error').filter(l => l.timestamp > Date.now() - 3600000);
      const errorRate = errorLogs.length / Math.max(this.logs.length, 1);

      return {
        name: 'data_quality',
        status: errorRate < this.config.alertThresholds.errorRate ? 'healthy' : 'degraded',
        message: `Error rate: ${(errorRate * 100).toFixed(2)}% (${errorLogs.length} errors)`,
        details: { errorRate, errorCount: errorLogs.length },
      };
    });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private checkMetricThresholds(metric: Metric): void {
    const thresholds = this.config.alertThresholds;

    // Check latency threshold
    if (metric.name.includes('duration') || metric.name.includes('latency')) {
      if (metric.value > thresholds.latencyMs) {
        this.createAlert(
          'warning',
          'High Latency Detected',
          `${metric.name}: ${metric.value}${metric.unit || ''} exceeds threshold of ${thresholds.latencyMs}ms`,
          'performance',
          { metric, threshold: thresholds.latencyMs }
        );
      }
    }

    // Check placeholder count
    if (metric.name === 'placeholder.count' && metric.value > 0) {
      this.createAlert(
        metric.value > thresholds.placeholderCount ? 'error' : 'warning',
        'Placeholder Data Detected',
        `${metric.value} placeholder(s) detected in data`,
        'placeholder',
        { count: metric.value }
      );
    }

    // Check data quality score
    if (metric.name === 'data_quality.score' && metric.value < thresholds.dataQualityScore) {
      this.createAlert(
        'warning',
        'Low Data Quality Score',
        `Data quality score ${metric.value} below threshold ${thresholds.dataQualityScore}`,
        'data_quality',
        { score: metric.value, threshold: thresholds.dataQualityScore }
      );
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const metricCutoff = now - this.config.metricRetentionDays * 24 * 60 * 60 * 1000;
    const logCutoff = now - this.config.logRetentionDays * 24 * 60 * 60 * 1000;

    this.metrics = this.metrics.filter(m => m.timestamp > metricCutoff);
    this.logs = this.logs.filter(l => l.timestamp > logCutoff);
    this.alerts = this.alerts.filter(a => {
      if (a.resolved && a.resolvedAt) {
        return a.resolvedAt > metricCutoff;
      }
      return a.timestamp > metricCutoff;
    });

    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      const data = {
        metrics: this.metrics.slice(-1000), // Limit storage
        logs: this.logs.slice(-500),
        alerts: this.alerts.slice(-100),
      };
      localStorage.setItem('doc-manager-observability', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save observability data:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('doc-manager-observability');
      if (data) {
        const parsed = JSON.parse(data);
        this.metrics = parsed.metrics || [];
        this.logs = parsed.logs || [];
        this.alerts = parsed.alerts || [];
      }
    } catch (error) {
      console.error('Failed to load observability data:', error);
    }
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getTraceBySpan(spanId: string): string | undefined {
    for (const [traceId, spans] of this.traces.entries()) {
      if (spans.some(s => s.spanId === spanId)) {
        return traceId;
      }
    }
    return undefined;
  }

  // ==========================================================================
  // PUBLIC API FOR EXPORT
  // ==========================================================================

  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ObservabilityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  reset(): void {
    this.metrics = [];
    this.logs = [];
    this.traces.clear();
    this.alerts = [];
    this.healthChecks.clear();
    this.metricAggregates.clear();
    localStorage.removeItem('doc-manager-observability');
  }
}

// ===========================================================================
// SINGLETON INSTANCE
// ===========================================================================

let instance: ObservabilitySystem | null = null;

export function getObservability(config?: Partial<ObservabilityConfig>): ObservabilitySystem {
  if (!instance) {
    instance = new ObservabilitySystem(config);
  }
  return instance;
}

export function resetObservability(): void {
  if (instance) {
    instance.reset();
    instance = null;
  }
}

// ===========================================================================
// UTILITY FUNCTIONS
// ===========================================================================

/**
 * Wrap a function with timing and error tracking
 */
export function withObservability<T extends (...args: any[]) => any>(
  operation: string,
  fn: T,
  tags?: Record<string, string>
): T {
  return ((...args: any[]) => {
    const obs = getObservability();
    const span = obs.startSpan(operation, undefined, tags);

    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result
          .then((value) => {
            obs.endSpan(span);
            return value;
          })
          .catch((error) => {
            obs.endSpan(span, error);
            obs.error(`Operation failed: ${operation}`, error);
            throw error;
          });
      }

      obs.endSpan(span);
      return result;
    } catch (error) {
      obs.endSpan(span, error as Error);
      obs.error(`Operation failed: ${operation}`, error as Error);
      throw error;
    }
  }) as T;
}

/**
 * Create a traced version of an async function
 */
export function traced<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T,
  tags?: Record<string, string>
): T {
  return withObservability(operation, fn, tags);
}
