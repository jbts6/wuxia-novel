import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import type { LibraryBookStatus } from '../types/library';
import type { BookExtrasData, GameMaterial } from '../types/novel';
import BookOverview from './BookOverview';

const BOOK_PATH = '金庸/飞狐外传';

const book: LibraryBookStatus = {
  path: BOOK_PATH,
  author: '金庸',
  name: '飞狐外传',
  generationStage: 'data-produced',
  validationStatus: 'legacy-unproven',
  browseable: true,
  completed: false,
  schemaVersion: null,
  lastUpdatedAt: null,
  scanProgress: {
    'named-inventory': { completed: 0, total: 0 },
    'event-dialogue': { completed: 0, total: 0 },
    'gap-audit': { completed: 0, total: 0 },
  },
  artifacts: {
    sourceText: true,
    chapterSplit: true,
    sourceIndex: false,
    scanManifest: false,
    candidates: false,
    decisions: false,
    qualityReport: false,
  },
  dataCompleteness: { present: 8, valid: 8, required: 8 },
  contentCoverage: {
    state: 'empty',
    total: 0,
    detailed: 0,
    indexOnly: 0,
    byEntity: Object.fromEntries(
      ['characters', 'factions', 'locations', 'skills', 'techniques', 'items'].map((key) => [
        key,
        { total: 0, detailed: 0, indexOnly: 0 },
      ]),
    ) as LibraryBookStatus['contentCoverage']['byEntity'],
  },
  entityCounts: { characters: 0, factions: 0, locations: 0, skills: 0, techniques: 0, items: 0, dialogues: 0 },
  missingArtifacts: [],
  errors: [],
  gateFailures: [],
  suggestedAction: null,
};

const materialTypes: GameMaterial['material_type'][] = [
  '战斗系统原型',
  '经典剧情桥段',
  '角色原型/彩蛋',
  '标志性物品',
  '门派与世界观素材',
];

function setGameMaterials(resource: BookExtrasData['gameMaterials'], options: { loading?: boolean; error?: string | null } = {}) {
  useLibraryStore.setState({
    currentBook: BOOK_PATH,
    books: [book],
    extrasCache: {
      [BOOK_PATH]: {
        events: { status: 'missing', data: null },
        gameMaterials: resource,
      },
    },
    extrasLoading: { [BOOK_PATH]: options.loading === true },
    extrasErrors: { [BOOK_PATH]: options.error ?? null },
  });
}

function renderOverview() {
  return render(
    <MemoryRouter>
      <BookOverview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useNovelStore.getState().clearData();
  setGameMaterials({
    status: 'available',
    data: {
      schema_version: 1,
      entries: materialTypes.map((material_type, index) => ({
        material_type,
        source_id: `source_${index}`,
        relevance: '高',
        suggested_use: '测试用途',
        reason: '测试理由',
      })),
    },
  });
});

describe('书籍概览游戏素材摘要', () => {
  it('显示素材总数、五类分布和查看全部入口', () => {
    renderOverview();

    expect(screen.getByRole('heading', { name: '游戏素材' })).toBeInTheDocument();
    expect(screen.getByText('5 条游戏素材')).toBeInTheDocument();
    for (const type of materialTypes) {
      expect(screen.getByText(type)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: '查看全部游戏素材' })).toHaveAttribute(
      'href',
      '/%E9%87%91%E5%BA%B8/%E9%A3%9E%E7%8B%90%E5%A4%96%E4%BC%A0/game-materials',
    );
  });

  it('区分缺失、合法空报告和读取错误', () => {
    setGameMaterials({ status: 'missing', data: null });
    renderOverview();
    expect(screen.getByText('本书尚未生成游戏素材')).toBeInTheDocument();
  });

  it('合法空报告显示 0 条游戏素材', () => {
    setGameMaterials({ status: 'available', data: { schema_version: 1, entries: [] } });
    renderOverview();
    expect(screen.getByText('0 条游戏素材')).toBeInTheDocument();
  });

  it('损坏报告显示错误而不是 0 条', () => {
    setGameMaterials({ status: 'invalid', data: null, error: '报告损坏' });
    renderOverview();
    expect(screen.getByText(/报告损坏/)).toBeInTheDocument();
    expect(screen.queryByText('0 条游戏素材')).not.toBeInTheDocument();
  });

  it('扩展数据加载中时不把素材误判为缺失', () => {
    setGameMaterials({ status: 'missing', data: null }, { loading: true });
    renderOverview();
    expect(screen.getByText('正在加载游戏素材')).toBeInTheDocument();
    expect(screen.queryByText('本书尚未生成游戏素材')).not.toBeInTheDocument();
  });

  it('扩展接口不可用时显示独立错误而不是 0 条', () => {
    setGameMaterials({ status: 'missing', data: null }, { error: '扩展接口暂时不可用' });
    renderOverview();
    expect(screen.getByText(/扩展接口暂时不可用/)).toBeInTheDocument();
    expect(screen.queryByText('0 条游戏素材')).not.toBeInTheDocument();
  });
});
