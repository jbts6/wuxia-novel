import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, icon, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-serif">{value}</div>
      </CardContent>
    </Card>
  );
}
