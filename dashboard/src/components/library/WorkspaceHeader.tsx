import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, LibraryBig } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';
import { cn } from '../../lib/utils';

interface WorkspaceHeaderProps {
  active: 'manage' | 'browse';
  actions?: ReactNode;
}

const navItems = [
  { key: 'manage' as const, label: '知识管理', path: '/', icon: LibraryBig },
  { key: 'browse' as const, label: '知识浏览', path: '/browse', icon: BookOpenText },
];

export function WorkspaceHeader({ active, actions }: WorkspaceHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-card px-6">
      <Link to="/" className="mr-8 font-serif text-lg font-semibold text-foreground">
        武侠知识库工作台
      </Link>
      <nav className="flex h-full items-center" aria-label="工作台主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                'flex h-full items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors',
                active === item.key
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
