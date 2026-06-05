import React from 'react';

interface SimpleListProps<T> {
  dataSource: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function SimpleList<T>({ dataSource, renderItem, className }: SimpleListProps<T>) {
  return (
    <div className={className}>
      {dataSource.map((item, index) => (
        <div key={index}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
