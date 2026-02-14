import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ExecutionGraph from './ExecutionGraph';
import PRMonitor from './PRMonitor';
import PolicyPanel from './PolicyPanel';
import BudgetPanel from './BudgetPanel';
import { useAgentSocket } from './useAgentSocket';
import type { AgentRunResponse, PRTaskResult, TaskGraph } from './types';

export default function AgentsPanel() {
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [results, setResults] = useState<PRTaskResult[]>([]);
  const [budget, setBudget] = useState<AgentRunResponse['budget']>();
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [timelineIndex, setTimelineIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mergedTaskEvent, setMergedTaskEvent] = useState<{ taskId: string; nonce: number } | null>(null);
  const previousDerivedStateRef = useRef<Record<string, string>>({});

  const recordEvent = useCallback((event: any) => {
    setEventLog((prev) => [...prev, { ...event, time: Date.now() }]);
  }, []);

  const reconstructState = useCallback(
    (index: number) => {
      const state: Record<string, string> = {};

      for (let i = 0; i <= index && i < eventLog.length; i += 1) {
        const e = eventLog[i];

        if (e.type === 'initial') {
          state[e.task_id] = e.status;
        }

        if (e.type === 'ci') {
          if (e.status === 'in_progress') state[e.task_id] = 'running';
          if (e.conclusion === 'failure') state[e.task_id] = 'blocked';
          if (e.conclusion === 'success') state[e.task_id] = 'ci_green';
        }

        if (e.type === 'pr' && e.merged) {
          state[e.task_id] = 'merged';
        }
      }

      return state;
    },
    [eventLog]
  );

  const derivedTaskStates = useMemo(() => reconstructState(timelineIndex), [reconstructState, timelineIndex]);

  const runAgents = useCallback(async () => {
    const response = await fetch('http://localhost:3000/multi-agent-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective: 'create something cool',
        constraints: { risk: 'medium' }
      })
    });

    const data: AgentRunResponse = await response.json();
    setGraph(data.task_graph);
    setResults(data.tasks);
    setBudget(data.budget);
    setEventLog([]);
    setTimelineIndex(0);
    setIsPlaying(false);
    setMergedTaskEvent(null);
    previousDerivedStateRef.current = {};

    data.tasks.forEach((result) => {
      if (!result.status) return;
      recordEvent({
        type: 'initial',
        task_id: result.task_id,
        status: result.status
      });
    });
  }, [recordEvent]);

  const handleCIUpdate = useCallback((ci: any) => {
    if (!ci.task_id) return;
    recordEvent({
      type: 'ci',
      task_id: ci.task_id,
      status: ci.status,
      conclusion: ci.conclusion
    });
  }, [recordEvent]);

  const handlePRUpdate = useCallback((pr: any) => {
    if (!pr.task_id) return;

    recordEvent({
      type: 'pr',
      task_id: pr.task_id,
      merged: pr.merged
    });
  }, [recordEvent]);

  useAgentSocket(handleCIUpdate, handlePRUpdate);

  useEffect(() => {
    if (!eventLog.length) {
      setTimelineIndex(0);
      return;
    }

    setTimelineIndex((prev) => (prev >= eventLog.length - 2 ? eventLog.length - 1 : prev));
  }, [eventLog.length]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTimelineIndex((prev) => {
        if (prev >= eventLog.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, eventLog.length]);

  useEffect(() => {
    Object.entries(derivedTaskStates).forEach(([taskId, state]) => {
      if (state === 'merged' && previousDerivedStateRef.current[taskId] !== 'merged') {
        setMergedTaskEvent({ taskId, nonce: Date.now() + Math.random() });
      }
    });

    previousDerivedStateRef.current = derivedTaskStates;
  }, [derivedTaskStates]);

  return (
    <div className="agents-panel">
      <button onClick={runAgents}>Run via Agents</button>

      {graph && (
        <div className="agents-layout">
          <div className="agents-graph-wrap">
            <ExecutionGraph tasks={graph.tasks} taskStates={derivedTaskStates} mergedTaskEvent={mergedTaskEvent} />
            <div style={{ marginTop: 20 }}>
              <button onClick={() => setTimelineIndex((prev) => Math.max(prev - 1, 0))}>◀ Step</button>
              <button onClick={() => setIsPlaying((playing) => !playing)} style={{ marginLeft: 8 }}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => setTimelineIndex((prev) => Math.min(prev + 1, Math.max(eventLog.length - 1, 0)))}
                style={{ marginLeft: 8 }}
              >
                Step ▶
              </button>

              <input
                type="range"
                min={0}
                max={Math.max(eventLog.length - 1, 0)}
                value={timelineIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setTimelineIndex(Number(e.target.value));
                }}
                style={{ width: '400px', marginLeft: 20 }}
              />

              <span style={{ marginLeft: 12 }}>
                {timelineIndex} / {Math.max(eventLog.length - 1, 0)}
              </span>
            </div>
          </div>
          <div className="agents-sidebar">
            <PRMonitor results={results} />
            <PolicyPanel results={results} />
            <BudgetPanel budget={budget} />
          </div>
        </div>
      )}
    </div>
  );
}
