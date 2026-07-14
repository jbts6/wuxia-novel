import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SideNav } from './SideNav';

describe('SideNav 创作应用入口', () => {
  it('为任意书籍始终显示游戏素材入口', () => {
    render(
      <MemoryRouter initialEntries={['/金庸/飞狐外传/overview']}>
        <Routes>
          <Route path="/:authorName/:bookName/*" element={<SideNav />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('创作应用')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '游戏素材' })).toHaveAttribute(
      'href',
      '/金庸/飞狐外传/game-materials',
    );
  });
});
