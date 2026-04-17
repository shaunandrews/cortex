import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Text } from '@wordpress/ui';
import './PostRowCard.css';

export type PostRowCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'title'> & {
  /** Main post title. */
  title: ReactNode;
  /** Author display name. */
  author?: ReactNode;
  /** URL of the author's avatar. */
  authorAvatar?: string;
  /** Small site icon URL shown in the meta line. */
  siteIcon?: string;
  /** Site name shown in the meta line. */
  siteName?: ReactNode;
  /** Pre-formatted relative time string (caller handles formatting). */
  date?: ReactNode;
  /** Selected/current state — for detail pairing with a feed. */
  isSelected?: boolean;
};

const PostRowCard = forwardRef<HTMLButtonElement, PostRowCardProps>(function PostRowCard(
  { title, author, authorAvatar, siteIcon, siteName, date, isSelected, className, ...rest },
  ref,
) {
  const classes = ['post-row-card'];
  if (isSelected) classes.push('is-selected');
  if (className) classes.push(className);

  return (
    <button ref={ref} type="button" className={classes.join(' ')} {...rest}>
      {authorAvatar && (
        <img src={authorAvatar} alt="" className="post-row-card-avatar" aria-hidden="true" />
      )}
      <span className="post-row-card-body">
        <Text variant="body-md" className="post-row-card-title">
          {title}
        </Text>
        {(author || siteName || date) && (
          <Text variant="body-sm" className="post-row-card-meta">
            {siteIcon && <img src={siteIcon} alt="" className="post-row-card-site-icon" />}
            {siteName}
            {siteName && author ? ' · ' : null}
            {author}
            {(siteName || author) && date ? ' · ' : null}
            {date}
          </Text>
        )}
      </span>
    </button>
  );
});

export default PostRowCard;
