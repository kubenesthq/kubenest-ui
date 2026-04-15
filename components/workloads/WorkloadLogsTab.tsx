'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, Trash2, Loader2 } from 'lucide-react';
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
const SSE_BASE =
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

  useEffect(() => {
    if (!token || !workloadId) return;
    const url = `${SSE_BASE}/api/v1/workloads/${workloadId}/logs/stream?tail_lines=200&token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const append = (message: string) => {
      counterRef.current += 1;
      setLines((prev) => {
        const next = [
          ...prev,
          { id: counterRef.current, ts: new Date().toISOString(), message },
        ];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    };

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('heartbeat', () => {});
    es.addEventListener('log', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        append(data.line ?? data.message ?? e.data);
      } catch {
        append(e.data);
      }
    });
    es.addEventListener('closed', () => setConnected(false));
    es.onmessage = (e: MessageEvent) => append(e.data);
    es.onerror = () => {
      setConnected(false);
      setError('Log stream disconnected');
    };

    return () => es.close();
  }, [workloadId, token]);

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, follow]);

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
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting...
            </span>
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
        <div className="flex items-center gap-1">
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
          {lines.length === 0 ? (
            <p className="text-zinc-500">Waiting for log lines...</p>
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
