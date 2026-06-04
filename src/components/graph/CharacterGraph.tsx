import React, { useMemo, useCallback, useRef, useState } from 'react';
import { Spin, Empty, Tag, Space, Checkbox, Card } from 'antd';
import { useNovelStore } from '../../stores/useNovelStore';

const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));

const NODE_TYPES = [
  { key: 'character', label: '角色', color: '#1890ff' },
  { key: 'skill', label: '技能', color: '#52c41a' },
  { key: 'item', label: '物品', color: '#faad14' },
  { key: 'location', label: '地点', color: '#722ed1' },
  { key: 'faction', label: '势力', color: '#13c2c2' },
] as const;

type NodeType = typeof NODE_TYPES[number]['key'];

const CharacterGraph: React.FC = () => {
  const { graphNodes, graphLinks, showDetail, loading } = useNovelStore();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [visibleTypes, setVisibleTypes] = useState<NodeType[]>(['character']);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
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
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map((link) => ({
        ...link,
        source: typeof link.source === 'object' ? (link.source as any).id : link.source,
        target: typeof link.target === 'object' ? (link.target as any).id : link.target,
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

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = Math.sqrt(node.val || 1) * 3 + 4;
      const isHovered = hoveredNodeId === node.id;

      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#1890ff';
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();

      const label = node.name || '';
      const fontSize = Math.max(10 / globalScale, 2);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#333';
      ctx.fillText(label, node.x || 0, (node.y || 0) + size + 4 / globalScale);
    },
    [hoveredNodeId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const size = Math.sqrt(node.val || 1) * 3 + 4;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      if (node?.type && node?.id) {
        showDetail(node.type, node.id);
      }
    },
    [showDetail]
  );

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNodeId(node?.id || null);
  }, []);

  if (loading) return <Spin size="large" />;
  if (graphNodes.length === 0) return <Empty description="暂无图谱数据" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#666' }}>显示类型：</span>

          <Space size={8}>
            <a onClick={() => setPreset(NODE_TYPES.map((t) => t.key))} style={{ fontSize: 12 }}>
              全部
            </a>
            <span style={{ color: '#d9d9d9' }}>|</span>
            <a onClick={() => setPreset(['character'])} style={{ fontSize: 12 }}>
              仅角色
            </a>
            <span style={{ color: '#d9d9d9' }}>|</span>
            <a onClick={() => setPreset(['character', 'skill'])} style={{ fontSize: 12 }}>
              角色+技能
            </a>
            <span style={{ color: '#d9d9d9' }}>|</span>
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
                <Tag color={type.color} style={{ margin: 0 }}>
                  {type.label}
                </Tag>
              </Checkbox>
            ))}
          </Space>
        </div>
      </Card>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          overflow: 'hidden',
          minHeight: 400,
          background: '#fafafa',
        }}
      >
        <React.Suspense fallback={<Spin size="large" />}>
          <ForceGraph2D
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#fafafa"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkDirectionalParticles={1}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => '#999'}
            linkColor={() => '#bbb'}
            linkWidth={0.5}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={100}
            cooldownTime={3000}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
          />
        </React.Suspense>
      </div>
    </div>
  );
};

export default CharacterGraph;
