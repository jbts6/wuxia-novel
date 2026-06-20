import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout, Menu, Breadcrumb, theme } from 'antd';
import {
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

  const isBookRoute = location.pathname.startsWith('/book/');
  const currentBook = books.find(b => b.path === currentBookPath);

  const bookMenuItems = [
    { key: '.', icon: <DashboardOutlined />, label: '概览' },
    { key: 'graph', icon: <TeamOutlined />, label: '人物关系' },
    { key: 'skills', icon: <ThunderboltOutlined />, label: '武功技能' },
    { key: 'characters', icon: <UserOutlined />, label: '所有人物' },
    { key: 'items', icon: <ToolOutlined />, label: '装备道具' },
    { key: 'forces', icon: <EnvironmentOutlined />, label: '势力分布' },
    { key: 'dialogues', icon: <CommentOutlined />, label: '经典对话' },
  ];

  const getSelectedMenuKey = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length <= 3) return '.';
    return parts.slice(3).join('/');
  };

  const getBreadcrumbItems = () => {
    const items = [
      { title: <Link to="/">全库总览</Link> },
    ];
    if (currentBook) {
      const bookBase = `/book/${encodeURIComponent(currentBook.author)}/${encodeURIComponent(currentBook.name)}`;
      items.push({ title: <span>{currentBook.author}</span> });
      items.push({ title: <Link to={bookBase}>{currentBook.name}</Link> });
      const subPath = location.pathname.slice(bookBase.length).replace(/^\//, '');
      if (subPath) {
        const labelMap: Record<string, string> = {
          graph: '人物关系', skills: '武功技能', characters: '所有人物',
          items: '装备道具', forces: '势力分布', dialogues: '经典对话',
        };
        items.push({ title: <span>{labelMap[subPath] || subPath}</span> });
      }
    }
    return items;
  };

  if (!isBookRoute) {
    return (
      <Layout className="app-shell app-shell-global">
        <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
          <Content className="app-global-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        breakpoint="lg"
        collapsedWidth="80"
        width={220}
        style={{ overflow: 'auto' }}
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
            {currentBook?.name || '武侠图志'}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedMenuKey()]}
          items={bookMenuItems}
          onClick={({ key }) => {
            const bookBase = `/book/${encodeURIComponent(currentBook!.author)}/${encodeURIComponent(currentBook!.name)}`;
            navigate(key === '.' ? bookBase : `${bookBase}/${key}`);
          }}
          style={{ borderRight: 0, background: 'transparent', padding: '8px 0' }}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
        <Header
          className="app-header"
          style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <BookSelector />
            <Breadcrumb items={getBreadcrumbItems()} />
          </div>
          <GlobalSearch />
        </Header>
        <Content
          className="app-content-panel"
          style={{
            flex: 1,
            margin: '20px 18px',
            padding: 24,
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
