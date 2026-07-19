import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import type { BookExtrasData } from '../types/novel';
import GameMaterials from './GameMaterials';

const BOOK_PATH = '金庸/飞狐外传';
const BOOK_ROUTE = '/金庸/飞狐外传/game-materials';

const entries = [
  {
    material_type: '战斗系统原型' as const,
    source_id: 'skill_1',
    relevance: '高',
    suggested_use: '设计连招系统',
    reason: '招式变化可转为战斗节奏',
  },
  {
    material_type: '经典剧情桥段' as const,
    source_id: 'event_1',
    relevance: '中',
    suggested_use: '设计主线任务',
    reason: '事件具有明确的冲突与结果',
  },
  {
    material_type: '角色原型/彩蛋' as const,
    source_id: 'char_1',
    relevance: '高',
    suggested_use: '设计角色原型',
    reason: '人物关系适合作为彩蛋',
  },
  {
    material_type: '标志性物品' as const,
    source_id: 'item_1',
    relevance: '高',
    suggested_use: '设计关键道具',
    reason: '物品推动剧情',
  },
  {
    material_type: '门派与世界观素材' as const,
    source_id: 'faction_1',
    relevance: '低',
    suggested_use: '设计门派设定',
    reason: '势力构成具有参考价值',
  },
  {
    material_type: '标志性物品' as const,
    source_id: 'missing_source',
    relevance: '低',
    suggested_use: '保留待核对素材',
    reason: '原始引用尚未解析',
  },
];

function setExtras(resource: BookExtrasData['gameMaterials'], options: { loading?: boolean; error?: string | null } = {}) {
  useLibraryStore.setState({
    currentBook: BOOK_PATH,
    extrasCache: {
      [BOOK_PATH]: {
        events: {
          status: 'available',
          data: [{
            id: 'event_1',
            name: '雪山夺刀',
            importance: '高',
            cause: '宝刀现世',
            process: '众人争夺宝刀',
            result: '胡斐暂得宝刀',
            participants: [],
            locations: [],
            source_refs: [],
          }],
        },
        gameMaterials: resource,
      },
    },
    extrasLoading: { [BOOK_PATH]: options.loading === true },
    extrasErrors: { [BOOK_PATH]: options.error ?? null },
  });
}

function renderGameMaterials() {
  return render(
    <MemoryRouter initialEntries={[BOOK_ROUTE]}>
      <Routes>
        <Route path="/:authorName/:bookName/game-materials" element={<GameMaterials />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useNovelStore.getState().clearData();
  useNovelStore.getState().loadData({
    characters: [{
      id: 'char_1',
      name: '胡斐',
      aliases: [],
      identities: ['侠客'],
      level: '核心',
      rank: null,
      description: '胡家后人。',
      factions: ['faction_1'],
      skills: ['skill_1'],
    }],
    skills: [{
      id: 'skill_1',
      name: '胡家刀法',
      aliases: [],
      types: ['刀法'],
      factions: ['faction_1'],
      rank: null,
      description: '胡家世传刀法。',
      techniques: [],
    }],
    items: [{ id: 'item_1', name: '冷月宝刀', aliases: [], type: '神兵', description: null }],
    factions: [{ id: 'faction_1', name: '天山派', aliases: [], type: '门派', description: null }],
    chapter_summaries: [],
  });
  setExtras({ status: 'available', data: { schema_version: 1, entries } });
});

describe('游戏素材页面', () => {
  it('展示五类素材、推荐信息和来源解析状态', () => {
    renderGameMaterials();

    expect(screen.getByText('6 条游戏素材')).toBeInTheDocument();
    const cards = screen.getAllByTestId('game-material-card');
    expect(within(cards[0]).getByText('胡家刀法')).toBeInTheDocument();
    expect(within(cards[0]).getByText('战斗系统原型')).toBeInTheDocument();
    expect(within(cards[4]).getByText('天山派')).toBeInTheDocument();
    expect(within(cards[4]).getByText('门派与世界观素材')).toBeInTheDocument();
    expect(screen.getByText('设计连招系统')).toBeInTheDocument();
    expect(screen.getByText('招式变化可转为战斗节奏')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开来源：胡家刀法' })).toHaveAttribute(
      'href',
      '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/skills?detail=skill_1',
    );
    expect(screen.getByRole('link', { name: '打开来源：胡家刀法' })).toHaveTextContent('打开来源');
    expect(screen.getByRole('button', { name: '来源不可解析' })).toBeDisabled();
    expect(within(cards[5]).getByText('来源不可解析', { selector: '[data-slot="card-title"]' })).toBeInTheDocument();
  });

  it('可以组合筛选素材类型和重要度', () => {
    renderGameMaterials();

    fireEvent.change(screen.getByRole('combobox', { name: '素材类型' }), {
      target: { value: '标志性物品' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '重要度' }), {
      target: { value: '高' },
    });

    expect(screen.getAllByTestId('game-material-card')).toHaveLength(1);
    expect(screen.getByText('设计关键道具')).toBeInTheDocument();
  });

  it('合法空报告显示 0 条素材', () => {
    setExtras({ status: 'available', data: { schema_version: 1, entries: [] } });
    renderGameMaterials();
    expect(screen.getByText('0 条游戏素材')).toBeInTheDocument();
  });

  it('报告缺失时显示尚未生成', () => {
    setExtras({ status: 'missing', data: null });
    renderGameMaterials();
    expect(screen.getByText('本书尚未生成游戏素材')).toBeInTheDocument();
  });

  it('损坏报告显示读取错误', () => {
    setExtras({ status: 'invalid', data: null, error: 'game_materials.json 响应结构无效' });
    renderGameMaterials();
    expect(screen.getByText(/game_materials\.json 响应结构无效/)).toBeInTheDocument();
  });

  it('接口不可用时显示独立错误', () => {
    setExtras({ status: 'missing', data: null }, { error: '扩展接口不可用' });
    renderGameMaterials();
    expect(screen.getByText(/扩展接口不可用/)).toBeInTheDocument();
  });

  it('加载中显示独立加载状态', () => {
    setExtras({ status: 'available', data: { schema_version: 1, entries: [] } }, { loading: true });
    renderGameMaterials();
    expect(screen.getByText('正在加载游戏素材')).toBeInTheDocument();
  });
});
