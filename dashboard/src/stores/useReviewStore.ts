import { create } from 'zustand';
import type { ReviewEntity, ReviewFilter, ReviewFile } from '../types/novel';
import yaml from 'js-yaml';

function parseData(content: string, filePath: string): Record<string, unknown>[] {
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  return yaml.load(content) as Record<string, unknown>[];
}

function serializeData(data: Record<string, unknown>[], filePath: string): string {
  if (filePath.endsWith('.json')) {
    return JSON.stringify(data, null, 2);
  }
  return yaml.dump(data, { lineWidth: -1 });
}

interface ReviewStore {
  entities: ReviewEntity[];
  files: ReviewFile[];
  filter: ReviewFilter;
  isLoading: boolean;
  error: string | null;
  bookPath: string | null;

  loadFiles: (bookPath: string) => Promise<void>;
  loadEntities: (bookPath: string, fileType: string) => Promise<void>;
  toggleMark: (id: string) => void;
  markAll: (marked: boolean) => void;
  deleteMarked: () => Promise<void>;
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
      set({ files: data.files, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadEntities: async (bookPath: string, fileType: string) => {
    set({ isLoading: true, error: null });
    try {
      // 尝试 YAML 文件，如果不存在则尝试 JSON 文件
      let filePath = `${bookPath}/data/${fileType}.yaml`;
      let response = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);

      if (!response.ok) {
        filePath = `${bookPath}/data/${fileType}.json`;
        response = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);
      }

      if (!response.ok) throw new Error('加载数据失败');
      const data = await response.json();

      const rawEntities = parseData(data.content, filePath);
      const entities: ReviewEntity[] = (rawEntities || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: item.name as string,
        type: fileType as 'character' | 'skill' | 'item',
        summary: (item.one_line || item.identity || item.description || '') as string,
        marked: false,
        data: item,
      }));

      set({ entities, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  toggleMark: (id: string) => {
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.id === id ? { ...entity, marked: !entity.marked } : entity
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
    if (!bookPath) return;

    const markedEntities = entities.filter((e) => e.marked);
    if (markedEntities.length === 0) return;

    set({ isLoading: true, error: null });
    try {
      // 按类型分组
      const grouped = markedEntities.reduce((acc, entity) => {
        if (!acc[entity.type]) acc[entity.type] = [];
        acc[entity.type].push(entity.id);
        return acc;
      }, {} as Record<string, string[]>);

      // 对每个类型进行处理
      for (const [fileType, ids] of Object.entries(grouped)) {
        // 尝试 YAML 文件，如果不存在则尝试 JSON 文件
        let filePath = `${bookPath}/data/${fileType}.yaml`;
        let readResponse = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);

        if (!readResponse.ok) {
          filePath = `${bookPath}/data/${fileType}.json`;
          readResponse = await fetch(`/api/review/read?path=${encodeURIComponent(filePath)}`);
        }

        if (!readResponse.ok) throw new Error('读取文件失败');

        // 备份文件到 backups 目录
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = filePath.split('/').pop() || '';
        const backupFileName = fileName.replace(/(\.(yaml|yml|json))$/, `.backup.${timestamp}$1`);
        const backupPath = `${bookPath}/data/backups/${backupFileName}`;
        await fetch('/api/review/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: filePath, target: backupPath }),
        });

        const readData = await readResponse.json();

        // 过滤掉标记的实体
        const rawEntities = parseData(readData.content, filePath);
        const filteredEntities = (rawEntities || []).filter(
          (item: Record<string, unknown>) => !ids.includes(item.id as string)
        );

        // 写回文件
        const content = serializeData(filteredEntities, filePath);
        await fetch('/api/review/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content }),
        });
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
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
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
