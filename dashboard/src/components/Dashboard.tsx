import React from 'react';
import { Card, Row, Col, Statistic, Tag, Typography } from 'antd';
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

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const {
    characters,
    skills,
    items,
    locations,
    factions,
    dialogues,
    showDetail,
  } = useNovelStore();

  const { currentBookPath, books } = useBookStore();
  const currentBook = books.find(b => b.path === currentBookPath);
  const bookName = currentBook?.name || '数据概览';

  const stats = [
    { title: '角色', value: characters.length, icon: <UserOutlined />, color: '#1890ff' },
    { title: '技能', value: skills.length, icon: <ThunderboltOutlined />, color: '#52c41a' },
    { title: '物品', value: items.length, icon: <ToolOutlined />, color: '#faad14' },
    { title: '地点', value: locations.length, icon: <EnvironmentOutlined />, color: '#722ed1' },
    { title: '势力', value: factions.length, icon: <TeamOutlined />, color: '#13c2c2' },
    { title: '对话', value: dialogues.length, icon: <CommentOutlined />, color: '#722ed1' },
  ];

  const protagonistRoles = ['protagonist', '主角', '侠之大者'];
  const villainRoles = ['villain', '反派'];

  const mainCharacters = characters
    .filter((c: any) => protagonistRoles.includes(c.role) || villainRoles.includes(c.role))
    .slice(0, 6);

  const topSkills = skills
    .filter((s: any) => s.rank === '登峰造极' || s.rank === '返璞归真')
    .slice(0, 6);

  const legendaryItems = items
    .filter((i: any) => i.rarity === '绝世神兵')
    .slice(0, 6);

  const renderListItem = (
    items: any[],
    onClick: (item: any) => void,
    tagColor: (item: any) => string,
    tagText: (item: any) => string
  ) => (
    <div>
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onClick(item)}
          style={{
            padding: '12px 0',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            <Tag color={tagColor(item)}>{tagText(item)}</Tag>
          </div>
          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
            {item.one_line}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <Title level={2}>{bookName} · 数据概览</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat) => (
          <Col xs={12} sm={8} md={6} lg={4} key={stat.title}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={React.cloneElement(stat.icon, { style: { color: stat.color } })}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}>
          <Card title="主要角色">
            {renderListItem(
              mainCharacters,
              (c) => showDetail('character', c.id),
              (c) => (protagonistRoles.includes(c.role) ? 'blue' : 'red'),
              (c) => (protagonistRoles.includes(c.role) ? '主角' : '反派')
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card title="顶级武功">
            {renderListItem(
              topSkills,
              (s) => showDetail('skill', s.id),
              () => 'orange',
              (s) => s.rank
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card title="绝世神兵">
            {renderListItem(
              legendaryItems,
              (i) => showDetail('item', i.id),
              () => 'red',
              (i) => i.rarity
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
