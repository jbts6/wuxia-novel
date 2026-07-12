import { Outlet } from 'react-router-dom';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { useBookData } from '../../hooks/useBookData';

export function AppLayout() {
  const { currentBook, isLoading, error } = useBookData();

  return (
    <div className="flex h-screen overflow-hidden">
      <SideNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              正在加载知识库
            </div>
          ) : error || !currentBook ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md border-l-2 border-destructive pl-4">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  无法打开这本书
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{error ?? '书籍未出现在可浏览目录中。'}</p>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
