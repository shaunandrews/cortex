import { type MouseEvent } from 'react';
import { Text } from '@wordpress/ui';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WPComSite } from '../../api/types';

type Props = {
  site: WPComSite;
  groupId: string;
  unseen: number;
  isSelected: boolean;
  isFocused: boolean;
  dataIndex: number;
  onSelect: () => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
};

export default function SidebarSite({
  site,
  groupId,
  unseen,
  isSelected,
  isFocused,
  dataIndex,
  onSelect,
  onContextMenu,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `site-${site.ID}`,
    data: { type: 'site', siteId: site.ID, groupId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      data-index={dataIndex}
      data-site-id={site.ID}
      className={`sidebar-item${isSelected ? ' is-selected' : ''}${isFocused ? ' is-focused' : ''}${isDragging ? ' is-dragging' : ''}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={-1}
    >
      <div className="sidebar-item-icon">
        {site.icon?.img ? <img src={site.icon.img} alt="" /> : <span>{site.name.charAt(0)}</span>}
      </div>
      <Text variant="body-md" className="sidebar-item-name">
        {site.name}
      </Text>
      {unseen > 0 && <span className="unseen-badge">{unseen}</span>}
    </button>
  );
}
