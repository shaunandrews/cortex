import { useState, useEffect, useRef } from 'react';
import { Dialog, Button, Text, InputControl } from '@wordpress/ui';
import { deriveSlug, validateSlugShape } from '../lib/slug';
import { useCreateP2 } from '../hooks/useCreateP2';
import { useSlugAvailability } from '../hooks/useSlugAvailability';
import type { CreateP2Response } from '../api/types';

interface CreateP2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (site: CreateP2Response) => void;
}

export function CreateP2Dialog({ open, onOpenChange, onCreated }: CreateP2DialogProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const availability = useSlugAvailability(slug);
  const create = useCreateP2({
    onCreated: (site) => {
      reset();
      onCreated(site);
    },
  });

  useEffect(() => {
    if (!open) return;
    // Autofocus the title field when the dialog opens.
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open]);

  function reset() {
    setTitle('');
    setSlug('');
    setSlugEdited(false);
    setSubmitError(null);
    create.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(deriveSlug(value));
  }

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase());
    setSlugEdited(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const shape = validateSlugShape(slug);
    if (!shape.ok) {
      setSubmitError(shape.message);
      return;
    }

    create.mutate(
      { blog_name: slug, blog_title: trimmedTitle },
      {
        onError: (err) => {
          const raw = err instanceof Error ? err.message : 'Something went wrong.';
          if (/taken|exists|in use|blog_name_exists/i.test(raw)) {
            setSubmitError('That address is already taken. Try another.');
          } else {
            setSubmitError(raw);
          }
        },
      },
    );
  }

  const titleOk = title.trim().length > 0;
  const slugReady = availability.status === 'available';
  const canSubmit = titleOk && slugReady && !create.isPending;

  let slugDetail: string | undefined;
  if (availability.status === 'invalid' || availability.status === 'taken') {
    slugDetail = availability.message;
  } else if (availability.status === 'checking') {
    slugDetail = `Checking ${slug}.wordpress.com…`;
  } else if (availability.status === 'available' && slug.length > 0) {
    slugDetail = `${slug}.wordpress.com is available.`;
  } else if (slug.length > 0) {
    slugDetail = `${slug}.wordpress.com`;
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Popup size="small">
        <form onSubmit={handleSubmit} noValidate>
          <Dialog.Header>
            <Dialog.Title>Create a new P2</Dialog.Title>
            <Dialog.CloseIcon label="Close" />
          </Dialog.Header>

          <div className="create-p2-body">
            <InputControl
              ref={titleRef}
              label="Name"
              description="The display name for your new P2."
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Team retro"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            <InputControl
              label="Address"
              description={slugDetail ?? 'Only lowercase letters, numbers, and hyphens.'}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="team-retro"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            {submitError && (
              <Text
                variant="body-sm"
                style={{ color: 'var(--wpds-color-fg-content-error)' }}
                render={<p role="alert" />}
              >
                {submitError}
              </Text>
            )}
          </div>

          <Dialog.Footer>
            <Dialog.Action
              variant="outline"
              tone="neutral"
              type="button"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Dialog.Action>
            <Button
              variant="solid"
              tone="brand"
              type="submit"
              loading={create.isPending}
              disabled={!canSubmit}
            >
              Create P2
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
