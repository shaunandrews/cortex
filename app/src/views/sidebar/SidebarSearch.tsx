import { type KeyboardEvent } from 'react';
import { IconButton } from '@wordpress/ui';
import { plus } from '@wordpress/icons';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onCreateP2: () => void;
};

export default function SidebarSearch({ value, onChange, onKeyDown, onCreateP2 }: Props) {
  return (
    <div className="sidebar-search">
      <div className="sidebar-search-field">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Filter sites..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button
            className="sidebar-search-clear"
            onClick={() => onChange('')}
            tabIndex={-1}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>
      <IconButton
        variant="minimal"
        tone="neutral"
        size="compact"
        icon={plus}
        label="New P2"
        className="sidebar-search-action"
        onClick={onCreateP2}
      />
    </div>
  );
}
