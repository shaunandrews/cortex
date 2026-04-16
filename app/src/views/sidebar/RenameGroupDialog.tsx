import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Dialog, Button, Text, InputControl } from '@wordpress/ui';

type Mode = 'rename' | 'create';

type Props = {
  open: boolean;
  mode: Mode;
  initialName?: string;
  existingNames: string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

export default function RenameGroupDialog({
  open,
  mode,
  initialName = '',
  existingNames,
  onOpenChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, initialName]);

  const trimmed = name.trim();
  const norm = trimmed.toLowerCase();
  const initialNorm = initialName.trim().toLowerCase();
  const conflict =
    norm.length > 0 &&
    norm !== initialNorm &&
    existingNames.some((n) => n.trim().toLowerCase() === norm);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) {
      setError('Please enter a name.');
      return;
    }
    if (conflict) {
      setError('A group with that name already exists.');
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup size="small">
        <form onSubmit={handleSubmit} noValidate>
          <Dialog.Header>
            <Dialog.Title>
              {mode === 'rename' ? 'Rename group' : 'New group'}
            </Dialog.Title>
            <Dialog.CloseIcon label="Close" />
          </Dialog.Header>

          <div className="rename-group-body">
            <InputControl
              ref={inputRef}
              label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Team name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && (
              <Text
                variant="body-sm"
                style={{ color: 'var(--wpds-color-fg-content-error)' }}
                render={<p role="alert" />}
              >
                {error}
              </Text>
            )}
          </div>

          <Dialog.Footer>
            <Dialog.Action
              variant="outline"
              tone="neutral"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Dialog.Action>
            <Button
              variant="solid"
              tone="brand"
              type="submit"
              disabled={!trimmed || conflict}
            >
              {mode === 'rename' ? 'Save' : 'Create'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
