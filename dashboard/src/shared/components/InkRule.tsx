import React from 'react';

interface InkRuleProps {
  className?: string;
  style?: React.CSSProperties;
  wide?: boolean;
}

const InkRule: React.FC<InkRuleProps> = ({ className, style, wide }) => (
  <span
    className={`ink-rule ${className ?? ''}`}
    style={
      wide
        ? { width: 72, height: 2, background: 'var(--ink-hairline)', ...style }
        : style
    }
    aria-hidden="true"
  />
);

export default InkRule;
