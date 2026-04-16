import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useStore,
  type Node,
  type NodeTypes,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Text } from '@wordpress/ui';
import {
  useSavedItems,
  useSavedGroups,
  useUnsaveItem,
  useMoveToGroup,
  useCreateGroup,
  useUpdateItemPosition,
} from './useSavedItems';
import type { SavedItem, PostSnapshot, CommentSnapshot } from './types';
import { relativeTime } from '../lib/relativeTime';
import CanvasGrid, { type CanvasGridHandle } from './CanvasGrid';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

// ---------------------------------------------------------------------------
// Auto-placement for items without saved positions
// ---------------------------------------------------------------------------

const CARD_WIDTH = 400;
const CARD_GAP = 32;
const CARDS_PER_ROW = 4;

function autoPlace(index: number): { x: number; y: number } {
  const col = index % CARDS_PER_ROW;
  const row = Math.floor(index / CARDS_PER_ROW);
  return {
    x: col * (CARD_WIDTH + CARD_GAP),
    y: row * 320,
  };
}

// ---------------------------------------------------------------------------
// Viewport persistence
// ---------------------------------------------------------------------------

const VIEWPORT_KEY = 'cortex_saved_viewport';

function loadViewport() {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, zoom: 1 };
}

function saveViewport(vp: { x: number; y: number; zoom: number }) {
  localStorage.setItem(VIEWPORT_KEY, JSON.stringify(vp));
}

// ---------------------------------------------------------------------------
// Custom node components
// ---------------------------------------------------------------------------

function PostCard({ data }: NodeProps) {
  const item = data.item as SavedItem;
  const snap = item.snapshot as PostSnapshot;
  return (
    <div className="canvas-card canvas-card-post">
      <div className="canvas-card-header">
        <img src={snap.authorAvatar} alt="" className="canvas-card-avatar" />
        <div className="canvas-card-meta">
          <span className="canvas-card-author">{snap.authorName}</span>
          <span className="canvas-card-origin">
            {snap.siteName} · {relativeTime(snap.date)}
          </span>
        </div>
      </div>
      {snap.title && <h3 className="canvas-card-title">{decodeEntities(snap.title)}</h3>}
      <div className="canvas-card-body" dangerouslySetInnerHTML={{ __html: snap.content }} />
      {item.tags.length > 0 && (
        <div className="canvas-card-tags">
          {item.tags.map((tag) => (
            <span key={tag} className="canvas-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard({ data }: NodeProps) {
  const item = data.item as SavedItem;
  const snap = item.snapshot as CommentSnapshot;
  return (
    <div className="canvas-card canvas-card-comment">
      <div className="canvas-card-header">
        <img src={snap.authorAvatar} alt="" className="canvas-card-avatar" />
        <div className="canvas-card-meta">
          <span className="canvas-card-author">{snap.authorName}</span>
          <span className="canvas-card-origin">
            {snap.siteName} · {relativeTime(snap.date)}
          </span>
        </div>
      </div>
      <div className="canvas-card-context">Re: {decodeEntities(snap.postTitle)}</div>
      <div className="canvas-card-body" dangerouslySetInnerHTML={{ __html: snap.content }} />
      {item.tags.length > 0 && (
        <div className="canvas-card-tags">
          {item.tags.map((tag) => (
            <span key={tag} className="canvas-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const GROUP_COLORS = [
  'rgba(59, 130, 246, 0.06)', // blue
  'rgba(168, 130, 246, 0.06)', // purple
  'rgba(52, 211, 153, 0.06)', // green
  'rgba(251, 191, 36, 0.06)', // amber
  'rgba(244, 114, 182, 0.06)', // pink
  'rgba(96, 165, 250, 0.06)', // sky
];

const GROUP_BORDER_COLORS = [
  'rgba(59, 130, 246, 0.2)',
  'rgba(168, 130, 246, 0.2)',
  'rgba(52, 211, 153, 0.2)',
  'rgba(251, 191, 36, 0.2)',
  'rgba(244, 114, 182, 0.2)',
  'rgba(96, 165, 250, 0.2)',
];

function GroupRegion({ data }: NodeProps) {
  const colorIndex = (data.colorIndex as number) % GROUP_COLORS.length;
  return (
    <div
      className="canvas-group-region"
      style={{
        width: data.width as number,
        height: data.height as number,
        background: GROUP_COLORS[colorIndex],
        borderColor: GROUP_BORDER_COLORS[colorIndex],
      }}
    >
      <span className="canvas-group-label">{data.label as string}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  postCard: PostCard,
  commentCard: CommentCard,
  groupRegion: GroupRegion,
};

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

interface ContextMenuState {
  x: number;
  y: number;
  itemIds: number[]; // selected item IDs (empty = canvas right-click)
}

// ---------------------------------------------------------------------------
// Canvas inner (needs ReactFlowProvider parent)
// ---------------------------------------------------------------------------

interface CanvasInnerProps {
  onNavigate: (siteId: number, postId: number, commentId?: number | null) => void;
}

function CanvasInner({ onNavigate }: CanvasInnerProps) {
  const { data: items } = useSavedItems();
  const { data: groups } = useSavedGroups();
  const unsaveItem = useUnsaveItem();
  const moveToGroup = useMoveToGroup();
  const createGroup = useCreateGroup();
  const updatePosition = useUpdateItemPosition();
  const { fitView } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const gridRef = useRef<CanvasGridHandle>(null);

  // Access measured node dimensions from React Flow internals
  const nodeLookup = useStore((s) => s.nodeLookup);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    gridRef.current?.rippleAt(event.clientX, event.clientY);
  }, []);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const sortedGroups = useMemo(
    () => (groups ? [...groups].sort((a, b) => a.position - b.position) : []),
    [groups],
  );

  // Build React Flow nodes from saved items
  const [nodes, setNodes, baseOnNodesChange] = useNodesState<Node>([]);

  // Wrap onNodesChange to sync draggable with selected state
  const onNodesChange: typeof baseOnNodesChange = useCallback(
    (changes) => {
      baseOnNodesChange(changes);
      // After selection changes, update draggable to match
      const hasSelectionChange = changes.some((c) => c.type === 'select');
      if (hasSelectionChange) {
        setNodes((nds) => nds.map((n) => ({ ...n, draggable: n.selected === true })));
      }
    },
    [baseOnNodesChange, setNodes],
  );

  // Recompute group region nodes from current item node positions + measured heights
  const recomputeGroupRegions = useCallback(() => {
    if (!sortedGroups.length) return;
    const GROUP_PAD = 24;
    const LABEL_HEIGHT = 28;

    setNodes((currentNodes) => {
      const itemNds = currentNodes.filter((n) => !n.id.startsWith('group-'));
      const groupNds: Node[] = [];

      sortedGroups.forEach((group, gi) => {
        const members = itemNds.filter((n) => (n.data.item as SavedItem).groupId === group.id);
        if (members.length === 0) return;

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const n of members) {
          const measured = nodeLookup.get(n.id);
          const h = measured?.measured?.height ?? 300;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + CARD_WIDTH);
          maxY = Math.max(maxY, n.position.y + h);
        }

        groupNds.push({
          id: `group-${group.id}`,
          type: 'groupRegion',
          position: { x: minX - GROUP_PAD, y: minY - GROUP_PAD - LABEL_HEIGHT },
          data: {
            label: group.name,
            width: maxX - minX + GROUP_PAD * 2,
            height: maxY - minY + GROUP_PAD * 2 + LABEL_HEIGHT,
            colorIndex: gi,
          },
          draggable: false,
          selectable: false,
          zIndex: 0,
        });
      });

      return [...groupNds, ...itemNds];
    });
  }, [sortedGroups, setNodes, nodeLookup]);

  // Sync nodes when items change (new save, delete, etc.)
  // Set item nodes first, then recompute groups after a frame so dimensions are measured.
  useEffect(() => {
    if (!items) return;
    let autoIndex = 0;

    const itemNodes: Node[] = items.map((item) => {
      const hasPosition = item.x != null && item.y != null;
      const pos = hasPosition ? { x: item.x!, y: item.y! } : autoPlace(autoIndex++);

      return {
        id: String(item.id),
        type: item.type === 'post' ? 'postCard' : 'commentCard',
        position: pos,
        data: { item },
        draggable: false,
        style: { width: CARD_WIDTH },
        zIndex: 1,
      };
    });

    setNodes(itemNodes);

    // After React Flow measures the nodes, recompute group regions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        recomputeGroupRegions();
      });
    });
  }, [items, setNodes, recomputeGroupRegions]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const id = Number(node.id);
      if (Number.isFinite(id)) {
        updatePosition.mutate({ id, x: node.position.x, y: node.position.y });
      }
      recomputeGroupRegions();
    },
    [updatePosition, recomputeGroupRegions],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const item = node.data.item as SavedItem;
      onNavigate(item.siteId, item.postId, item.commentId);
    },
    [onNavigate],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // If the right-clicked node is part of a selection, use the whole selection.
      // Otherwise, just this node.
      const selectedIds = nodes.filter((n) => n.selected).map((n) => Number(n.id));
      const clickedId = Number(node.id);
      const ids =
        selectedIds.includes(clickedId) && selectedIds.length > 1 ? selectedIds : [clickedId];
      setContextMenu({ x: event.clientX, y: event.clientY, itemIds: ids });
    },
    [nodes],
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: (event as React.MouseEvent).clientX,
      y: (event as React.MouseEvent).clientY,
      itemIds: [],
    });
  }, []);

  const defaultViewport = useMemo(loadViewport, []);

  if (!items) return null;

  if (items.length === 0) {
    return (
      <div className="saved-canvas-empty">
        <Text variant="body-md" style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}>
          Save posts and comments to collect them here.
        </Text>
      </div>
    );
  }

  return (
    <div className="saved-canvas">
      <CanvasGrid
        ref={gridRef}
        opacity={0.15}
        spacing={16}
        crossSize={3.25}
        crossThickness={0.25}
        repulsion={0.25}
        rippleStrength={0.5}
      />
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onMoveEnd={(_event, viewport) => saveViewport(viewport)}
        defaultViewport={defaultViewport}
        fitView={items.every((i) => i.x == null)}
        panOnScroll
        zoomOnPinch
        multiSelectionKeyCode="Shift"
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
      ></ReactFlow>

      {contextMenu && (
        <div
          className="saved-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.itemIds.length === 0 && (
            <>
              <button
                className="saved-context-menu-item"
                onClick={() => {
                  const name = prompt('Group name:');
                  if (name?.trim()) createGroup.mutate(name.trim());
                  setContextMenu(null);
                }}
              >
                Create group
              </button>
              <button
                className="saved-context-menu-item"
                onClick={() => {
                  fitView({ duration: 300 });
                  setContextMenu(null);
                }}
              >
                Zoom to fit
              </button>
            </>
          )}
          {contextMenu.itemIds.length > 0 && (
            <>
              <div className="saved-context-menu-label">
                {contextMenu.itemIds.length > 1
                  ? `${contextMenu.itemIds.length} items`
                  : 'Move to...'}
              </div>
              {sortedGroups.map((group) => (
                <button
                  key={group.id}
                  className="saved-context-menu-item"
                  onClick={() => {
                    for (const id of contextMenu.itemIds) {
                      moveToGroup.mutate({ itemId: id, groupId: group.id! });
                    }
                    setContextMenu(null);
                  }}
                >
                  {group.name}
                </button>
              ))}
              {sortedGroups.length > 0 && (
                <button
                  className="saved-context-menu-item"
                  onClick={() => {
                    for (const id of contextMenu.itemIds) {
                      moveToGroup.mutate({ itemId: id, groupId: null });
                    }
                    setContextMenu(null);
                  }}
                >
                  Ungrouped
                </button>
              )}
              <button
                className="saved-context-menu-item"
                onClick={async () => {
                  const name = prompt('Group name:');
                  if (name?.trim()) {
                    const groupId = await createGroup.mutateAsync(name.trim());
                    for (const id of contextMenu.itemIds) {
                      moveToGroup.mutate({ itemId: id, groupId });
                    }
                  }
                  setContextMenu(null);
                }}
              >
                New group...
              </button>
              <div className="saved-context-menu-divider" />
              <button
                className="saved-context-menu-item saved-context-menu-danger"
                onClick={() => {
                  for (const id of contextMenu.itemIds) {
                    unsaveItem.mutate(id);
                  }
                  setContextMenu(null);
                }}
              >
                {contextMenu.itemIds.length > 1 ? 'Remove all' : 'Remove'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component (wraps with ReactFlowProvider)
// ---------------------------------------------------------------------------

interface SavedCollectionProps {
  onNavigate: (siteId: number, postId: number, commentId?: number | null) => void;
}

export default function SavedCollection({ onNavigate }: SavedCollectionProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner onNavigate={onNavigate} />
    </ReactFlowProvider>
  );
}
