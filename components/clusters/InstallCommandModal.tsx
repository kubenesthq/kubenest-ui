'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface InstallCommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string;
  clusterName: string;
}

export function InstallCommandModal({
  open,
  onOpenChange,
  command,
  clusterName,
}: InstallCommandModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Install Kubenest Operator</DialogTitle>
          <DialogDescription>
            Run the following command in your cluster to install the Kubenest operator for{' '}
            <strong>{clusterName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <pre className="rounded-lg bg-muted p-4 pr-12 text-sm overflow-x-auto">
              <code>{command}</code>
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4 text-sm">
            <p className="font-semibold mb-2">Next Steps:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Copy the command above</li>
              <li>Run it in your Kubernetes cluster with kubectl access</li>
              <li>Wait for the operator to connect (may take 1-2 minutes)</li>
              <li>The cluster status will update to &quot;Connected&quot; once ready</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
