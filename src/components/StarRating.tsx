import React from 'react';

type StarRatingProps = {
  rating: number; // Average rating (0-5)
  ratingCount?: number; // Number of ratings
  interactive?: boolean; // Whether the rating can be clicked to submit
  onRatingChange?: (rating: number) => void; // Callback when rating is clicked
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean; // Whether to show the rating count
};

export default function StarRating({
  rating,
  ratingCount = 0,
  interactive = false,
  onRatingChange,
  size = 'medium',
  showCount = true,
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);
  const [userRating, setUserRating] = React.useState<number | null>(null);

  const displayRating = hoveredRating ?? userRating ?? rating;
  const roundedRating = Math.round(displayRating * 2) / 2; // Round to nearest 0.5

  const sizeStyles = {
    small: { fontSize: '14px', gap: '2px' },
    medium: { fontSize: '18px', gap: '4px' },
    large: { fontSize: '24px', gap: '6px' },
  };

  const style = sizeStyles[size];

  const handleStarClick = (starValue: number) => {
    if (!interactive || !onRatingChange) return;
    setUserRating(starValue);
    onRatingChange(starValue);
  };

  const handleStarHover = (starValue: number | null) => {
    if (!interactive) return;
    setHoveredRating(starValue);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: style.gap,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          cursor: interactive ? 'pointer' : 'default',
        }}
        onMouseLeave={() => handleStarHover(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          // Use hovered rating if available, otherwise use the rounded rating
          const currentRating = hoveredRating ?? roundedRating;
          const isFull = star <= currentRating;
          const isHalf = star - 0.5 <= currentRating && star > currentRating;
          const isHovered = hoveredRating !== null && star <= hoveredRating;

          return (
            <span
              key={star}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleStarHover(star)}
              style={{
                fontSize: style.fontSize,
                color: isFull
                  ? '#fbbf24' // Gold color for filled stars
                  : isHalf
                  ? '#fbbf24' // Gold for half stars too
                  : isHovered && interactive
                  ? '#fcd34d' // Lighter gold on hover
                  : '#6b7280', // Gray for empty stars
                cursor: interactive ? 'pointer' : 'default',
                transition: 'color 0.15s ease',
                userSelect: 'none',
                lineHeight: 1,
                position: 'relative',
                display: 'inline-block',
              }}
              role={interactive ? 'button' : undefined}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            >
              {isHalf ? (
                <>
                  <span style={{ color: '#6b7280' }}>★</span>
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '50%',
                      overflow: 'hidden',
                      color: '#fbbf24',
                    }}
                  >
                    ★
                  </span>
                </>
              ) : (
                <span>{isFull ? '★' : '☆'}</span>
              )}
            </span>
          );
        })}
      </div>
      {showCount && (
        <span
          style={{
            fontSize: size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px',
            color: '#94a3b8',
            marginLeft: '4px',
          }}
        >
          {ratingCount > 0 ? (
            <>
              <strong style={{ color: '#e2e8f0' }}>{roundedRating.toFixed(1)}</strong>
              <span style={{ marginLeft: '4px' }}>({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})</span>
            </>
          ) : (
            <span style={{ color: '#64748b' }}>No ratings yet</span>
          )}
        </span>
      )}
    </div>
  );
}

