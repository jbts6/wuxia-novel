import React, { useMemo, useState } from 'react';
import { Select } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import type { CardType, Character, GraphLink, GraphNode } from '../../types/novel';
import { CINNABAR, INK, PAPER } from '../../theme/palette';
import { RELATION_COLORS } from '../../utils/graphHelper';

const CENTER_R = 42;
const RING1_R = 170;
const RING2_R = 310;
const MAX_RING1 = 16;
const MAX_RING2_PER_PARENT = 6;
const MAX_RING2_TOTAL = 72;

interface MindNode {
  id: string;
  name: string;
  type: GraphNode['type'];
  color: string;
  x: number;
  y: number;
  r: number;
  ring: 0 | 1 | 2;
  parentId?: string;
  linkLabel?: string;
  linkColor?: string;
  typeId?: CardType;
}

interface MindLink {
  from: MindNode;
  to: MindNode;
  label: string;
  color: string;
}

function getLinkEndpointId(endpoint: GraphLink['source']): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint;
}

const CharacterMindMap: React.FC = () => {
  const characters = useNovelStore(s => s.characters);
  const graphNodes = useNovelStore(s => s.graphNodes);
  const graphLinks = useNovelStore(s => s.graphLinks);
  const showDetail = useNovelStore(s => s.showDetail);

  const [rootId, setRootId] = useState<string | null>(null);

  const nodeById = useMemo(
    () => new Map(graphNodes.map(n => [n.id, n])),
    [graphNodes],
  );

  const adjacency = useMemo(() => {
    const out = new Map<string, { targetId: string; label: string; color: string }[]>();
    for (const link of graphLinks) {
      const s = getLinkEndpointId(link.source);
      const t = getLinkEndpointId(link.target);
      if (!out.has(s)) out.set(s, []);
      if (!out.has(t)) out.set(t, []);
      const label = link.type || '';
      const color = link.color || RELATION_COLORS[label] || INK.hairline;
      out.get(s)!.push({ targetId: t, label, color });
      out.get(t)!.push({ targetId: s, label, color });
    }
    return out;
  }, [graphLinks]);

  const layout = useMemo(() => {
    if (!rootId) return { nodes: [] as MindNode[], links: [] as MindLink[], size: 0 };

    const root = nodeById.get(rootId);
    if (!root) return { nodes: [] as MindNode[], links: [] as MindLink[], size: 0 };

    const nodes: MindNode[] = [];
    const links: MindLink[] = [];
    const seen = new Set<string>([rootId]);

    const center: MindNode = {
      id: root.id,
      name: root.name,
      type: root.type,
      color: CINNABAR.base,
      x: 0,
      y: 0,
      r: CENTER_R,
      ring: 0,
      typeId: 'character',
    };
    nodes.push(center);

    const firstDegreeRaw = adjacency.get(rootId) ?? [];
    const firstDegree = firstDegreeRaw
      .filter(e => nodeById.has(e.targetId))
      .slice(0, MAX_RING1);

    const ring1Count = firstDegree.length;
    firstDegree.forEach((edge, i) => {
      const theta = (i / Math.max(ring1Count, 1)) * Math.PI * 2 - Math.PI / 2;
      const n = nodeById.get(edge.targetId)!;
      const node: MindNode = {
        id: n.id,
        name: n.name,
        type: n.type,
        color: n.color,
        x: Math.cos(theta) * RING1_R,
        y: Math.sin(theta) * RING1_R,
        r: 14 + Math.min((n.val || 1) * 1.2, 12),
        ring: 1,
        parentId: rootId,
        linkLabel: edge.label,
        linkColor: edge.color,
        typeId: n.type as CardType,
      };
      nodes.push(node);
      links.push({ from: center, to: node, label: edge.label, color: edge.color });
      seen.add(n.id);
    });

    const ring2: MindNode[] = [];
    firstDegree.forEach(edge => {
      const parent = nodes.find(n => n.id === edge.targetId);
      if (!parent) return;
      const parentAngle = Math.atan2(parent.y, parent.x);
      const neighbors = (adjacency.get(edge.targetId) ?? []).filter(
        e => e.targetId !== rootId && !seen.has(e.targetId) && nodeById.has(e.targetId),
      );
      const take = neighbors.slice(0, MAX_RING2_PER_PARENT);
      const spread = Math.min(Math.PI / 4, (take.length - 1) * 0.18);
      take.forEach((subEdge, j) => {
        const t = take.length === 1 ? 0 : (j / (take.length - 1)) * 2 - 1;
        const theta = parentAngle + t * spread;
        const n = nodeById.get(subEdge.targetId)!;
        const node: MindNode = {
          id: n.id,
          name: n.name,
          type: n.type,
          color: n.color,
          x: Math.cos(theta) * RING2_R,
          y: Math.sin(theta) * RING2_R,
          r: 10 + Math.min((n.val || 1) * 0.8, 8),
          ring: 2,
          parentId: parent.id,
          linkLabel: subEdge.label,
          linkColor: subEdge.color,
          typeId: n.type as CardType,
        };
        ring2.push(node);
        links.push({ from: parent, to: node, label: subEdge.label, color: subEdge.color });
        seen.add(n.id);
      });
      if (ring2.length >= MAX_RING2_TOTAL) return;
    });
    nodes.push(...ring2.slice(0, MAX_RING2_TOTAL));

    const size = (RING2_R + 80) * 2;
    return { nodes, links, size };
  }, [rootId, nodeById, adjacency]);

  const characterOptions = useMemo(
    () =>
      characters
        .slice()
        .sort((a, b) => {
          const order = { protagonist: 0, companion: 1, villain: 2, npc: 3 };
          const ra = order[a.role] ?? 9;
          const rb = order[b.role] ?? 9;
          if (ra !== rb) return ra - rb;
          return a.name.localeCompare(b.name, 'zh');
        })
        .map(c => ({ value: c.id, label: `${c.name}（${(c as Character).identity || c.role}）` })),
    [characters],
  );

  const handleNodeClick = (n: MindNode) => {
    if (!n.typeId) return;
    showDetail(n.typeId, n.id);
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 14px',
          background: PAPER.raised,
          border: `1px solid ${INK.hairline}`,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            color: INK.secondary,
            letterSpacing: '0.15em',
          }}
        >
          择 一 人 而 观 其 脉
        </span>
        <Select
          showSearch
          allowClear
          placeholder="选择角色…"
          value={rootId}
          onChange={v => setRootId(v ?? null)}
          options={characterOptions}
          filterOption={(input, opt) =>
            (opt?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          style={{ minWidth: 280, flex: 1, maxWidth: 420 }}
        />
        {rootId && (
          <span
            style={{
              fontSize: 12,
              color: INK.faint,
              fontFamily: 'var(--font-serif)',
              letterSpacing: '0.1em',
            }}
          >
            {layout.nodes.length} 人 · {layout.links.length} 脉
          </span>
        )}
      </header>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: '70vh',
          background: PAPER.base,
          border: `1px solid ${INK.hairline}`,
          overflow: 'auto',
        }}
      >
        {!rootId ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: INK.faint,
              fontFamily: 'var(--font-serif)',
              fontSize: 15,
              letterSpacing: '0.2em',
            }}
          >
            — 择 一 人 方 见 江 湖 —
          </div>
        ) : (
          <svg
            viewBox={`${-layout.size / 2} ${-layout.size / 2} ${layout.size} ${layout.size}`}
            width="100%"
            height="100%"
            style={{ display: 'block', minWidth: 640, minHeight: 640 }}
          >
            <g>
              {layout.links.map((l, i) => {
                const mx = (l.from.x + l.to.x) / 2;
                const my = (l.from.y + l.to.y) / 2;
                return (
                  <g key={`link-${i}`}>
                    <line
                      x1={l.from.x}
                      y1={l.from.y}
                      x2={l.to.x}
                      y2={l.to.y}
                      stroke={l.color}
                      strokeWidth={l.to.ring === 1 ? 1.4 : 0.9}
                      strokeOpacity={l.to.ring === 1 ? 0.75 : 0.55}
                    />
                    {l.label && (
                      <text
                        x={mx}
                        y={my}
                        textAnchor="middle"
                        fontSize={11}
                        fontFamily="var(--font-serif)"
                        fill={INK.secondary}
                        style={{ pointerEvents: 'none' }}
                      >
                        {l.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
            <g>
              {layout.nodes.map(n => (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleNodeClick(n)}
                >
                  <circle
                    r={n.r}
                    fill={n.color}
                    stroke={n.ring === 0 ? CINNABAR.deep : PAPER.raised}
                    strokeWidth={n.ring === 0 ? 3 : 2}
                  />
                  <text
                    y={n.r + 14}
                    textAnchor="middle"
                    fontSize={n.ring === 0 ? 16 : n.ring === 1 ? 13 : 11}
                    fontFamily="var(--font-serif)"
                    fontWeight={n.ring === 0 ? 700 : 500}
                    fill={INK.black}
                    style={{ pointerEvents: 'none' }}
                  >
                    {n.name}
                  </text>
                  {n.ring === 0 && (
                    <text
                      y={4}
                      textAnchor="middle"
                      fontSize={18}
                      fontFamily="var(--font-serif)"
                      fontWeight={700}
                      fill={PAPER.raised}
                      style={{ pointerEvents: 'none' }}
                    >
                      {n.name.slice(0, 1)}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
    </section>
  );
};

export default CharacterMindMap;
