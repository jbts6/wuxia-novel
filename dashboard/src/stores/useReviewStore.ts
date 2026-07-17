import { create } from 'zustand';
import type { ReviewEntity, ReviewFilter, ReviewFile } from '../types/novel';
import { DATA_FILE_NAMES, type DataFileKey } from '../types/library';
import yaml from 'js-yaml';

function parseData(content: string): Record<string, unknown>[] {
  return yaml.load(content) as Record<string, unknown>[];
}

function serializeData(data: Record<string, unknown>[]): string {
  return yaml.dump(data, { lineWidth: -1 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReviewFileType(value: unknown): value is DataFileKey {
  return typeof value === 'string' && Object.hasOwn(DATA_FILE_NAMES, value);
}

function toReviewEntity(item: Record<string, unknown>, type: DataFileKey): ReviewEntity | null {
  if (type === 'chapter_summaries') {
    if (typeof item.chapter !== 'number') return null;
    return {
      key: `${type}:${item.chapter}`,
      chapter: item.chapter,
      name: typeof item.title === 'string' && item.title ? item.title : `第${item.chapter}章`,
      type,
      summary: typeof item.summary === 'string' ? item.summary : '',
      marked: false,
      data: item,
    };
  }

  if (typeof item.id !== 'string' || !item.id) return null;
  return {
    key: `${type}:${item.id}`,
    id: item.id,
    name: typeof item.name === 'string' ? item.name : '',
    type,
    summary: typeof item.one_line === 'string'
      ? item.one_line
      : typeof item.identity === 'string'
        ? item.identity
        : typeof item.description === 'string'
          ? item.description
          : '',
    marked: false,
    data: item,
  };
}

function matchesReviewEntity(item: Record<string, unknown>, entity: ReviewEntity): boolean {
  return entity.type === 'chapter_summaries'
    ? item.chapter === entity.chapter
    : item.id === entity.id;
}

interface ReviewStore {
  entities: ReviewEntity[];
  files: ReviewFile[];
  filter: ReviewFilter;
  isLoading: boolean;
  error: string | null;
  bookPath: string | null;

  loadFiles: (bookPath: string) => Promise<void>;
  loadEntities: (bookPath: string, fileType: DataFileKey) => Promise<void>;
  toggleMark: (key: string) => void;
  markAll: (marked: boolean) => void;
  deleteMarked: () => Promise<boolean>;
  setFilter: (filter: Partial<ReviewFilter>) => void;
  clearData: () => void;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  entities: [],
  files: [],
  filter: {
    type: 'all',
    status: 'all',
    search: '',
  },
  isLoading: false,
  error: null,
  bookPath: null,

  loadFiles: async (bookPath: string) => {
    set({ isLoading: true, error: null, bookPath });
    try {
      const response = await fetch(`/api/review/list?bookPath=${encodeURIComponent(bookPath)}`);
      if (!response.ok) throw new Error('加载文件列表失败');
      const data = await response.json();
      const files = Array.isArray(data.files)
        ? data.files.filter((file: unknown): file is ReviewFile =>
          isRecord(file)
          && typeof file.name === 'string'
          && typeof file.path === 'string'
          && isReviewFileType(file.type),
        )
        : [];
      set({ files, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadEntities: async (bookPath: string, fileType: DataFileKey) => {
    set({ isLoading: true, error: null });
    try {
      const filePath = `${bookPath}/data/${DATA_FILE_NAMES[fileType]}`;
      const response = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);

      if (!response.ok) throw new Error('加载数据失败');
      const data = await response.json();

      const rawEntities = parseData(data.content);
      const entities = (rawEntities || [])
        .map((item) => toReviewEntity(item, fileType))
        .filter((entity): entity is ReviewEntity => entity !== null);

      set({ entities, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  toggleMark: (key: string) => {
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.key === key ? { ...entity, marked: !entity.marked } : entity
      ),
    }));
  },

  markAll: (marked: boolean) => {
    set((state) => ({
      entities: state.entities.map((entity) => ({ ...entity, marked })),
    }));
  },

  deleteMarked: async () => {
    const { entities, bookPath, filter } = get();
    if (!bookPath) return false;

    const markedEntities = entities.filter((e) => e.marked);
    if (markedEntities.length === 0) return false;

    set({ isLoading: true, error: null });
    try {
      // 按类型分组
      const grouped = new Map<DataFileKey, ReviewEntity[]>();
      for (const entity of markedEntities) {
        grouped.set(entity.type, [...(grouped.get(entity.type) ?? []), entity]);
      }

      // 对每个类型进行处理
      for (const [fileType, entitiesToDelete] of grouped) {
        const filePath = `${bookPath}/data/${DATA_FILE_NAMES[fileType]}`;
        const readResponse = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);

        if (!readResponse.ok) throw new Error('读取文件失败');

        // 备份文件到 backups 目录
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = filePath.split('/').pop() || '';
        const backupFileName = fileName.replace(/\.yaml$/, `.backup.${timestamp}.yaml`);
        const backupPath = `${bookPath}/data/backups/${backupFileName}`;
        const backupResponse = await fetch('/api/review/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: filePath, target: backupPath }),
        });
        if (!backupResponse.ok) throw new Error('备份文件失败');

        const readData = await readResponse.json();

        // 过滤掉标记的实体
        const rawEntities = parseData(readData.content);
        const filteredEntities = (rawEntities || []).filter(
          (item) => !entitiesToDelete.some((entity) => matchesReviewEntity(item, entity))
        );

        // 写回文件
        const content = serializeData(filteredEntities);
        const writeResponse = await fetch('/api/review/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content }),
        });
        if (!writeResponse.ok) throw new Error('写入文件失败');
      }

      // 重新加载数据
      if (filter.type === 'all') {
        // 如果是全部类型，需要重新加载所有文件
        const { loadFiles, loadEntities } = get();
        await loadFiles(bookPath);
        // 默认加载第一个文件类型
        const files = get().files;
        if (files.length > 0) {
          await loadEntities(bookPath, files[0].type);
        }
      } else {
        // 重新加载当前类型
        await get().loadEntities(bookPath, filter.type);
      }

      set({ isLoading: false });
      return true;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return false;
    }
  },

  setFilter: (filter: Partial<ReviewFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  clearData: () => {
    set({
      entities: [],
      files: [],
      filter: { type: 'all', status: 'all', search: '' },
      isLoading: false,
      error: null,
      bookPath: null,
    });
  },
}));
