import { type MouseEvent, type KeyboardEvent } from 'react';
import { Icon, Text } from '@wordpress/ui';
import { chevronRight } from '@wordpress/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Group } from '../../hooks/useSidebarGroups';

type Props = {
  group: Group;
  siteCount: number;
  onToggle: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
};

export default function SidebarGroupHeader({
  group,
  siteCount,
  onToggle,
  onContextMenu,
}: Props) {
  const sortable = useSortable({
    id: `group-header-${group.id}`,
    data: { type: 'group-header', groupId: group.id },
    disabled: group.kind !== 'custom',
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : undefined,
  };

  function handleKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(e as unknown as MouseEvent<HTMLElement>);
    }
  }

  return (
    <button
      type="button"
      ref={sortable.setNodeRef}
      className={`sidebar-group-header${group.collapsed ? ' is-collapsed' : ''}${sortable.isDragging ? ' is-dragging' : ''}`}
      onClick={onToggle}
      onKeyDown={handleKey}
      onContextMenu={onContextMenu}
      aria-expanded={!group.collapsed}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <span className="sidebar-group-caret" aria-hidden="true">
        <Icon icon={chevronRight} size={16} />
      </span>
      <Text variant="body-sm" className="sidebar-group-name">
        {group.name}
      </Text>
      <Text variant="body-sm" className="sidebar-group-count">
        {siteCount}
      </Text>
    </button>
  );
}
