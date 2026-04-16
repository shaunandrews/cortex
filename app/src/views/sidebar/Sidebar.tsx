import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { WPComSite } from '../../api/types';
import type { Group, useSidebarGroups } from '../../hooks/useSidebarGroups';
import { EmptyState, MenuItem, SiteIcon } from '../../components';
import SidebarNav from './SidebarNav';
import SidebarSearch from './SidebarSearch';
import SidebarGroup from './SidebarGroup';
import GroupContextMenu from './GroupContextMenu';
import SiteContextMenu from './SiteContextMenu';
import RenameGroupDialog from './RenameGroupDialog';
import { FAVORITES_GROUP_ID } from '../../hooks/useSidebarGroups';

type Store = ReturnType<typeof useSidebarGroups>;

type Props = {
  store: Store;
  sites: WPComSite[] | undefined;
  unseenMap: Map<number, number>;
  selectedSiteId: number | null;
  isHome: boolean;
  isSaved: boolean;
  onSelectSite: (siteId: number) => void;
  onGoHome: () => void;
  onGoSaved: () => void;
  onCreateP2: () => void;
  onOpenSite: (site: WPComSite) => void;
  onMarkAllRead: (siteId: number) => void;
  footer?: ReactNode;
};

export default function Sidebar({
  store,
  sites,
  unseenMap,
  selectedSiteId,
  isHome,
  isSaved,
  onSelectSite,
  onGoHome,
  onGoSaved,
  onCreateP2,
  onOpenSite,
  onMarkAllRead,
  footer,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Context menu state — single state for whichever menu is open.
  const [groupMenu, setGroupMenu] = useState<{
    anchor: { x: number; y: number };
    groupId: string;
  } | null>(null);
  const [siteMenu, setSiteMenu] = useState<{
    anchor: { x: number; y: number };
    siteId: number;
  } | null>(null);

  // Rename/create dialog state.
  type DialogState =
    | { mode: 'rename'; groupId: string }
    | { mode: 'create' }
    | { mode: 'create-and-move'; siteId: number }
    | null;
  const [dialog, setDialog] = useState<DialogState>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeDrag, setActiveDrag] = useState<
    { type: 'site'; site: WPComSite } | { type: 'group-header'; group: Group } | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Reset focus when search changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFocusedIndex(-1), [searchQuery]);

  // Scroll focused row into view.
  useEffect(() => {
    if (focusedIndex < 0) return;
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  const visible = store.visibleGroups;

  // Apply search filter to the store via a synchronised memo. The store
  // doesn't know about the search query unless we pass it — but here the
  // Sidebar owns the query, and filters visibleGroups locally to keep the
  // store API small.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visible;
    const result: typeof visible = [];
    for (const entry of visible) {
      const matching = entry.sites.filter((s) => s.name.toLowerCase().includes(q));
      if (matching.length > 0) {
        result.push({ group: entry.group, sites: matching });
      }
    }
    return result;
  }, [visible, searchQuery]);

  const filteredFlat = useMemo(() => {
    const flat: WPComSite[] = [];
    for (const entry of filtered) {
      if (entry.group.collapsed) continue;
      flat.push(...entry.sites);
    }
    return flat;
  }, [filtered]);

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filteredFlat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const site = filteredFlat[focusedIndex < 0 ? 0 : focusedIndex];
      if (site) onSelectSite(site.ID);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  }

  function handleGroupContextMenu(groupId: string, e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSiteMenu(null);
    setGroupMenu({ anchor: { x: e.clientX, y: e.clientY }, groupId });
  }

  function handleSiteContextMenu(siteId: number, e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setGroupMenu(null);
    setSiteMenu({ anchor: { x: e.clientX, y: e.clientY }, siteId });
  }

  function handleHeaderClick(group: Group, e: MouseEvent<HTMLElement>) {
    if (e.altKey) {
      store.toggleAllCollapsed();
    } else {
      store.toggleCollapse(group.id);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { type: 'site'; siteId: number; groupId: string }
      | { type: 'group-header'; groupId: string }
      | undefined;
    if (!data) return;
    if (data.type === 'site') {
      const site = sites?.find((s) => s.ID === data.siteId);
      if (site) setActiveDrag({ type: 'site', site });
    } else if (data.type === 'group-header') {
      const group = store.groups.find((g) => g.id === data.groupId);
      if (group) setActiveDrag({ type: 'group-header', group });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as
      | { type: 'site'; siteId: number; groupId: string }
      | { type: 'group-header'; groupId: string }
      | undefined;
    const overData = over.data.current as
      | { type: 'site'; siteId: number; groupId: string }
      | { type: 'group'; groupId: string }
      | { type: 'group-header'; groupId: string }
      | undefined;
    if (!activeData || !overData) return;

    if (activeData.type === 'site') {
      const { siteId, groupId: fromGroupId } = activeData;

      if (overData.type === 'group' || overData.type === 'group-header') {
        const toGroupId = overData.groupId;
        if (toGroupId !== fromGroupId) {
          store.moveSite(siteId, toGroupId);
        }
        return;
      }

      if (overData.type === 'site') {
        const overGroupId = overData.groupId;
        if (overGroupId === fromGroupId) {
          // Same-group reorder — only applies when sort mode is custom.
          const group = store.groups.find((g) => g.id === fromGroupId);
          if (!group || group.sortMode !== 'custom') return;
          const listIds = (store.sitesByGroup.get(fromGroupId) ?? []).map((s) => s.ID);
          const oldIdx = listIds.indexOf(siteId);
          const newIdx = listIds.indexOf(overData.siteId);
          if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
          store.reorderSitesInGroup(fromGroupId, arrayMove(listIds, oldIdx, newIdx));
        } else {
          const sitesInTarget = store.sitesByGroup.get(overGroupId) ?? [];
          const idx = sitesInTarget.findIndex((s) => s.ID === overData.siteId);
          store.moveSite(siteId, overGroupId, idx >= 0 ? idx : undefined);
        }
        return;
      }
    }

    if (activeData.type === 'group-header') {
      if (overData.type !== 'group-header') return;
      const activeId = activeData.groupId;
      const overId = overData.groupId;
      if (activeId === overId) return;
      const customIds = store.groups.filter((g) => g.kind === 'custom').map((g) => g.id);
      const oldIdx = customIds.indexOf(activeId);
      const newIdx = customIds.indexOf(overId);
      if (oldIdx === -1 || newIdx === -1) return;
      store.reorderGroups(arrayMove(customIds, oldIdx, newIdx));
    }
  }

  const activeGroup = groupMenu
    ? (store.groups.find((g) => g.id === groupMenu.groupId) ?? null)
    : null;
  const activeSite = siteMenu ? (sites?.find((s) => s.ID === siteMenu.siteId) ?? null) : null;
  const activeSiteGroupId = activeSite ? (store.membership[activeSite.ID] ?? 'sites') : 'sites';

  const dialogInitialName =
    dialog?.mode === 'rename'
      ? (store.groups.find((g) => g.id === dialog.groupId)?.name ?? '')
      : '';
  const existingNames = store.groups.map((g) => g.name);

  const startIndices = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const entry of filtered) {
      map.set(entry.group.id, idx);
      if (!entry.group.collapsed) idx += entry.sites.length;
    }
    return map;
  }, [filtered]);

  return (
    <aside className="sidebar">
      <SidebarNav isHome={isHome} isSaved={isSaved} onGoHome={onGoHome} onGoSaved={onGoSaved} />
      <SidebarSearch
        value={searchQuery}
        onChange={setSearchQuery}
        onKeyDown={handleSearchKeyDown}
        onCreateP2={onCreateP2}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="sidebar-groups" ref={scrollRef}>
          {filtered.length === 0 && searchQuery ? (
            <EmptyState message="No matches" />
          ) : (
            <SortableContext
              items={filtered.map((e) => `group-header-${e.group.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {filtered.map((entry) => (
                <SidebarGroup
                  key={entry.group.id}
                  group={entry.group}
                  sites={entry.sites}
                  unseenMap={unseenMap}
                  selectedSiteId={selectedSiteId}
                  focusedIndex={focusedIndex}
                  startIndex={startIndices.get(entry.group.id) ?? 0}
                  onSelectSite={onSelectSite}
                  onToggleCollapse={(e) => handleHeaderClick(entry.group, e)}
                  onGroupContextMenu={(e) => handleGroupContextMenu(entry.group.id, e)}
                  onSiteContextMenu={handleSiteContextMenu}
                />
              ))}
            </SortableContext>
          )}
        </div>
        <DragOverlay>
          {activeDrag?.type === 'site' && (
            <MenuItem
              className="is-dragging-overlay"
              icon={<SiteIcon name={activeDrag.site.name} src={activeDrag.site.icon?.img} />}
              label={activeDrag.site.name}
              tabIndex={-1}
              aria-hidden="true"
            />
          )}
          {activeDrag?.type === 'group-header' && (
            <div className="sidebar-group-header is-dragging-overlay">
              <span className="sidebar-group-name">{activeDrag.group.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <GroupContextMenu
        anchor={groupMenu?.anchor ?? null}
        group={activeGroup}
        onClose={() => setGroupMenu(null)}
        onRename={() => activeGroup && setDialog({ mode: 'rename', groupId: activeGroup.id })}
        onDelete={() => activeGroup && store.deleteGroup(activeGroup.id)}
        onToggleCollapse={() => activeGroup && store.toggleCollapse(activeGroup.id)}
        onToggleShowUnread={() => activeGroup && store.toggleShowUnread(activeGroup.id)}
        onSetSort={(mode) => activeGroup && store.setSort(activeGroup.id, mode)}
        onNewGroup={() => setDialog({ mode: 'create' })}
      />

      <SiteContextMenu
        anchor={siteMenu?.anchor ?? null}
        site={activeSite}
        currentGroupId={activeSiteGroupId}
        groups={store.groups}
        unseen={activeSite ? (unseenMap.get(activeSite.ID) ?? 0) : 0}
        onClose={() => setSiteMenu(null)}
        onToggleFavorite={() => activeSite && store.toggleFavorite(activeSite.ID)}
        onMoveTo={(groupId) => activeSite && store.moveSite(activeSite.ID, groupId)}
        onNewGroupAndMove={() =>
          activeSite && setDialog({ mode: 'create-and-move', siteId: activeSite.ID })
        }
        onOpenSite={() => activeSite && onOpenSite(activeSite)}
        onMarkAllRead={() => activeSite && onMarkAllRead(activeSite.ID)}
      />

      {footer}

      <RenameGroupDialog
        open={dialog !== null}
        mode={dialog?.mode === 'rename' ? 'rename' : 'create'}
        initialName={dialogInitialName}
        existingNames={existingNames}
        onOpenChange={(next) => {
          if (!next) setDialog(null);
        }}
        onSubmit={(name) => {
          if (!dialog) return;
          if (dialog.mode === 'rename') {
            store.renameGroup(dialog.groupId, name);
          } else if (dialog.mode === 'create') {
            store.createGroup(name);
          } else if (dialog.mode === 'create-and-move') {
            const created = store.createGroup(name);
            if (created) store.moveSite(dialog.siteId, created.id);
          }
          setDialog(null);
        }}
      />
    </aside>
  );
}

// Re-export for external ergonomics.
export { FAVORITES_GROUP_ID };
