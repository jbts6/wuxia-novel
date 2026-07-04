import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ScrollContainer, PageTurn, BreadcrumbTrail } from '../../shared/components';

const ScrollLayout: React.FC = () => {
  const { pathname } = useLocation();
  const isRoot = pathname === '/' || pathname === '';
  const header = isRoot ? null : <BreadcrumbTrail />;

  return (
    <ScrollContainer aria-label="武侠卷宗" header={header}>
      <PageTurn>
        <Outlet />
      </PageTurn>
    </ScrollContainer>
  );
};

export default ScrollLayout;
