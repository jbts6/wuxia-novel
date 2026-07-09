import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  Users,
  Swords,
  Gem,
  Building2,
  MapPin,
  MessageSquare,
  BookMarked,
  LayoutDashboard,
} from 'lucide-react';
import { useBookData } from '../../hooks/useBookData';

const navItems = [
  { path: 'overview', label: '概览', icon: LayoutDashboard },
  { path: 'characters', label: '人物志', icon: Users },
  { path: 'skills', label: '武功阁', icon: Swords },
  { path: 'items', label: '百宝录', icon: Gem },
  { path: 'factions', label: '势力录', icon: Building2 },
  { path: 'locations', label: '地点志', icon: MapPin },
  { path: 'chapter-summaries', label: '章回录', icon: BookMarked },
  { path: 'dialogues', label: '对话集', icon: MessageSquare },
];

export function SideNav() {
  const { authorName, bookName } = useBookData();
  const location = useLocation();

  if (!authorName || !bookName) return null;

  const decodedPathname = decodeURIComponent(location.pathname);

  return (
    <aside className="w-48 border-r bg-card">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const fullPath = `/${authorName}/${bookName}/${item.path}`;
          const isActive = decodedPathname === fullPath;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={fullPath}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
