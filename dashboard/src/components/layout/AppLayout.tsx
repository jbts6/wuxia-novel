import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <SideNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
