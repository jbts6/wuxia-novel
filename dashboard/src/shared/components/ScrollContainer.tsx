import React, { type ReactNode } from 'react';

interface ScrollContainerProps {
  children: ReactNode;
  className?: string;
  paperClassName?: string;
  header?: ReactNode;
  'aria-label'?: string;
}

const ScrollContainer: React.FC<ScrollContainerProps> = ({
  children,
  className,
  paperClassName,
  header,
  'aria-label': ariaLabel,
}) => (
  <div
    className={`scroll-shell ${className ?? ''}`}
    role="region"
    aria-label={ariaLabel}
  >
    <div className="scroll-roller scroll-roller-top" aria-hidden="true" />
    {header && <div className="scroll-header">{header}</div>}
    <div className={`scroll-paper ${paperClassName ?? ''}`}>{children}</div>
    <div className="scroll-roller scroll-roller-bottom" aria-hidden="true" />
  </div>
);

export default ScrollContainer;
