/**
 * Validation Panel Component
 *
 * Displays validation errors and warnings from the safety layer.
 * Shows alerts when placeholder data is detected or schema validation fails.
 *
 * Based on research:
 * - "AI Guardrails: Stop AI Hallucinations & Inaccuracies" (Auxis, 2025)
 * - "Data Quality Anomaly Detection" (Monte Carlo Data, 2024)
 */

import { useEffect, useState } from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { useTaskStore } from '../stores/taskStore';
import { getObservability } from '../core/observability';

interface ValidationPanelProps {
  className?: string;
}

export default function ValidationPanel({ className = '' }: ValidationPanelProps) {
  const { validationErrors: docErrors, safetyEnabled: docSafetyEnabled, enableSafety: enableDocSafety } = useDocumentStore();
  const { validationErrors: taskErrors, enableSafety: enableTaskSafety } = useTaskStore();
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    severity: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    dismissible: boolean;
  }>>([]);

  const obs = getObservability();

  useEffect(() => {
    // Load active alerts from observability
    const activeAlerts = obs.getActiveAlerts();
    const formattedAlerts = activeAlerts.map(alert => ({
      id: alert.id,
      severity: alert.severity === 'critical' || alert.severity === 'error' ? 'error' as const :
               alert.severity === 'warning' ? 'warning' as const : 'info' as const,
      title: alert.title,
      message: alert.message,
      dismissible: alert.category !== 'placeholder' || docSafetyEnabled,
    }));
    setAlerts(formattedAlerts);
  }, [docSafetyEnabled]);

  // Combine all validation errors
  const allErrors = [
    ...docErrors.map(err => ({ source: 'document' as const, message: err })),
    ...taskErrors.map(err => ({ source: 'task' as const, message: err })),
  ];

  const hasErrors = allErrors.length > 0;
  const hasAlerts = alerts.length > 0;

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    obs.resolveAlert(id);
  };

  const handleEnableSafety = () => {
    enableDocSafety();
    enableTaskSafety();
    obs.info('Safety checks enabled by user');
  };

  if (!hasErrors && !hasAlerts) {
    return null;
  }

  return (
    <div className={`validation-panel ${className}`}>
      {/* Safety Disabled Warning */}
      {!docSafetyEnabled && (
        <div className="alert alert-warning safety-warning">
          <div className="alert-content">
            <h4>⚠️ Safety Checks Disabled</h4>
            <p>
              Placeholder and mock data may be allowed. Re-enable safety checks
              to protect data quality.
            </p>
            <button onClick={handleEnableSafety} className="btn btn-primary">
              Enable Safety
            </button>
          </div>
        </div>
      )}

      {/* System Alerts */}
      {hasAlerts && (
        <div className="system-alerts">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`alert alert-${alert.severity} ${alert.dismissible ? 'dismissible' : ''}`}
            >
              <div className="alert-content">
                <h4>{alert.title}</h4>
                <p>{alert.message}</p>
                {alert.dismissible && (
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="btn-close"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validation Errors */}
      {hasErrors && (
        <div className="validation-errors">
          <h4>Validation Issues ({allErrors.length})</h4>
          <ul className="error-list">
            {allErrors.map((error, index) => (
              <li key={index} className="error-item">
                <span className="error-source">[{error.source}]</span>
                <span className="error-message">{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .validation-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          max-width: 400px;
          z-index: 1000;
          font-size: 14px;
        }

        .alert {
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .alert-warning {
          background: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
        }

        .alert-error {
          background: #f8d7da;
          border: 1px solid #dc3545;
          color: #721c24;
        }

        .alert-info {
          background: #d1ecf1;
          border: 1px solid #17a2b8;
          color: #0c5460;
        }

        .alert.dismissible {
          position: relative;
          padding-right: 40px;
        }

        .alert-content h4 {
          margin: 0 0 8px 0;
          font-weight: 600;
        }

        .alert-content p {
          margin: 0;
        }

        .btn-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 8px;
          color: inherit;
          opacity: 0.7;
        }

        .btn-close:hover {
          opacity: 1;
        }

        .safety-warning {
          display: flex;
          align-items: center;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #0f172a;
          color: white;
        }

        .btn-primary:hover {
          background: #1e293b;
        }

        .validation-errors {
          background: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-top: 12px;
        }

        .validation-errors h4 {
          margin: 0 0 12px 0;
          font-weight: 600;
          color: #dc3545;
        }

        .error-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .error-item {
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
        }

        .error-item:last-child {
          border-bottom: none;
        }

        .error-source {
          font-weight: 600;
          color: #6b7280;
          font-size: 12px;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .error-message {
          color: #374151;
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .validation-errors {
            background: #1e293b;
          }

          .error-item {
            border-bottom-color: #374151;
          }

          .error-source {
            color: #9ca3af;
          }

          .error-message {
            color: #e5e7eb;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Validation Badge Component
 *
 * Small badge showing validation status
 */
export function ValidationBadge() {
  const { validationErrors, safetyEnabled } = useDocumentStore();
  const { validationErrors: taskErrors } = useTaskStore();

  const totalErrors = validationErrors.length + taskErrors.length;

  if (totalErrors === 0 && safetyEnabled) {
    return (
      <span className="validation-badge validation-badge-success" title="All validations passing">
        ✓
      </span>
    );
  }

  if (!safetyEnabled) {
    return (
      <span className="validation-badge validation-badge-warning" title="Safety checks disabled">
        ⚠
      </span>
    );
  }

  return (
    <span className="validation-badge validation-badge-error" title={`${totalErrors} validation error(s)`}>
      {totalErrors}
    </span>
  );
}
