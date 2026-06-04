import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  TeamOutlined,
  NodeIndexOutlined,
  ThunderboltOutlined,
  CommentOutlined,
  DashboardOutlined,
  UserOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useBookStore } from '../../stores/useBookStore';
import BookSelector from '../common/BookSelector';
import GlobalSearch from '../common/GlobalSearch';

const { Header, Sider, Content } = Layout;

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBookPath } = useBookStore();
  const books = useBookStore(state => state.books);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const currentBook = books.find(b => b.path === currentBookPath);
  const bookTitle = currentBook ? currentBook.name : '武侠小说可视化';

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '概览',
    },
    {
      key: '/graph',
      icon: <TeamOutlined />,
      label: '人物关系',
    },
    {
      key: '/timeline',
      icon: <NodeIndexOutlined />,
      label: '事件时间线',
    },
    {
      key: '/skills',
      icon: <ThunderboltOutlined />,
      label: '武功技能',
    },
    {
      key: '/characters',
      icon: <UserOutlined />,
      label: '所有人物',
    },
    {
      key: '/items',
      icon: <ToolOutlined />,
      label: '装备道具',
    },
    {
      key: '/dialogues',
      icon: <CommentOutlined />,
      label: '经典对话',
    },
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="80"
        style={{ background: colorBgContainer, overflow: 'auto' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{bookTitle}</h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BookSelector />
            <h1 style={{ margin: 0, fontSize: 18 }}>武侠小说可视化</h1>
          </div>
          <GlobalSearch />
        </Header>
        <Content
          style={{
            flex: 1,
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
