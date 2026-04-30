/**
 * TAQWIN Monitoring and Governance Bridge
 * Bridges TAQWIN monitoring system to unified platform
 */

import { getUnifiedMemoryAPI } from '../../memory/shared/UnifiedMemoryAPI';

export interface MCPMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  requests_per_minute: number;
  error_rate: number;
  tool_usage: Record<string, number>;
  timestamp: string;
}

export interface TrafficLog {
  id: string;
  timestamp: string;
  request_id: string;
  method: string;
  tool_name?: string;
  parameters?: Record<string, any>;
  response_status: 'success' | 'error';
  response_time: number;
  error_message?: string;
  session_id: string;
}

export interface GovernanceSnapshot {
  id: string;
  url: string;
  content: Record<string, any>;
  checked_at: string;
  is_valid: boolean;
  violations: string[];
  compliance_score: number;
}

export interface SystemHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_status: 'connected' | 'disconnected' | 'degraded';
  active_connections: number;
  uptime: number;
  last_check: string;
}

export class MonitoringBridge {
  private api = getUnifiedMemoryAPI();
  private metrics: MCPMetrics[] = [];
  private trafficLogs: TrafficLog[] = [];
  private governanceSnapshots: GovernanceSnapshot[] = [];
  private systemHealth: SystemHealth | null = null;
  private alerts: any[] = [];

  constructor() {
    this._initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  private _initializeMonitoring(): void {
    // Start periodic health checks
    setInterval(() => {
      this._checkSystemHealth();
    }, 30000); // Every 30 seconds

    // Start metrics aggregation
    setInterval(() => {
      this._aggregateMetrics();
    }, 60000); // Every minute

    // Start governance compliance checks
    setInterval(() => {
      this._checkGovernanceCompliance();
    }, 300000); // Every 5 minutes
  }

  /**
   * Record MCP request/response metrics
   */
  recordMetrics(metrics: MCPMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 1000 entries
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check for alerts
    this._checkForAlerts(metrics);
    
    // Store in unified memory
    this._storeMetricsInMemory(metrics);
  }

  /**
   * Log traffic data
   */
  logTraffic(traffic: TrafficLog): void {
    this.trafficLogs.push(traffic);
    
    // Keep only last 5000 entries
    if (this.trafficLogs.length > 5000) {
      this.trafficLogs = this.trafficLogs.slice(-5000);
    }

    // Analyze for anomalies
    this._analyzeTrafficAnomalies(traffic);
    
    // Store in unified memory for important events
    if (traffic.response_status === 'error' || traffic.response_time > 5000) {
      this._storeTrafficInMemory(traffic);
    }
  }

  /**
   * Update governance snapshot
   */
  updateGovernanceSnapshot(snapshot: GovernanceSnapshot): void {
    this.governanceSnapshots.push(snapshot);
    
    // Keep only last 100 entries
    if (this.governanceSnapshots.length > 100) {
      this.governanceSnapshots = this.governanceSnapshots.slice(-100);
    }

    // Check compliance issues
    if (!snapshot.is_valid || snapshot.compliance_score < 0.8) {
      this._createGovernanceAlert(snapshot);
    }

    // Store in unified memory
    this._storeGovernanceInMemory(snapshot);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MCPMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes: number = 60): MCPMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(metric => 
      new Date(metric.timestamp) >= cutoff
    );
  }

  /**
   * Get traffic logs
   */
  getTrafficLogs(minutes: number = 60, toolName?: string): TrafficLog[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    let logs = this.trafficLogs.filter(log => 
      new Date(log.timestamp) >= cutoff
    );

    if (toolName) {
      logs = logs.filter(log => log.tool_name === toolName);
    }

    return logs;
  }

  /**
   * Get system health
   */
  getSystemHealth(): SystemHealth | null {
    return this.systemHealth;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): any[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get governance compliance status
   */
  getGovernanceStatus(): {
    current_snapshot: GovernanceSnapshot | null;
    compliance_trend: number[];
    active_violations: string[];
    overall_score: number;
  } {
    const current = this.governanceSnapshots.length > 0 
      ? this.governanceSnapshots[this.governanceSnapshots.length - 1] 
      : null;

    const trend = this.governanceSnapshots.slice(-10).map(s => s.compliance_score);
    const violations = current ? current.violations : [];
    const score = current ? current.compliance_score : 0;

    return {
      current_snapshot: current,
      compliance_trend: trend,
      active_violations: violations,
      overall_score: score
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(hours: number = 24): {
    summary: any;
    metrics: any;
    traffic: any;
    alerts: any;
    recommendations: string[];
  } {
    const metrics = this.getMetricsHistory(hours * 60);
    const traffic = this.getTrafficLogs(hours * 60);
    const alerts = this.getActiveAlerts();

    const summary = {
      total_requests: metrics.reduce((sum, m) => sum + m.total_requests, 0),
      success_rate: this._calculateSuccessRate(metrics),
      average_response_time: this._calculateAverageResponseTime(metrics),
      error_rate: this._calculateErrorRate(metrics),
      uptime: this._calculateUptime(),
      most_used_tools: this._getMostUsedTools(traffic),
      peak_traffic_time: this._getPeakTrafficTime(traffic)
    };

    const recommendations = this._generateRecommendations(summary, metrics, traffic);

    return {
      summary,
      metrics: {
        history: metrics,
        trends: this._calculateTrends(metrics)
      },
      traffic: {
        logs: traffic.slice(-100), // Last 100 entries
        patterns: this._analyzeTrafficPatterns(traffic)
      },
      alerts: {
        active: alerts,
        history: this.alerts.slice(-50) // Last 50 alerts
      },
      recommendations
    };
  }

  /**
   * Export monitoring data
   */
  exportMonitoringData(): {
    metrics: MCPMetrics[];
    traffic: TrafficLog[];
    governance: GovernanceSnapshot[];
    health: SystemHealth | null;
    alerts: any[];
    exported_at: string;
  } {
    return {
      metrics: this.metrics,
      traffic: this.trafficLogs,
      governance: this.governanceSnapshots,
      health: this.systemHealth,
      alerts: this.alerts,
      exported_at: new Date().toISOString()
    };
  }

  private async _checkSystemHealth(): Promise<void> {
    try {
      // This would implement actual system health checks
      // For now, simulate health data
      this.systemHealth = {
        overall_status: 'healthy',
        cpu_usage: Math.random() * 80,
        memory_usage: Math.random() * 70,
        disk_usage: Math.random() * 60,
        network_status: 'connected',
        active_connections: Math.floor(Math.random() * 100),
        uptime: Date.now() - (Math.random() * 86400000), // Random uptime up to 24h
        last_check: new Date().toISOString()
      };

      // Create health alert if needed
      if (this.systemHealth.cpu_usage > 80 || 
          this.systemHealth.memory_usage > 80 || 
          this.systemHealth.disk_usage > 80) {
        this._createHealthAlert(this.systemHealth);
      }
    } catch (error) {
      console.error('Failed to check system health:', error);
    }
  }

  private async _aggregateMetrics(): Promise<void> {
    try {
      const currentMetrics = this.getCurrentMetrics();
      if (!currentMetrics) return;

      // Aggregate metrics over the last hour
      const hourlyMetrics = this.getMetricsHistory(60);
      
      const aggregated = {
        total_requests: hourlyMetrics.reduce((sum, m) => sum + m.total_requests, 0),
        successful_requests: hourlyMetrics.reduce((sum, m) => sum + m.successful_requests, 0),
        failed_requests: hourlyMetrics.reduce((sum, m) => sum + m.failed_requests, 0),
        average_response_time: hourlyMetrics.reduce((sum, m) => sum + m.average_response_time, 0) / hourlyMetrics.length,
        requests_per_minute: hourlyMetrics.reduce((sum, m) => sum + m.requests_per_minute, 0) / hourlyMetrics.length,
        error_rate: hourlyMetrics.reduce((sum, m) => sum + m.error_rate, 0) / hourlyMetrics.length,
        tool_usage: this._aggregateToolUsage(hourlyMetrics),
        timestamp: new Date().toISOString()
      };

      this.recordMetrics(aggregated);
    } catch (error) {
      console.error('Failed to aggregate metrics:', error);
    }
  }

  private async _checkGovernanceCompliance(): Promise<void> {
    try {
      // This would implement actual governance compliance checks
      // For now, simulate compliance data
      const snapshot: GovernanceSnapshot = {
        id: `snapshot_${Date.now()}`,
        url: 'https://example.com/governance-snapshot',
        content: {
          rules: ['rule1', 'rule2', 'rule3'],
          policies: ['policy1', 'policy2']
        },
        checked_at: new Date().toISOString(),
        is_valid: Math.random() > 0.1, // 90% chance of being valid
        violations: Math.random() > 0.8 ? ['minor_violation'] : [],
        compliance_score: Math.random() * 0.3 + 0.7 // 0.7-1.0 range
      };

      this.updateGovernanceSnapshot(snapshot);
    } catch (error) {
      console.error('Failed to check governance compliance:', error);
    }
  }

  private _checkForAlerts(metrics: MCPMetrics): void {
    if (metrics.error_rate > 0.1) {
      this._createAlert('high_error_rate', `Error rate is ${(metrics.error_rate * 100).toFixed(1)}%`);
    }

    if (metrics.average_response_time > 5000) {
      this._createAlert('slow_response', `Average response time is ${metrics.average_response_time}ms`);
    }

    if (metrics.requests_per_minute > 100) {
      this._createAlert('high_traffic', `High traffic: ${metrics.requests_per_minute} requests/minute`);
    }
  }

  private _analyzeTrafficAnomalies(traffic: TrafficLog): void {
    // Simple anomaly detection
    if (traffic.response_time > 10000) {
      this._createAlert('slow_request', `Slow request detected: ${traffic.response_time}ms`);
    }

    if (traffic.response_status === 'error') {
      this._createAlert('request_error', `Request failed: ${traffic.error_message}`);
    }
  }

  private _createAlert(type: string, message: string): void {
    const alert = {
      id: `alert_${Date.now()}_${Math.random()}`,
      type,
      message,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Store important alerts in memory
    if (type === 'high_error_rate' || type === 'slow_response') {
      this._storeAlertInMemory(alert);
    }
  }

  private _createHealthAlert(health: SystemHealth): void {
    this._createAlert('health_warning', `System health warning: CPU ${health.cpu_usage.toFixed(1)}%, Memory ${health.memory_usage.toFixed(1)}%`);
  }

  private _createGovernanceAlert(snapshot: GovernanceSnapshot): void {
    this._createAlert('governance_violation', `Governance compliance issue: ${snapshot.violations.join(', ')}`);
  }

  private async _storeMetricsInMemory(metrics: MCPMetrics): Promise<void> {
    try {
      const content = `MCP Metrics Report\n\nTotal Requests: ${metrics.total_requests}\nSuccess Rate: ${((1 - metrics.error_rate) * 100).toFixed(1)}%\nAverage Response Time: ${metrics.average_response_time.toFixed(1)}ms\nRequests per Minute: ${metrics.requests_per_minute.toFixed(1)}`;
      
      await this.api.createMemory({
        session_id: 'taqwin_monitoring',
        title: 'MCP Metrics Report',
        content: content,
        type: 'event',
        domain: 'monitoring',
        tags: ['taqwin', 'monitoring', 'metrics'],
        importance: 5,
        confidence: 1.0,
        metadata: {
          metrics_type: 'mcp_metrics',
          total_requests: metrics.total_requests,
          error_rate: metrics.error_rate,
          average_response_time: metrics.average_response_time,
          timestamp: metrics.timestamp
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to store metrics in memory:', error);
    }
  }

  private async _storeTrafficInMemory(traffic: TrafficLog): Promise<void> {
    try {
      let content = `Traffic Log Entry\n\nTool: ${traffic.tool_name || 'N/A'}\nMethod: ${traffic.method}\nStatus: ${traffic.response_status}\nResponse Time: ${traffic.response_time}ms`;
      
      if (traffic.error_message) {
        content += `\nError: ${traffic.error_message}`;
      }
      
      await this.api.createMemory({
        session_id: traffic.session_id,
        title: `Traffic Log - ${traffic.response_status.toUpperCase()}`,
        content: content,
        type: traffic.response_status === 'error' ? 'mistake' : 'event',
        domain: 'monitoring',
        tags: ['taqwin', 'monitoring', 'traffic', traffic.response_status],
        importance: traffic.response_status === 'error' ? 7 : 4,
        confidence: 1.0,
        metadata: {
          traffic_type: 'traffic_log',
          tool_name: traffic.tool_name,
          method: traffic.method,
          response_status: traffic.response_status,
          response_time: traffic.response_time,
          timestamp: traffic.timestamp
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to store traffic in memory:', error);
    }
  }

  private async _storeGovernanceInMemory(snapshot: GovernanceSnapshot): Promise<void> {
    try {
      const content = `Governance Compliance Report\n\nCompliance Score: ${(snapshot.compliance_score * 100).toFixed(1)}%\nStatus: ${snapshot.is_valid ? 'Valid' : 'Invalid'}\nViolations: ${snapshot.violations.join(', ') || 'None'}`;
      
      await this.api.createMemory({
        session_id: 'taqwin_governance',
        title: 'Governance Compliance Report',
        content: content,
        type: snapshot.is_valid ? 'event' : 'mistake',
        domain: 'governance',
        tags: ['taqwin', 'governance', 'compliance'],
        importance: snapshot.is_valid ? 4 : 7,
        confidence: 1.0,
        metadata: {
          governance_type: 'compliance_report',
          compliance_score: snapshot.compliance_score,
          is_valid: snapshot.is_valid,
          violations: snapshot.violations,
          checked_at: snapshot.checked_at
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to store governance in memory:', error);
    }
  }

  private async _storeAlertInMemory(alert: any): Promise<void> {
    try {
      const content = `System Alert\n\nType: ${alert.type}\nMessage: ${alert.message}\nTimestamp: ${alert.timestamp}`;
      
      await this.api.createMemory({
        session_id: 'taqwin_alerts',
        title: `System Alert - ${alert.type}`,
        content: content,
        type: 'mistake',
        domain: 'monitoring',
        tags: ['taqwin', 'monitoring', 'alert', alert.type],
        importance: 8,
        confidence: 1.0,
        metadata: {
          alert_type: 'system_alert',
          alert_id: alert.id,
          alert_type_specific: alert.type,
          timestamp: alert.timestamp
        },
        system_origin: 'taqwin'
      });
    } catch (error) {
      console.error('Failed to store alert in memory:', error);
    }
  }

  // Helper methods for report generation
  private _calculateSuccessRate(metrics: MCPMetrics[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.total_requests, 0);
    const successful = metrics.reduce((sum, m) => sum + m.successful_requests, 0);
    return total > 0 ? successful / total : 0;
  }

  private _calculateAverageResponseTime(metrics: MCPMetrics[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.average_response_time, 0) / metrics.length;
  }

  private _calculateErrorRate(metrics: MCPMetrics[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.error_rate, 0) / metrics.length;
  }

  private _calculateUptime(): number {
    // Simplified uptime calculation
    return 0.99; // 99% uptime
  }

  private _getMostUsedTools(traffic: TrafficLog[]): Record<string, number> {
    const usage: Record<string, number> = {};
    traffic.forEach(log => {
      if (log.tool_name) {
        usage[log.tool_name] = (usage[log.tool_name] || 0) + 1;
      }
    });
    return usage;
  }

  private _getPeakTrafficTime(traffic: TrafficLog[]): string {
    // Simplified peak time calculation
    return '14:00'; // 2 PM
  }

  private _aggregateToolUsage(metrics: MCPMetrics[]): Record<string, number> {
    const usage: Record<string, number> = {};
    metrics.forEach(metric => {
      Object.entries(metric.tool_usage).forEach(([tool, count]) => {
        usage[tool] = (usage[tool] || 0) + count;
      });
    });
    return usage;
  }

  private _calculateTrends(metrics: MCPMetrics[]): any {
    // Simplified trend calculation
    return {
      response_time_trend: 'stable',
      error_rate_trend: 'decreasing',
      traffic_trend: 'increasing'
    };
  }

  private _analyzeTrafficPatterns(traffic: TrafficLog[]): any {
    // Simplified pattern analysis
    return {
      peak_hours: ['14:00', '15:00'],
      most_active_tools: this._getMostUsedTools(traffic),
      error_patterns: 'random'
    };
  }

  private _generateRecommendations(summary: any, metrics: MCPMetrics[], traffic: TrafficLog[]): string[] {
    const recommendations: string[] = [];

    if (summary.error_rate > 0.05) {
      recommendations.push('Investigate high error rate and implement better error handling');
    }

    if (summary.average_response_time > 2000) {
      recommendations.push('Optimize slow operations to improve response times');
    }

    if (summary.uptime < 0.99) {
      recommendations.push('Improve system stability to achieve higher uptime');
    }

    return recommendations;
  }
}

export default MonitoringBridge;
