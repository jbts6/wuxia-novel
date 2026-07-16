import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNovelStore } from '../stores/useNovelStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { MultiSearchableSelect } from '../components/ui/multi-searchable-select';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { resolveId, resolveIds } from '../lib/resolveId';
import { displayChineseValues, displayTaxonomyValue } from '../lib/displayText';
import { useEntityDetailParam } from '../hooks/useEntityDetailParam';

export default function Skills() {
  const {
    skills,
    techniques,
    factionMap,
    characterMap,
    skillMap,
    detailPanel,
    showDetail,
    hideDetail,
  } = useNovelStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') === 'techniques' ? 'techniques' : 'skills';
  const [search, setSearch] = useState('');
  const [skillTypeFilter, setSkillTypeFilter] = useState<string[]>([]);
  const [techniqueTypeFilter, setTechniqueTypeFilter] = useState<string[]>([]);
  useEntityDetailParam(
    activeView === 'techniques' ? 'technique' : 'skill',
    activeView === 'techniques' ? techniques : skills,
  );

  const skillTypeOptions = useMemo(() => {
    const set = new Set(skills.map((s) => s.type).filter(Boolean));
    return Array.from(set).sort().map((t) => ({ value: t, label: displayTaxonomyValue(t) }));
  }, [skills]);

  const techniqueTypeOptions = useMemo(() => {
    const set = new Set(techniques.map((t) => t.type).filter((type): type is string => Boolean(type)));
    return Array.from(set).sort().map((t) => ({ value: t, label: displayTaxonomyValue(t) }));
  }, [techniques]);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchSearch = !search || s.name.includes(search);
      const matchType = skillTypeFilter.length === 0 || skillTypeFilter.includes(s.type);
      return matchSearch && matchType;
    });
  }, [skills, search, skillTypeFilter]);

  const filteredTechniques = useMemo(() => {
    return techniques.filter((technique) => {
      const matchSearch = !search || technique.name.includes(search);
      const matchType = techniqueTypeFilter.length === 0
        || (technique.type ? techniqueTypeFilter.includes(technique.type) : false);
      return matchSearch && matchType;
    });
  }, [techniques, search, techniqueTypeFilter]);

  const selected = useMemo(() => {
    if (detailPanel.type === 'skill' && detailPanel.id) {
      return skills.find((s) => s.id === detailPanel.id);
    }
    return null;
  }, [skills, detailPanel]);
  const holderNames = useMemo(() => resolveIds(selected?.holders, characterMap), [characterMap, selected]);
  const moveNames = displayChineseValues(selected?.moves);
  const selectedTechnique = useMemo(() => {
    if (detailPanel.type === 'technique' && detailPanel.id) {
      return techniques.find((technique) => technique.id === detailPanel.id);
    }
    return null;
  }, [detailPanel, techniques]);
  const selectedTechniqueSkillName = resolveId(
    selectedTechnique?.skill || selectedTechnique?.source_skill,
    skillMap,
    '未注明功法',
  );

  const handleViewChange = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    if (value === 'techniques') {
      next.set('view', 'techniques');
    } else {
      next.delete('view');
    }
    hideDetail();
    setSearchParams(next);
  };

  return (
    <div>
      <PageHeader
        title="武功阁"
        description={activeView === 'techniques'
          ? `共 ${filteredTechniques.length} 招式`
          : `共 ${filteredSkills.length} 种武功`}
      >
        <div className="flex gap-2">
          <Input
            placeholder={activeView === 'techniques' ? '搜索招式...' : '搜索武功...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          {activeView === 'techniques' ? (
            <MultiSearchableSelect
              className="w-48"
              options={techniqueTypeOptions}
              value={techniqueTypeFilter}
              onChange={setTechniqueTypeFilter}
              placeholder="类型"
              searchPlaceholder="搜索类型..."
              maxDisplay={2}
            />
          ) : (
            <MultiSearchableSelect
              className="w-48"
              options={skillTypeOptions}
              value={skillTypeFilter}
              onChange={setSkillTypeFilter}
              placeholder="类型"
              searchPlaceholder="搜索类型..."
              maxDisplay={2}
            />
          )}
        </div>
      </PageHeader>

      <Tabs value={activeView} onValueChange={handleViewChange}>
        <TabsList aria-label="武学视图">
          <TabsTrigger value="skills">功法</TabsTrigger>
          <TabsTrigger value="techniques">招式</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeView === 'techniques' ? (
        <div className="mt-3 rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">名称</th>
                <th className="p-3 text-left font-medium">所属功法</th>
                <th className="p-3 text-left font-medium">类型</th>
                <th className="p-3 text-left font-medium">描述</th>
              </tr>
            </thead>
            <tbody>
              {filteredTechniques.length > 0 ? filteredTechniques.map((technique) => (
                <tr
                  key={technique.id}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                  onClick={() => showDetail('technique', technique.id)}
                >
                  <td className="p-3 font-medium">{technique.name}</td>
                  <td className="p-3 text-sm">{resolveId(technique.skill || technique.source_skill, skillMap, '未注明功法')}</td>
                  <td className="p-3"><Badge variant="outline">{displayTaxonomyValue(technique.type)}</Badge></td>
                  <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">{technique.description || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">暂无招式</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">名称</th>
                <th className="p-3 text-left font-medium">类型</th>
                <th className="p-3 text-left font-medium">门派</th>
                <th className="p-3 text-left font-medium">境界</th>
                <th className="p-3 text-left font-medium">简介</th>
              </tr>
            </thead>
            <tbody>
              {filteredSkills.map((skill) => (
                <tr
                  key={skill.id}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                  onClick={() => showDetail('skill', skill.id)}
                >
                  <td className="p-3 font-medium">{skill.name}</td>
                  <td className="p-3">
                    <Badge variant="outline">{displayTaxonomyValue(skill.type)}</Badge>
                  </td>
                  <td className="p-3 text-sm">{resolveId(skill.faction, factionMap, '未注明势力')}</td>
                  <td className="p-3 text-sm text-accent">{displayTaxonomyValue(skill.power_rank)}</td>
                  <td className="max-w-xs truncate p-3 text-sm text-muted-foreground">
                    {skill.one_line || skill.description?.slice(0, 50) || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={detailPanel.open && detailPanel.type === 'skill'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selected && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>类型：{displayTaxonomyValue(selected.type)}</div>
                  <div>门派：{resolveId(selected.faction, factionMap, '未注明势力')}</div>
                  <div>境界：{displayTaxonomyValue(selected.power_rank)}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">简介</h4>
                  <p className="text-sm text-muted-foreground">{selected.one_line || selected.description || '暂无简介'}</p>
                </div>
                {moveNames.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">招式</h4>
                      <div className="flex flex-wrap gap-1">
                        {moveNames.map((m) => (
                          <Badge key={m} variant="secondary">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {holderNames.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 font-medium">掌握人物</h4>
                      <div className="flex flex-wrap gap-1">
                        {holderNames.map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={detailPanel.open && detailPanel.type === 'technique'} onOpenChange={(open) => !open && hideDetail()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6">
          {selectedTechnique && (
            <>
              <SheetHeader className="px-0">
                <SheetTitle className="font-serif text-xl">{selectedTechnique.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>所属功法：{selectedTechniqueSkillName}</div>
                  <div>类型：{displayTaxonomyValue(selectedTechnique.type)}</div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">描述</h4>
                  <p className="text-sm text-muted-foreground">{selectedTechnique.description || '暂无描述'}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-medium">原文证据</h4>
                  {selectedTechnique.source_refs && selectedTechnique.source_refs.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTechnique.source_refs.slice(0, 6).map((ref, index) => (
                        <div key={`${ref.chapter}-${ref.line_start ?? index}`} className="border-l-2 border-border pl-3">
                          <div className="text-xs text-muted-foreground">
                            第 {ref.chapter} 章
                            {ref.line_start !== undefined
                              ? ` · 行 ${ref.line_start}${ref.line_end !== undefined ? `-${ref.line_end}` : ''}`
                              : ''}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-foreground">
                            {ref.text || ref.anchor || '来源已定位，暂无摘录文本'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">当前记录没有可展示的原文摘录。</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
