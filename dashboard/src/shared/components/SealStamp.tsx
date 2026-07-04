import React from 'react';

type Shape = 'square' | 'circle' | 'tall' | 'huge' | 'sm';

interface SealStampProps {
  text: string;
  shape?: Shape;
  color?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

const shapeClass: Record<Shape, string> = {
  square: 'seal-stamp--square',
  circle: 'seal-stamp--circle',
  tall: 'seal-stamp--tall',
  huge: 'seal-stamp--huge',
  sm: 'seal-stamp--sm',
};

const SealStamp: React.FC<SealStampProps> = ({
  text,
  shape = 'square',
  color,
  title,
  className,
  style,
  onClick,
}) => {
  const customStyle: React.CSSProperties | undefined =
    color ? { ...style, ['--seal-color' as string]: color } : style;

  return (
    <span
      className={`seal-stamp ${shapeClass[shape]} ${className ?? ''}`}
      style={customStyle}
      title={title ?? text}
      aria-label={title ?? text}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {text}
    </span>
  );
};

export default SealStamp;
