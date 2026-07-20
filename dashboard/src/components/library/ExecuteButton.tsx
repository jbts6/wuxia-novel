import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ExecuteButtonProps {
  bookPath: string;
  actionType: string;
  onSuccess?: () => void;
  className?: string;
}

export function ExecuteButton({ bookPath, actionType, onSuccess, className }: ExecuteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/library/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookPath, actionType }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || '执行失败');
        return;
      }

      if (!result.success) {
        setError(result.error || result.output || '执行失败');
        return;
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        size="sm"
        onClick={handleExecute}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            执行中...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            执行
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
