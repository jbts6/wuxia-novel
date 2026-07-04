import React from 'react';

type Size = 'huge' | 'large' | 'medium' | 'small';

interface VerticalTitleProps {
  children: React.ReactNode;
  size?: Size;
  cinnabar?: boolean;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'span';
}

const sizeClass: Record<Size, string> = {
  huge: 'vertical-title--huge',
  large: 'vertical-title--large',
  medium: '',
  small: '',
};

const fontSize: Record<Size, string | undefined> = {
  huge: undefined,
  large: undefined,
  medium: '16px',
  small: '13px',
};

const VerticalTitle: React.FC<VerticalTitleProps> = ({
  children,
  size = 'medium',
  cinnabar,
  className,
  as: As = 'h2',
}) => {
  const cls = [
    'vertical-title',
    sizeClass[size],
    cinnabar ? 'vertical-title--cinnabar' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle: React.CSSProperties | undefined = fontSize[size]
    ? { fontSize: fontSize[size] }
    : undefined;

  return (
    <As className={cls} style={inlineStyle}>
      {children}
    </As>
  );
};

export default VerticalTitle;
