'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Pause, Play, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';

interface Props {
  workloadId: string;
  workloadName: string;
}

interface LogLine {
  id: number;
  ts: string;
  message: string;
}

const MAX_LINES = 2000;
const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    : '';

export function WorkloadLogsTab({ workloadId, workloadName }: Props) {
  const token = useAuthStore((s) => s.token);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [, setRetryCount] = useState(0);

  const append = useCallback((message: string) => {
    counterRef.current += 1;
    const id = counterRef.current;
    setLines((prev) => {
      const next = [...prev, { id, ts: new Date().toISOString(), message }];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }, []);

  const connectStream = useCallback(async () => {
    if (!token || !workloadId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setConnected(false);

    const url = `${API_BASE}/api/v1/workloads/${workloadId}/logs/stream?tail_lines=200`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body.detail || body.message || detail;
        } catch { /* plain text or empty */ }
        setError(detail);
        return;
      }

      if (!res.body) {
        setError('Streaming not supported by browser');
        return;
      }

      setConnected(true);
      setError(null);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (!line.trim()) continue;

          // SSE format: "event: <type>" or "data: <payload>"
          if (line.startsWith('event:')) continue;
          if (line.startsWith(':')) continue; // SSE comment / heartbeat

          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === 'connected' || parsed.event === 'connected') {
                continue;
              }
              if (parsed.type === 'heartbeat' || parsed.event === 'heartbeat') {
                continue;
              }
              if (parsed.type === 'closed' || parsed.event === 'closed') {
                setConnected(false);
                setError('Stream closed by server');
                return;
              }
              append(parsed.line ?? parsed.message ?? payload);
            } catch {
              append(payload);
            }
            continue;
          }

          // Fallback: treat raw lines as log output
          append(line);
        }
      }

      setConnected(false);
      setError('Stream ended');
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, [workloadId, token, append]);

  useEffect(() => {
    connectStream();
    return () => abortRef.current?.abort();
  }, [connectStream]);

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, follow]);

  const retry = () => {
    setRetryCount((c) => c + 1);
    connectStream();
  };

  const downloadLogs = () => {
    const blob = new Blob([lines.map((l) => l.message).join('\n')], {
      type: 'text/plain',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${workloadName}-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="border-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Streaming
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={retry}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFollow((f) => !f)}
            className="h-7 px-2 text-xs"
          >
            {follow ? (
              <>
                <Pause className="h-3 w-3 mr-1" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" /> Follow
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLines([])}
            className="h-7 px-2 text-xs"
            disabled={lines.length === 0}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadLogs}
            className="h-7 px-2 text-xs"
            disabled={lines.length === 0}
          >
            <Download className="h-3 w-3 mr-1" /> Download
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="h-[480px] overflow-auto bg-zinc-950 text-zinc-100 font-mono text-xs p-3 leading-relaxed"
        >
          {lines.length === 0 && !error ? (
            <p className="text-zinc-500">Waiting for log lines...</p>
          ) : lines.length === 0 && error ? (
            <p className="text-zinc-500">
              No logs available. {error}
            </p>
          ) : (
            lines.map((l) => (
              <div key={l.id} className="whitespace-pre-wrap break-all">
                {l.message}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
