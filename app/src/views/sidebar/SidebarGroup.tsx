import { type MouseEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Group } from '../../hooks/useSidebarGroups';
import type { WPComSite } from '../../api/types';
import SidebarGroupHeader from './SidebarGroupHeader';
import SidebarSite from './SidebarSite';

type Props = {
  group: Group;
  sites: WPComSite[];
  unseenMap: Map<number, number>;
  starredIds: Set<number>;
  selectedSiteId: number | null;
  focusedIndex: number;
  startIndex: number;
  onSelectSite: (siteId: number) => void;
  onToggleFavorite: (siteId: number) => void;
  onToggleCollapse: (e: MouseEvent<HTMLElement>) => void;
  onGroupContextMenu: (e: MouseEvent<HTMLElement>) => void;
  onSiteContextMenu: (siteId: number, e: MouseEvent<HTMLElement>) => void;
};

export default function SidebarGroup({
  group,
  sites,
  unseenMap,
  starredIds,
  selectedSiteId,
  focusedIndex,
  startIndex,
  onSelectSite,
  onToggleFavorite,
  onToggleCollapse,
  onGroupContextMenu,
  onSiteContextMenu,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`sidebar-group${isOver ? ' is-drop-target' : ''}`}
      data-group-id={group.id}
    >
      <SidebarGroupHeader
        group={group}
        onToggle={onToggleCollapse}
        onContextMenu={onGroupContextMenu}
      />
      <div className={`collapsible${!group.collapsed ? ' is-open' : ''}`}>
        <div className="collapsible-body">
          <div className="sidebar-group-body">
            <SortableContext
              items={sites.map((s) => `site-${s.ID}`)}
              strategy={verticalListSortingStrategy}
            >
              {sites.map((site, i) => (
                <SidebarSite
                  key={site.ID}
                  site={site}
                  groupId={group.id}
                  unseen={group.showUnread ? (unseenMap.get(site.ID) ?? 0) : 0}
                  isSelected={site.ID === selectedSiteId}
                  isFocused={startIndex + i === focusedIndex}
                  isFavorite={starredIds.has(site.ID)}
                  dataIndex={startIndex + i}
                  onSelect={() => onSelectSite(site.ID)}
                  onToggleFavorite={() => onToggleFavorite(site.ID)}
                  onContextMenu={(e) => onSiteContextMenu(site.ID, e)}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      </div>
    </div>
  );
}
