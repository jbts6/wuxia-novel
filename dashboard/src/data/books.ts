import type { BookMeta } from '../types/novel';

// 使用路径别名导入数据
import * as 天龙八部 from '@data/天龙八部';
import * as 神雕侠侣 from '@data/神雕侠侣';
import * as 碧血剑 from '@data/碧血剑';
import * as 射雕英雄传 from '@data/射雕英雄传';
import * as 鸳鸯刀 from '@data/鸳鸯刀';

export const books: BookMeta[] = [
  {
    path: '金庸/天龙八部',
    name: '天龙八部',
    author: '金庸',
    data: 天龙八部 as unknown as BookMeta['data'],
  },
  {
    path: '金庸/神雕侠侣',
    name: '神雕侠侣',
    author: '金庸',
    data: 神雕侠侣 as unknown as BookMeta['data'],
  },
  {
    path: '金庸/碧血剑',
    name: '碧血剑',
    author: '金庸',
    data: 碧血剑 as unknown as BookMeta['data'],
  },
  {
    path: '金庸/射雕英雄传',
    name: '射雕英雄传',
    author: '金庸',
    data: 射雕英雄传 as unknown as BookMeta['data'],
  },
  {
    path: '金庸/鸳鸯刀',
    name: '鸳鸯刀',
    author: '金庸',
    data: 鸳鸯刀 as unknown as BookMeta['data'],
  },
];
