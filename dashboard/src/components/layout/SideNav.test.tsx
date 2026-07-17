import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SideNav } from './SideNav';

describe('SideNav 书籍入口', () => {
  it('只显示四类实体、章节摘要和数据审核入口', () => {
    render(
      <MemoryRouter initialEntries={['/金庸/飞狐外传/overview']}>
        <Routes>
          <Route path="/:authorName/:bookName/*" element={<SideNav />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '数据审核' })).toHaveAttribute('href', '/金庸/飞狐外传/review');
    expect(screen.getByRole('link', { name: '人物志' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '武功阁' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '百宝录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '势力录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '章回录' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '地点志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '对话集' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '游戏素材' })).not.toBeInTheDocument();
    expect(screen.queryByText('创作应用')).not.toBeInTheDocument();
  });
});
