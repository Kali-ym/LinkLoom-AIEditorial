export interface HttpMetric {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

export class MonitoringService {
  static readonly startedAt = Date.now();
  private static httpTotal = 0;
  private static httpErrors = 0;
  private static dbErrors = 0;
  private static totalLatencyMs = 0;

  static recordHttp(metric: HttpMetric): void {
    this.httpTotal++;
    this.totalLatencyMs += metric.durationMs;
    if (metric.statusCode >= 500) this.httpErrors++;
  }

  static recordDbError(): void {
    this.dbErrors++;
  }

  static snapshot() {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      httpTotal: this.httpTotal,
      httpErrors: this.httpErrors,
      averageLatencyMs: this.httpTotal > 0 ? Math.round(this.totalLatencyMs / this.httpTotal) : 0,
      dbErrors: this.dbErrors
    };
  }

  static prometheusText(): string {
    const metrics = this.snapshot();
    return (
      [
        '# HELP linkloom_uptime_seconds Process uptime in seconds',
        '# TYPE linkloom_uptime_seconds gauge',
        `linkloom_uptime_seconds ${metrics.uptimeSeconds}`,
        '# HELP linkloom_http_requests_total Total HTTP requests',
        '# TYPE linkloom_http_requests_total counter',
        `linkloom_http_requests_total ${metrics.httpTotal}`,
        '# HELP linkloom_http_errors_total Total HTTP 5xx responses',
        '# TYPE linkloom_http_errors_total counter',
        `linkloom_http_errors_total ${metrics.httpErrors}`,
        '# HELP linkloom_http_average_latency_ms Average HTTP latency in milliseconds',
        '# TYPE linkloom_http_average_latency_ms gauge',
        `linkloom_http_average_latency_ms ${metrics.averageLatencyMs}`,
        '# HELP linkloom_db_errors_total Total database errors observed',
        '# TYPE linkloom_db_errors_total counter',
        `linkloom_db_errors_total ${metrics.dbErrors}`
      ].join('\n') + '\n'
    );
  }
}
