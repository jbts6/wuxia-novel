import React from 'react';
import { Row, Col } from 'antd';
import {
  UserOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import { useNovelStore } from '../stores/useNovelStore';
import { useBookStore } from '../stores/useBookStore';
import { ENTITY_COLORS, CINNABAR, PIGMENT, INK } from '../theme/palette';
import { getRankColor } from '../utils/skillDisplay';
import InkTag from './common/InkTag';

const RANK_ORDER = ['返璞归真', '登峰造极', '出神入化', '炉火纯青', '登堂入室', '略有小成', '初窥门径', '平平无奇'];
const RARITY_ORDER = ['绝世神兵', '稀世珍品', '上乘佳品', '寻常凡品'];

const Dashboard: React.FC = () => {
  const characters = useNovelStore((s) => s.characters);
  const skills = useNovelStore((s) => s.skills);
  const items = useNovelStore((s) => s.items);
  const locations = useNovelStore((s) => s.locations);
  const factions = useNovelStore((s) => s.factions);
  const dialogues = useNovelStore((s) => s.dialogues);
  const showDetail = useNovelStore((s) => s.showDetail);

  const { currentBookPath, books } = useBookStore();
  const currentBook = books.find(b => b.path === currentBookPath);
  const bookName = currentBook?.name || '数据概览';

  const stats = [
    { title: '角色', value: characters.length, icon: <UserOutlined />, color: ENTITY_COLORS.character },
    { title: '武功', value: skills.length, icon: <ThunderboltOutlined />, color: ENTITY_COLORS.skill },
    { title: '物品', value: items.length, icon: <ToolOutlined />, color: ENTITY_COLORS.item },
    { title: '地点', value: locations.length, icon: <EnvironmentOutlined />, color: ENTITY_COLORS.location },
    { title: '势力', value: factions.length, icon: <TeamOutlined />, color: ENTITY_COLORS.faction },
    { title: '对话', value: dialogues.length, icon: <CommentOutlined />, color: PIGMENT.indigo },
  ];

  const protagonistRoles = ['protagonist', '主角', '侠之大者'];
  const villainRoles = ['villain', '反派'];

  const mainCharacters = characters
    .filter((c) => protagonistRoles.includes(c.role) || villainRoles.includes(c.role))
    .slice(0, 6);

  const topSkills = skills
    .filter((s) => s.mastery_rank === '登峰造极' || s.mastery_rank === '返璞归真')
    .sort((a, b) => RANK_ORDER.indexOf(a.mastery_rank) - RANK_ORDER.indexOf(b.mastery_rank))
    .slice(0, 6);

  const legendaryItems = items
    .filter((i) => i.rarity_tier === '绝世神兵')
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity_tier) - RARITY_ORDER.indexOf(b.rarity_tier))
    .slice(0, 6);

  return (
    <div>
      {/* 标题区 */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            color: INK.black,
            letterSpacing: '0.04em',
          }}
        >
          {bookName}
          <span style={{ fontSize: 16, color: INK.faint, marginLeft: 12, fontFamily: 'var(--font-sans)' }}>
            图志总览
          </span>
        </h1>
        <div className="ink-rule" />
      </div>

      {/* 统计卡 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        {stats.map((stat) => (
          <Col xs={12} sm={8} md={6} lg={4} key={stat.title}>
            <div
              className="ink-card"
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <span
                className="ink-seal"
                style={{ background: stat.color, width: 38, height: 38, fontSize: 18 }}
              >
                {React.cloneElement(stat.icon, { style: { fontSize: 18 } })}
              </span>
              <div>
                <div style={{ fontSize: 13, color: INK.secondary }}>{stat.title}</div>
                <div
                  style={{
                    fontSize: 26,
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    color: INK.black,
                    lineHeight: 1.1,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 三栏精选 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}>
          <SectionPanel title="主要人物" accent={ENTITY_COLORS.character}>
            {mainCharacters.map((c) => (
              <ListRow
                key={c.id}
                name={c.name}
                desc={c.one_line}
                tag={protagonistRoles.includes(c.role) ? '主角' : '反派'}
                tagColor={protagonistRoles.includes(c.role) ? CINNABAR.base : INK.black}
                onClick={() => showDetail('character', c.id)}
              />
            ))}
          </SectionPanel>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <SectionPanel title="顶级武功" accent={ENTITY_COLORS.skill}>
            {topSkills.map((s) => (
              <ListRow
                key={s.id}
                name={s.name}
                desc={s.one_line}
                tag={s.mastery_rank}
                tagColor={getRankColor(s.mastery_rank)}
                onClick={() => showDetail('skill', s.id)}
              />
            ))}
          </SectionPanel>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <SectionPanel title="绝世神兵" accent={ENTITY_COLORS.item}>
            {legendaryItems.map((i) => (
              <ListRow
                key={i.id}
                name={i.name}
                desc={i.one_line}
                tag={i.rarity_tier}
                tagColor={CINNABAR.base}
                onClick={() => showDetail('item', i.id)}
              />
            ))}
          </SectionPanel>
        </Col>
      </Row>
    </div>
  );
};

const SectionPanel: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({
  title,
  accent,
  children,
}) => (
  <div
    className="ink-card"
    style={{ height: '100%', padding: 0, overflow: 'hidden' }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        borderBottom: '1px solid var(--ink-hairline)',
      }}
    >
      <span style={{ width: 4, height: 16, background: accent, borderRadius: 2 }} />
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: INK.black }}>{title}</span>
    </div>
    <div style={{ padding: '4px 18px 8px' }}>{children}</div>
  </div>
);

const ListRow: React.FC<{
  name: string;
  desc: string;
  tag: string;
  tagColor: string;
  onClick: () => void;
}> = ({ name, desc, tag, tagColor, onClick }) => (
  <div
    onClick={onClick}
    style={{ padding: '11px 0', borderBottom: '1px solid var(--ink-hairline)', cursor: 'pointer' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, color: INK.black }}>{name}</span>
      <InkTag color={tagColor} wash={false}>{tag}</InkTag>
    </div>
    <div style={{ color: INK.secondary, fontSize: 12, marginTop: 4 }}>{desc}</div>
  </div>
);

export default Dashboard;
