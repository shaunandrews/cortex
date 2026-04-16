import { type MouseEvent, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Group } from '../../hooks/useSidebarGroups';
import { GroupHeader } from '../../components';

type Props = {
  group: Group;
  onToggle: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
};

export default function SidebarGroupHeader({ group, onToggle, onContextMenu }: Props) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: `group-header-${group.id}`,
    data: { type: 'group-header', groupId: group.id },
    disabled: group.kind !== 'custom',
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  function handleKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(e as unknown as MouseEvent<HTMLElement>);
    }
  }

  return (
    <GroupHeader
      ref={setNodeRef}
      label={group.name}
      isOpen={!group.collapsed}
      isDragging={isDragging}
      onClick={onToggle}
      onKeyDown={handleKey}
      onContextMenu={onContextMenu}
      style={style}
      {...attributes}
      {...listeners}
    />
  );
}
