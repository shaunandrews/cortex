import { type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WPComSite } from '../../api/types';
import { MenuItem } from '../../components';

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `site-${site.ID}`,
    data: { type: 'site', siteId: site.ID, groupId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <MenuItem
      ref={setNodeRef}
      className={isDragging ? 'is-dragging' : undefined}
      icon={
        <span className="site-icon">
          {site.icon?.img ? (
            <img src={site.icon.img} alt="" />
          ) : (
            <span>{site.name.charAt(0).toUpperCase()}</span>
          )}
        </span>
      }
      label={site.name}
      count={unseen}
      isSelected={isSelected}
      isFocused={isFocused}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      style={style}
      data-index={dataIndex}
      data-site-id={site.ID}
      {...attributes}
      {...listeners}
      tabIndex={-1}
    />
  );
}
