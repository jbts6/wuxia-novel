import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  AppstoreOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  CommentOutlined,
  DashboardOutlined,
  UserOutlined,
  ToolOutlined,
  EnvironmentOutlined,
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
    token: { borderRadiusLG },
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
      key: '/library',
      icon: <AppstoreOutlined />,
      label: '全库总览',
    },
    {
      key: '/graph',
      icon: <TeamOutlined />,
      label: '人物关系',
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
      key: '/forces',
      icon: <EnvironmentOutlined />,
      label: '势力分布',
    },
    {
      key: '/dialogues',
      icon: <CommentOutlined />,
      label: '经典对话',
    },
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', background: 'transparent' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="80"
        width={220}
        style={{ overflow: 'auto', borderRight: '1px solid var(--ink-hairline)' }}
      >
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px',
            borderBottom: '1px solid var(--ink-hairline)',
          }}
        >
          <span className="ink-seal" style={{ width: 32, height: 32, fontSize: 16 }}>侠</span>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontFamily: 'var(--font-serif)',
              color: 'var(--ink-black)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bookTitle}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, background: 'transparent', padding: '8px 0' }}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
        <Header
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--ink-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BookSelector />
            <h1 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)', color: 'var(--ink-black)' }}>
              武侠图志
            </h1>
          </div>
          <GlobalSearch />
        </Header>
        <Content
          style={{
            flex: 1,
            margin: '20px 18px',
            padding: 24,
            background: 'var(--paper-raised)',
            border: '1px solid var(--ink-hairline)',
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
