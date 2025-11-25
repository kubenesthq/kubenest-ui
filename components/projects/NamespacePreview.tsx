'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NamespacePreviewProps {
  projectName: string;
}

function generateNamespace(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .substring(0, 63);
}

export function NamespacePreview({ projectName }: NamespacePreviewProps) {
  const [namespace, setNamespace] = useState('');

  useEffect(() => {
    if (projectName) {
      setNamespace(generateNamespace(projectName));
    } else {
      setNamespace('');
    }
  }, [projectName]);

  if (!namespace) {
    return null;
  }

  return (
    <Card className="bg-muted/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Generated Namespace</CardTitle>
      </CardHeader>
      <CardContent>
        <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
          {namespace}
        </code>
        <p className="text-xs text-muted-foreground mt-2">
          Kubernetes namespace will be auto-generated from project name
        </p>
      </CardContent>
    </Card>
  );
}
