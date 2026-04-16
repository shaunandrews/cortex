import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  SelectionMode,
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

const nodeTypes: NodeTypes = {
  postCard: PostCard,
  commentCard: CommentCard,
};

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

interface ContextMenuState {
  x: number;
  y: number;
  itemId?: number;
  isCanvas?: boolean;
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  // Sync nodes when items change (new save, delete, etc.)
  useEffect(() => {
    if (!items) return;
    let autoIndex = 0;
    const next: Node[] = items.map((item) => {
      const hasPosition = item.x != null && item.y != null;
      const pos = hasPosition ? { x: item.x!, y: item.y! } : autoPlace(autoIndex++);

      return {
        id: String(item.id),
        type: item.type === 'post' ? 'postCard' : 'commentCard',
        position: pos,
        data: { item },
        style: { width: CARD_WIDTH },
      };
    });
    setNodes(next);
  }, [items, setNodes]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const id = Number(node.id);
      if (Number.isFinite(id)) {
        updatePosition.mutate({ id, x: node.position.x, y: node.position.y });
      }
    },
    [updatePosition],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const item = node.data.item as SavedItem;
      onNavigate(item.siteId, item.postId, item.commentId);
    },
    [onNavigate],
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      itemId: Number(node.id),
    });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: (event as React.MouseEvent).clientX,
      y: (event as React.MouseEvent).clientY,
      isCanvas: true,
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
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onMoveEnd={(_event, viewport) => saveViewport(viewport)}
        defaultViewport={defaultViewport}
        fitView={items.every((i) => i.x == null)}
        panOnScroll
        zoomOnPinch
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background gap={32} size={1.5} color="rgba(255, 255, 255, 0.08)" />
      </ReactFlow>

      {contextMenu && (
        <div
          className="saved-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isCanvas && (
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
          {contextMenu.itemId != null && (
            <>
              <div className="saved-context-menu-label">Move to...</div>
              {sortedGroups.map((group) => (
                <button
                  key={group.id}
                  className="saved-context-menu-item"
                  onClick={() => {
                    moveToGroup.mutate({ itemId: contextMenu.itemId!, groupId: group.id! });
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
                    moveToGroup.mutate({ itemId: contextMenu.itemId!, groupId: null });
                    setContextMenu(null);
                  }}
                >
                  Ungrouped
                </button>
              )}
              <button
                className="saved-context-menu-item"
                onClick={() => {
                  const name = prompt('Group name:');
                  if (name?.trim()) createGroup.mutate(name.trim());
                  setContextMenu(null);
                }}
              >
                New group...
              </button>
              <div className="saved-context-menu-divider" />
              <button
                className="saved-context-menu-item saved-context-menu-danger"
                onClick={() => {
                  unsaveItem.mutate(contextMenu.itemId!);
                  setContextMenu(null);
                }}
              >
                Remove
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
