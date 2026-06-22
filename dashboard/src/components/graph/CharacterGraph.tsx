import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { Spin, Empty, Space, Checkbox, Card } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';
import type { CardType, GraphLink } from '../../types/novel';
import { ENTITY_COLORS, INK, PAPER, CINNABAR } from '../../theme/palette';
import InkTag from '../common/InkTag';

// CSS 强制 canvas 填满容器，绕过 react-force-graph-2d 的 JS 内联样式
const GRAPH_CSS = `
.force-graph-container,
.force-graph-container canvas {
  width: 100% !important;
  height: 100% !important;
}
`;

const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));

const NODE_TYPES = [
  { key: 'character', label: '角色', color: ENTITY_COLORS.character },
  { key: 'skill', label: '技能', color: ENTITY_COLORS.skill },
  { key: 'item', label: '物品', color: ENTITY_COLORS.item },
  { key: 'location', label: '地点', color: ENTITY_COLORS.location },
  { key: 'faction', label: '势力', color: ENTITY_COLORS.faction },
] as const;

type NodeType = typeof NODE_TYPES[number]['key'];

type ForceGraphNode = {
  id?: string | number;
  name?: string;
  type?: string;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
};

const getLinkEndpointId = (endpoint: GraphLink['source']): string => (
  typeof endpoint === 'object' ? endpoint.id : endpoint
);

const CharacterGraph: React.FC = () => {
  const graphNodes = useNovelStore((s) => s.graphNodes);
  const graphLinks = useNovelStore((s) => s.graphLinks);
  const showDetail = useNovelStore((s) => s.showDetail);
  const loading = useNovelStore((s) => s.loading);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<NodeType[]>(['character']);

  // 缓存字体字符串，避免每节点每帧调用 getComputedStyle
  const fontFamily = useMemo(() => {
    const ff = getComputedStyle(document.documentElement).getPropertyValue('--font-serif');
    return ff?.trim() || 'serif';
  }, []);

  const graphData = useMemo(() => {
    const nodes = graphNodes
      .filter((node) => visibleTypes.includes(node.type as NodeType))
      .map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        val: node.val,
        color: node.color,
        data: node.data,
      }));

    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = graphLinks
      .filter((link) => {
        const sourceId = getLinkEndpointId(link.source);
        const targetId = getLinkEndpointId(link.target);
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map((link) => ({
        ...link,
        source: getLinkEndpointId(link.source),
        target: getLinkEndpointId(link.target),
      }));

    return { nodes, links };
  }, [graphNodes, graphLinks, visibleTypes]);

  const toggleType = useCallback((type: NodeType) => {
    setVisibleTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  }, []);

  const setPreset = useCallback((types: NodeType[]) => {
    setVisibleTypes(types);
  }, []);

  // 同步 hoveredNodeId 到 ref，使 nodeCanvasObject 不依赖 state
  useEffect(() => { hoveredRef.current = hoveredNodeId; }, [hoveredNodeId]);

  const nodeCanvasObject = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = Math.sqrt(node.val || 1) * 3 + 4;
      const isHovered = hoveredRef.current === node.id;

      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || ENTITY_COLORS.character;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = CINNABAR.base;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.strokeStyle = PAPER.raised;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();

      const label = node.name || '';
      const fontSize = Math.max(10 / globalScale, 2);
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = INK.body;
      ctx.fillText(label, node.x || 0, (node.y || 0) + size + 4 / globalScale);
    },
    [fontFamily]
  );

  const nodePointerAreaPaint = useCallback(
    (node: ForceGraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const size = Math.sqrt(node.val || 1) * 3 + 4;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      if (node?.type && typeof node.id === 'string') {
        showDetail(node.type as CardType, node.id);
      }
    },
    [showDetail]
  );

  const handleNodeHover = useCallback((node: ForceGraphNode | null) => {
    setHoveredNodeId(typeof node?.id === 'string' ? node.id : null);
  }, []);

  if (loading) return <Spin size="large" />;
  if (graphNodes.length === 0) return <Empty description="暂无图谱数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      <style>{GRAPH_CSS}</style>
      <Card size="small" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--ink-secondary)' }}>显示类型：</span>

          <Space size={8}>
            <a onClick={() => setPreset(NODE_TYPES.map((t) => t.key))} style={{ fontSize: 12 }}>
              全部
            </a>
            <span style={{ color: 'var(--ink-hairline)' }}>|</span>
            <a onClick={() => setPreset(['character'])} style={{ fontSize: 12 }}>
              仅角色
            </a>
            <span style={{ color: 'var(--ink-hairline)' }}>|</span>
            <a onClick={() => setPreset(['character', 'skill'])} style={{ fontSize: 12 }}>
              角色+技能
            </a>
            <span style={{ color: 'var(--ink-hairline)' }}>|</span>
            <a onClick={() => setPreset(['character', 'faction'])} style={{ fontSize: 12 }}>
              角色+势力
            </a>
          </Space>

          <div style={{ flex: 1 }} />

          <Space size={12}>
            {NODE_TYPES.map((type) => (
              <Checkbox
                key={type.key}
                checked={visibleTypes.includes(type.key)}
                onChange={() => toggleType(type.key)}
              >
                <InkTag color={type.color} style={{ margin: 0 }}>
                  {type.label}
                </InkTag>
              </Checkbox>
            ))}
          </Space>
        </div>
      </Card>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--ink-hairline)',
          borderRadius: 8,
          overflow: 'hidden',
          background: PAPER.base,
        }}
      >
        <React.Suspense fallback={<Spin size="large" />}>
          <ForceGraph2D
            graphData={graphData}
            backgroundColor={PAPER.base}
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkDirectionalParticles={1}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => INK.faint}
            linkColor={() => INK.hairline}
            linkWidth={0.5}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={20}
            cooldownTime={2000}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        </React.Suspense>
      </div>
    </div>
  );
};

export default CharacterGraph;
