import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useNovelStore } from '../stores/useNovelStore';
import type { LibraryBookStatus } from '../types/library';
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
    byEntity: {
      characters: { total: 0, detailed: 0, indexOnly: 0 },
      factions: { total: 0, detailed: 0, indexOnly: 0 },
      skills: { total: 0, detailed: 0, indexOnly: 0 },
      items: { total: 0, detailed: 0, indexOnly: 0 },
    },
  },
  entityCounts: { characters: 0, factions: 0, skills: 0, items: 0 },
  missingArtifacts: [],
  errors: [],
  gateFailures: [],
  suggestedAction: null,
};

function renderOverview() {
  return render(
    <MemoryRouter>
      <BookOverview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useLibraryStore.setState({ currentBook: BOOK_PATH, books: [book] });
  useNovelStore.setState({
    characters: [{
      id: 'char-1',
      name: '人物一',
      aliases: [],
      identities: ['侠客'],
      level: '核心',
      rank: null,
      description: '人物简介',
      factions: ['faction-1'],
      skills: ['skill-1'],
    }],
    skills: [{
      id: 'skill-1',
      name: '武功一',
      aliases: [],
      types: ['内功'],
      factions: ['faction-1'],
      rank: null,
      description: '武功简介',
      techniques: [],
    }],
    items: [{ id: 'item-1', name: '物品一', aliases: [], types: ['兵器', '暗器'], description: '物品简介' }],
    factions: [{ id: 'faction-1', name: '势力一', aliases: [], types: ['门派', '商会'], description: '势力简介' }],
    locations: [{ id: 'location-1', name: '旧地点', description: '不应显示' }],
    dialogues: [{ id: 'dialogue-1', speaker: 'char-1', chapter: 1, text: '旧对话' }],
    chapterSummaries: [{ chapter: 1, title: '第一章', summary: '章节摘要' }],
    factionMap: new Map([['faction-1', '势力一']]),
    locationMap: new Map([['location-1', '旧地点']]),
  });
});

describe('书籍概览实体摘要', () => {
  it('显示四类实体和章节摘要，不显示已移除的可见分类', () => {
    renderOverview();

    expect(screen.getByText('人物')).toBeInTheDocument();
    expect(screen.getByText('武功')).toBeInTheDocument();
    expect(screen.getByText('物品')).toBeInTheDocument();
    expect(screen.getByText('势力')).toBeInTheDocument();
    expect(screen.getByText('章节')).toBeInTheDocument();
    expect(screen.getByText('门派、商会')).toBeInTheDocument();
    expect(screen.queryByText('地点')).not.toBeInTheDocument();
    expect(screen.queryByText('对话')).not.toBeInTheDocument();
    expect(screen.queryByText('游戏素材')).not.toBeInTheDocument();
  });
});
