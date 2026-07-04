import React, { type ReactNode } from 'react';
import { Drawer } from 'antd';
import { SealStamp, VerticalTitle, InkRule } from './index';

interface ScrollDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  seal: string;
  sealShape?: 'square' | 'circle' | 'tall';
  subtitle?: string;
  children: ReactNode;
  extra?: ReactNode;
  width?: number | string;
}

const ScrollDrawer: React.FC<ScrollDrawerProps> = ({
  open,
  onClose,
  title,
  seal,
  sealShape = 'square',
  subtitle,
  children,
  extra,
  width = 560,
}) => {
  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 16,
        padding: '4px 0 8px',
      }}
    >
      <SealStamp text={seal} shape={sealShape} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <VerticalTitle size="large" as="div">
          {title}
        </VerticalTitle>
        {subtitle && (
          <p
            style={{
              margin: '6px 0 0',
              color: 'var(--ink-secondary)',
              fontFamily: 'var(--font-serif)',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            {subtitle}
          </p>
        )}
        <InkRule />
      </div>
      {extra}
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      title={header}
      styles={{
        wrapper: { width: typeof width === 'number' ? `${width}px` : width },
        header: {
          borderBottom: '1px solid var(--ink-hairline)',
          padding: '14px 24px 0',
        },
        body: {
          padding: '20px 28px 28px',
          background: 'var(--paper-base)',
          overflow: 'auto',
        },
      }}
      motion={{
        motionName: 'scroll-drawer-motion',
        motionAppear: true,
      }}
    >
      {children}
    </Drawer>
  );
};

export default ScrollDrawer;
