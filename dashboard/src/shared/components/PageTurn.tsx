import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTurnProps {
  children: ReactNode;
  className?: string;
}

const PageTurn: React.FC<PageTurnProps> = ({ children, className }) => {
  const location = useLocation();
  const [key, setKey] = useState(0);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setKey(k => k + 1);
    }
  }, [location.pathname]);

  return (
    <div key={key} className={`page-turn ${className ?? ''}`}>
      {children}
    </div>
  );
};

export default PageTurn;
