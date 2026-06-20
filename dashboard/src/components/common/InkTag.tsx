/**
 * InkTag — 水墨标签组件
 * 
 * 基于 Antd Tag 封装，统一应用水墨主题样式。
 * 支持语义色（attack/defense/special 等）和自定义色。
 */
import React from 'react';
import { Tag } from 'antd';
import type { TagProps } from 'antd/es/tag';
import { CINNABAR, PIGMENT, INK } from '../../theme/palette';

/** 语义色映射（用于 technique type、rank 等） */
const SEMANTIC_COLORS: Record<string, { color: string; wash: string }> = {
  // 技术类型
  attack: { color: CINNABAR.base, wash: CINNABAR.wash },
  defense: { color: PIGMENT.indigo, wash: PIGMENT.indigoWash },
  special: { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  feint: { color: PIGMENT.violet, wash: PIGMENT.violetWash },
  buff: { color: PIGMENT.cyan, wash: PIGMENT.cyanWash },
  debuff: { color: INK.faint, wash: PIGMENT.stoneWash },
  // 中文标签
  '攻击': { color: CINNABAR.base, wash: CINNABAR.wash },
  '防御': { color: PIGMENT.indigo, wash: PIGMENT.indigoWash },
  '特殊': { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  '虚招': { color: PIGMENT.violet, wash: PIGMENT.violetWash },
  '增益': { color: PIGMENT.cyan, wash: PIGMENT.cyanWash },
  '减益': { color: INK.faint, wash: PIGMENT.stoneWash },
  // 角色类型
  protagonist: { color: CINNABAR.base, wash: CINNABAR.wash },
  companion: { color: PIGMENT.celadon, wash: PIGMENT.celadonWash },
  npc: { color: PIGMENT.stone, wash: PIGMENT.stoneWash },
  villain: { color: INK.black, wash: PIGMENT.stoneWash },
  // 武学境界
  '返璞归真': { color: CINNABAR.deep, wash: CINNABAR.wash },
  '登峰造极': { color: CINNABAR.base, wash: CINNABAR.wash },
  '出神入化': { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  '炉火纯青': { color: PIGMENT.celadon, wash: PIGMENT.celadonWash },
  '登堂入室': { color: PIGMENT.violet, wash: PIGMENT.violetWash },
  '略有小成': { color: PIGMENT.cyan, wash: PIGMENT.cyanWash },
  '初窥门径': { color: PIGMENT.stone, wash: PIGMENT.stoneWash },
  '平平无奇': { color: INK.faint, wash: PIGMENT.stoneWash },
  // 物品稀有度
  '绝世神兵': { color: CINNABAR.base, wash: CINNABAR.wash },
  '稀世珍品': { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  '上乘佳品': { color: PIGMENT.indigo, wash: PIGMENT.indigoWash },
  '寻常凡品': { color: PIGMENT.stone, wash: PIGMENT.stoneWash },
  // Antd 预设色名
  red: { color: CINNABAR.base, wash: CINNABAR.wash },
  volcano: { color: CINNABAR.soft, wash: CINNABAR.wash },
  orange: { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  gold: { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  yellow: { color: PIGMENT.ochre, wash: PIGMENT.ochreWash },
  lime: { color: PIGMENT.celadon, wash: PIGMENT.celadonWash },
  green: { color: PIGMENT.celadon, wash: PIGMENT.celadonWash },
  cyan: { color: PIGMENT.cyan, wash: PIGMENT.cyanWash },
  blue: { color: PIGMENT.indigo, wash: PIGMENT.indigoWash },
  geekblue: { color: PIGMENT.indigo, wash: PIGMENT.indigoWash },
  purple: { color: PIGMENT.violet, wash: PIGMENT.violetWash },
  magenta: { color: CINNABAR.soft, wash: CINNABAR.wash },
  default: { color: PIGMENT.stone, wash: PIGMENT.stoneWash },
};

export interface InkTagProps extends Omit<TagProps, 'color'> {
  /** 语义色 key 或自定义颜色 */
  color?: string;
  /** 是否使用半透明底色（默认 true） */
  wash?: boolean;
}

const InkTag: React.FC<InkTagProps> = ({ 
  color, 
  wash = true, 
  style, 
  children, 
  ...props 
}) => {
  // 查找语义色
  const semantic = color ? SEMANTIC_COLORS[color] : undefined;
  const resolvedColor = semantic?.color || color || PIGMENT.stone;
  const resolvedWash = semantic?.wash;

  return (
    <Tag
      {...props}
      style={{
        color: resolvedColor,
        borderColor: resolvedColor,
        background: wash && resolvedWash ? resolvedWash : 'transparent',
        fontFamily: 'var(--font-sans)',
        borderRadius: 2,
        borderStyle: 'solid',
        marginInlineEnd: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

export default InkTag;
