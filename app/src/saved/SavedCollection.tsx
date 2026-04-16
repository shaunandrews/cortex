import { useState, useMemo, useRef, useEffect } from 'react';
import { Text, Icon, IconButton } from '@wordpress/ui';
import { plus, archive } from '@wordpress/icons';
import {
  useSavedItems,
  useSavedGroups,
  useUnsaveItem,
  useMoveToGroup,
  useCreateGroup,
  useRenameGroup,
  useDeleteGroup,
} from './useSavedItems';
import type { SavedItem, SavedGroup, PostSnapshot, CommentSnapshot } from './types';
import { relativeTime } from '../lib/relativeTime';

function decodeEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

interface SavedCollectionProps {
  onNavigate: (siteId: number, postId: number, commentId?: number | null) => void;
}

export default function SavedCollection({ onNavigate }: SavedCollectionProps) {
  const { data: items } = useSavedItems();
  const { data: groups } = useSavedGroups();
  const unsaveItem = useUnsaveItem();
  const moveToGroup = useMoveToGroup();
  const createGroup = useCreateGroup();
  const renameGroup = useRenameGroup();
  const deleteGroup = useDeleteGroup();

  const [selectedGroupId, setSelectedGroupId] = useState<number | null | 'all'>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    type: 'group' | 'item';
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingGroup && newGroupInputRef.current) {
      newGroupInputRef.current.focus();
    }
  }, [creatingGroup]);

  useEffect(() => {
    if (renamingGroupId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingGroupId]);

  // Close context menu on click outside
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

  const filteredItems = useMemo(() => {
    if (!items) return [];

    let filtered = items;
    if (selectedGroupId !== 'all') {
      filtered = filtered.filter((item) => item.groupId === selectedGroupId);
    }

    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const snap = item.snapshot;
        const title =
          item.type === 'post' ? (snap as PostSnapshot).title : (snap as CommentSnapshot).postTitle;
        const content = stripHtml(snap.content);
        const author = snap.authorName;
        const site = snap.siteName;
        const tags = item.tags.join(' ');
        return (
          title.toLowerCase().includes(q) ||
          content.toLowerCase().includes(q) ||
          author.toLowerCase().includes(q) ||
          site.toLowerCase().includes(q) ||
          tags.toLowerCase().includes(q)
        );
      });
    }

    return [...filtered].sort((a, b) => b.savedAt - a.savedAt);
  }, [items, selectedGroupId, filterQuery]);

  const groupCounts = useMemo(() => {
    const counts = new Map<number | null, number>();
    if (items) {
      for (const item of items) {
        counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const totalCount = items?.length ?? 0;

  function handleCreateGroup() {
    if (!newGroupName.trim()) {
      setCreatingGroup(false);
      return;
    }
    createGroup.mutate(newGroupName.trim());
    setNewGroupName('');
    setCreatingGroup(false);
  }

  function handleRenameGroup(group: SavedGroup) {
    if (!renameValue.trim() || renameValue.trim() === group.name) {
      setRenamingGroupId(null);
      return;
    }
    renameGroup.mutate({ group, name: renameValue.trim() });
    setRenamingGroupId(null);
  }

  function handleGroupContextMenu(e: React.MouseEvent, groupId: number) {
    e.preventDefault();
    setContextMenu({ type: 'group', id: groupId, x: e.clientX, y: e.clientY });
  }

  function handleItemContextMenu(e: React.MouseEvent, itemId: number) {
    e.preventDefault();
    setContextMenu({ type: 'item', id: itemId, x: e.clientX, y: e.clientY });
  }

  function getItemTitle(item: SavedItem): string {
    if (item.type === 'post') {
      return decodeEntities((item.snapshot as PostSnapshot).title);
    }
    return `Re: ${decodeEntities((item.snapshot as CommentSnapshot).postTitle)}`;
  }

  function getItemExcerpt(item: SavedItem): string {
    if (item.type === 'post') {
      return stripHtml((item.snapshot as PostSnapshot).excerpt) || stripHtml(item.snapshot.content);
    }
    return stripHtml(item.snapshot.content);
  }

  return (
    <div className="saved-collection">
      {/* Groups sidebar */}
      <div className="saved-groups">
        <div className="saved-groups-header">
          <Text
            variant="body-sm"
            style={{
              fontWeight: 'var(--wpds-typography-font-weight-medium)' as unknown as number,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--wpds-color-fg-content-neutral-weak)',
              fontSize: '11px',
            }}
          >
            Groups
          </Text>
          <IconButton
            icon={plus}
            label="Create group"
            variant="unstyled"
            size="small"
            onClick={() => setCreatingGroup(true)}
            className="saved-groups-add"
          />
        </div>
        <div className="saved-groups-list">
          <button
            className={`saved-group-item${selectedGroupId === 'all' ? ' is-selected' : ''}`}
            onClick={() => setSelectedGroupId('all')}
          >
            <span className="saved-group-name">All saved</span>
            <span className="saved-group-count">{totalCount}</span>
          </button>
          {sortedGroups.map((group) => (
            <button
              key={group.id}
              className={`saved-group-item${selectedGroupId === group.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedGroupId(group.id!)}
              onContextMenu={(e) => handleGroupContextMenu(e, group.id!)}
            >
              {renamingGroupId === group.id ? (
                <input
                  ref={renameInputRef}
                  className="saved-group-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameGroup(group);
                    if (e.key === 'Escape') setRenamingGroupId(null);
                  }}
                  onBlur={() => handleRenameGroup(group)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="saved-group-name">{group.name}</span>
              )}
              <span className="saved-group-count">{groupCounts.get(group.id!) ?? 0}</span>
            </button>
          ))}
          {creatingGroup && (
            <div className="saved-group-item">
              <input
                ref={newGroupInputRef}
                className="saved-group-rename-input"
                value={newGroupName}
                placeholder="Group name..."
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup();
                  if (e.key === 'Escape') setCreatingGroup(false);
                }}
                onBlur={handleCreateGroup}
              />
            </div>
          )}
          <button
            className={`saved-group-item saved-group-ungrouped${selectedGroupId === null ? ' is-selected' : ''}`}
            onClick={() => setSelectedGroupId(null)}
          >
            <span className="saved-group-name">Ungrouped</span>
            <span className="saved-group-count">{groupCounts.get(null) ?? 0}</span>
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="saved-items">
        <header className="saved-items-header">
          <Text variant="heading-lg" render={<h2 />}>
            {selectedGroupId === 'all'
              ? 'All saved'
              : selectedGroupId === null
                ? 'Ungrouped'
                : (sortedGroups.find((g) => g.id === selectedGroupId)?.name ?? '')}
          </Text>
          <input
            type="text"
            className="saved-items-filter"
            placeholder="Filter..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </header>

        <div className="saved-items-list">
          {filteredItems.length === 0 ? (
            <div className="saved-items-empty">
              <Text
                variant="body-md"
                style={{ color: 'var(--wpds-color-fg-content-neutral-weak)' }}
              >
                {totalCount === 0
                  ? 'Nothing saved yet. Use the bookmark button on posts and comments to save them here.'
                  : filterQuery
                    ? 'No items match your filter.'
                    : 'No items in this group.'}
              </Text>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="saved-item"
                onClick={() => onNavigate(item.siteId, item.postId, item.commentId)}
                onContextMenu={(e) => handleItemContextMenu(e, item.id!)}
              >
                <Icon icon={archive} size={16} className="saved-item-icon" />
                <div className="saved-item-body">
                  <div className="saved-item-title-row">
                    <span className="saved-item-title">{getItemTitle(item)}</span>
                    <span
                      className={`saved-item-badge${item.type === 'comment' ? ' is-comment' : ''}`}
                    >
                      {item.type}
                    </span>
                  </div>
                  <div className="saved-item-meta">
                    <span className="saved-item-author">{item.snapshot.authorName}</span>
                    <span className="saved-item-sep">&middot;</span>
                    <span>{item.snapshot.siteName}</span>
                    <span className="saved-item-sep">&middot;</span>
                    <span>{relativeTime(new Date(item.savedAt).toISOString())}</span>
                  </div>
                  <div className="saved-item-excerpt">{getItemExcerpt(item)}</div>
                  {item.tags.length > 0 && (
                    <div className="saved-item-tags">
                      {item.tags.map((tag) => (
                        <span key={tag} className="saved-item-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="saved-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'group' && (
            <>
              <button
                className="saved-context-menu-item"
                onClick={() => {
                  const group = sortedGroups.find((g) => g.id === contextMenu.id);
                  if (group) {
                    setRenameValue(group.name);
                    setRenamingGroupId(contextMenu.id);
                  }
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                className="saved-context-menu-item saved-context-menu-danger"
                onClick={() => {
                  deleteGroup.mutate(contextMenu.id);
                  if (selectedGroupId === contextMenu.id) setSelectedGroupId('all');
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
          {contextMenu.type === 'item' && (
            <>
              {sortedGroups.length > 0 && (
                <>
                  <div className="saved-context-menu-label">Move to...</div>
                  {sortedGroups.map((group) => (
                    <button
                      key={group.id}
                      className="saved-context-menu-item"
                      onClick={() => {
                        moveToGroup.mutate({ itemId: contextMenu.id, groupId: group.id! });
                        setContextMenu(null);
                      }}
                    >
                      {group.name}
                    </button>
                  ))}
                  <button
                    className="saved-context-menu-item"
                    onClick={() => {
                      moveToGroup.mutate({ itemId: contextMenu.id, groupId: null });
                      setContextMenu(null);
                    }}
                  >
                    Ungrouped
                  </button>
                  <div className="saved-context-menu-divider" />
                </>
              )}
              <button
                className="saved-context-menu-item saved-context-menu-danger"
                onClick={() => {
                  unsaveItem.mutate(contextMenu.id);
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
