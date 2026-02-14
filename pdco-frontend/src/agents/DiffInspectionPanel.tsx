import React from 'react';
import type { AgentEvent } from './types';

export default function DiffInspectionPanel({ event }: { event?: AgentEvent }) {
  if (!event) return null;

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        background: '#0d0d15',
        border: '1px solid #333',
        borderRadius: 8
      }}
    >
      <h3>Event Detail</h3>

      <div>
        <strong>Type:</strong> {event.type}
      </div>
      <div>
        <strong>Task:</strong> {event.task_id}
      </div>
      <div>
        <strong>Timestamp:</strong> {new Date(event.timestamp).toLocaleString()}
      </div>

      {event.pr_number && event.pr_url && (
        <div>
          <strong>PR:</strong>{' '}
          <a href={event.pr_url} target="_blank" rel="noopener noreferrer" style={{ color: '#00f2ff' }}>
            #{event.pr_number}
          </a>
        </div>
      )}

      {event.policy && (
        <div style={{ marginTop: 10 }}>
          <strong>Policy Block ({event.policy.risk_level})</strong>
          <ul>
            {event.policy.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {event.diff && (
        <div style={{ marginTop: 16 }}>
          <strong>Diff</strong>

          {event.diff.files.map((file, index) => (
            <div key={index} style={{ marginTop: 12 }}>
              <div style={{ color: '#00f2ff' }}>{file.path}</div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 6
                }}
              >
                <pre
                  style={{
                    flex: 1,
                    background: '#111',
                    padding: 10,
                    overflow: 'auto',
                    maxHeight: 200
                  }}
                >
                  {file.before || ''}
                </pre>

                <pre
                  style={{
                    flex: 1,
                    background: '#1a1f1a',
                    padding: 10,
                    overflow: 'auto',
                    maxHeight: 200,
                    color: '#00ff88'
                  }}
                >
                  {file.after || ''}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
