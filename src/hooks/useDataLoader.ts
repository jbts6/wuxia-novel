import { useEffect, useState } from 'react';
import type {
  Character,
  Skill,
  Technique,
  Item,
  Event,
  Location,
  Faction,
  Dialogue,
} from '../types/novel';

interface NovelData {
  characters: Character[];
  skills: Skill[];
  techniques: Technique[];
  items: Item[];
  events: Event[];
  locations: Location[];
  factions: Faction[];
  dialogues: Dialogue[];
  loading: boolean;
  error: string | null;
}

export function useDataLoader(bookPath: string | null): NovelData {
  const [data, setData] = useState<NovelData>({
    characters: [],
    skills: [],
    techniques: [],
    items: [],
    events: [],
    locations: [],
    factions: [],
    dialogues: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!bookPath) {
      setData(prev => ({ ...prev, loading: false }));
      return;
    }

    const loadData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        const encodedBook = encodeURIComponent(bookPath);
        const fetchFile = (file: string) =>
          fetch(`/api/novel/${file}?book=${encodedBook}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load ${file}`);
            return r.json();
          });

        const [
          characters,
          skills,
          techniques,
          items,
          events,
          locations,
          factions,
          dialogues,
        ] = await Promise.all([
          fetchFile('characters.json'),
          fetchFile('skills.json'),
          fetchFile('techniques.json'),
          fetchFile('items.json'),
          fetchFile('events.json'),
          fetchFile('locations.json'),
          fetchFile('factions.json'),
          fetchFile('dialogues.json'),
        ]);

        setData({
          characters,
          skills,
          techniques,
          items,
          events,
          locations,
          factions,
          dialogues,
          loading: false,
          error: null,
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '加载数据失败',
        }));
      }
    };

    loadData();
  }, [bookPath]);

  return data;
}
