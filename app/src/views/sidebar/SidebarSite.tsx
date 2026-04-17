import { type MouseEvent, type PointerEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '@wordpress/ui';
import { starFilled, starEmpty } from '@wordpress/icons';
import type { WPComSite } from '../../api/types';
import { MenuItem, SiteIcon } from '../../components';

type Props = {
  site: WPComSite;
  groupId: string;
  unseen: number;
  isSelected: boolean;
  isFocused: boolean;
  isFavorite: boolean;
  dataIndex: number;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
};

export default function SidebarSite({
  site,
  groupId,
  unseen,
  isSelected,
  isFocused,
  isFavorite,
  dataIndex,
  onSelect,
  onToggleFavorite,
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
    <div
      ref={setNodeRef}
      className={`sidebar-site${isDragging ? ' is-dragging' : ''}`}
      style={style}
      data-index={dataIndex}
      data-site-id={site.ID}
      {...attributes}
      {...listeners}
      tabIndex={-1}
    >
      <MenuItem
        className={isDragging ? 'is-dragging' : undefined}
        icon={<SiteIcon name={site.name} src={site.icon?.img} />}
        label={site.name}
        count={unseen}
        isSelected={isSelected}
        isFocused={isFocused}
        onClick={onSelect}
        onContextMenu={onContextMenu}
        tabIndex={-1}
      />
      <IconButton
        className="sidebar-site-favorite"
        variant="minimal"
        tone="neutral"
        size="small"
        icon={isFavorite ? starFilled : starEmpty}
        label={isFavorite ? 'Unfavorite' : 'Favorite'}
        tabIndex={-1}
        onPointerDown={(e: PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      />
    </div>
  );
}
