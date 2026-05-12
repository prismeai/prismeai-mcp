import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2Icon } from 'lucide-react';

import type { AppProps, SDK } from '@/types';

function apiHeaders(sdk: SDK): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sdk.token) h['Authorization'] = 'Bearer ' + sdk.token;
  if (sdk._csrfToken) h['x-prismeai-csrf-token'] = sdk._csrfToken;
  return h;
}

export default function App({ sdk, user, workspace }: AppProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      setLoading(true);
      try {
        const url = `${sdk.host}/workspaces/slug:${workspace.slug}/webhooks/v1/status`;
        const res = await fetch(url, {
          method: 'POST',
          headers: apiHeaders(sdk),
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!cancelled) setStatus(data?.status ?? 'unknown');
      } catch (err) {
        if (!cancelled) setStatus('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    ping();
    return () => {
      cancelled = true;
    };
  }, [sdk, workspace.slug]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{{workspace_name}}</CardTitle>
          <CardDescription>
            Bonjour {user.email}, bienvenue dans {workspace.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Backend status:{' '}
            {loading ? (
              <Loader2Icon className="inline h-4 w-4 animate-spin" />
            ) : (
              <span className="font-mono">{status || '—'}</span>
            )}
          </div>
          <Button onClick={() => setStatus('')}>Reset</Button>
        </CardContent>
      </Card>
    </div>
  );
}
