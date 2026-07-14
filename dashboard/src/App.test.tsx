import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/layout/AppLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { AppLayout: () => <Outlet /> };
});

vi.mock('./pages/GameMaterials', () => ({
  default: () => <div>游戏素材路由已加载</div>,
}));

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('App 游戏素材路由', () => {
  it('渲染书籍下的游戏素材页面', () => {
    window.history.pushState({}, '', '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/game-materials');

    render(<App />);

    expect(screen.getByText('游戏素材路由已加载')).toBeInTheDocument();
  });
});
