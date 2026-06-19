import type { ThemeConfig } from 'antd';
import { PAPER, INK, CINNABAR } from './palette';

// 水墨宣纸主题 —— 注入 Antd ConfigProvider
const SERIF = '"Songti SC", "Noto Serif SC", "Source Han Serif SC", "STSong", "SimSun", serif';
const SANS = '"PingFang SC", "Noto Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const FONT_SERIF = SERIF;
export const FONT_SANS = SANS;

export const inkTheme: ThemeConfig = {
  token: {
    colorPrimary: CINNABAR.base,
    colorInfo: CINNABAR.base,
    colorSuccess: '#5e7a54',
    colorWarning: '#b8863b',
    colorError: CINNABAR.deep,
    colorLink: CINNABAR.base,
    colorLinkHover: CINNABAR.soft,

    colorText: INK.body,
    colorTextHeading: INK.black,
    colorTextSecondary: INK.secondary,
    colorTextTertiary: INK.faint,
    colorTextDescription: INK.secondary,

    colorBgBase: PAPER.base,
    colorBgContainer: PAPER.raised,
    colorBgElevated: PAPER.raised,
    colorBgLayout: PAPER.base,
    colorBorder: INK.hairline,
    colorBorderSecondary: INK.hairline,
    colorSplit: INK.hairline,

    borderRadius: 4,
    borderRadiusLG: 6,
    borderRadiusSM: 3,

    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 1.75,

    boxShadow: '0 2px 12px rgba(43, 38, 32, 0.06)',
    boxShadowSecondary: '0 4px 18px rgba(43, 38, 32, 0.08)',
  },
  components: {
    Layout: {
      headerBg: PAPER.raised,
      siderBg: PAPER.raised,
      bodyBg: PAPER.base,
      headerHeight: 60,
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: INK.body,
      itemHoverColor: CINNABAR.base,
      itemHoverBg: CINNABAR.wash,
      itemSelectedColor: CINNABAR.base,
      itemSelectedBg: CINNABAR.wash,
      itemActiveBg: CINNABAR.wash,
      fontSize: 15,
    },
    Card: {
      colorBgContainer: PAPER.raised,
      headerBg: 'transparent',
      headerFontSize: 16,
    },
    Tag: {
      defaultBg: PAPER.sunken,
      defaultColor: INK.secondary,
    },
    Statistic: {
      contentFontSize: 30,
      titleFontSize: 14,
    },
    Drawer: {
      colorBgElevated: PAPER.base,
    },
    Input: {
      colorBgContainer: PAPER.raised,
      activeBorderColor: CINNABAR.base,
      hoverBorderColor: CINNABAR.soft,
    },
    Select: {
      colorBgContainer: PAPER.raised,
    },
    Table: {
      colorBgContainer: PAPER.raised,
      headerBg: PAPER.sunken,
    },
    Pagination: {
      colorPrimary: CINNABAR.base,
    },
    Tabs: {
      inkBarColor: CINNABAR.base,
      itemSelectedColor: CINNABAR.base,
      itemHoverColor: CINNABAR.soft,
      titleFontSize: 15,
    },
    Breadcrumb: {
      linkColor: INK.secondary,
      linkHoverColor: CINNABAR.base,
      lastItemColor: INK.black,
    },
  },
};
