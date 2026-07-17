import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/layout/AppLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { AppLayout: () => <Outlet /> };
});

vi.mock('./pages/Locations', () => ({ default: () => <div>地点志路由已加载</div> }));
vi.mock('./pages/Dialogues', () => ({ default: () => <div>对话集路由已加载</div> }));
vi.mock('./pages/GameMaterials', () => ({ default: () => <div>游戏素材路由已加载</div> }));
vi.mock('./pages/ReviewPage', () => ({ default: () => <div>数据审核路由已加载</div> }));

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('App 书籍路由', () => {
  it.each([
    ['地点志', 'locations', '地点志路由已加载'],
    ['对话集', 'dialogues', '对话集路由已加载'],
    ['游戏素材', 'game-materials', '游戏素材路由已加载'],
  ])('不再注册%s路由', (_label, path, marker) => {
    window.history.pushState({}, '', `/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/${path}`);

    render(<App />);

    expect(screen.queryByText(marker)).not.toBeInTheDocument();
  });

  it('保留数据审核路由', () => {
    window.history.pushState({}, '', '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/review');

    render(<App />);

    expect(screen.getByText('数据审核路由已加载')).toBeInTheDocument();
  });
});
