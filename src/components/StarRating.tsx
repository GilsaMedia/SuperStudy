import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

type StarRatingProps = {
  rating: number;
  ratingCount?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  userRating?: number;
};

const sizes = { small: 14, medium: 18, large: 24 };

export default function StarRating({
  rating,
  ratingCount = 0,
  interactive = false,
  onRatingChange,
  size = 'medium',
  showCount = true,
  userRating: initialUserRating,
}: StarRatingProps) {
  const [userRating, setUserRating] = React.useState<number | null>(initialUserRating ?? null);
  React.useEffect(() => {
    if (initialUserRating !== undefined) setUserRating(initialUserRating);
  }, [initialUserRating]);

  const displayRating = userRating ?? rating;
  const roundedRating = Math.round(displayRating * 2) / 2;
  const px = sizes[size];

  const handleStarPress = (starValue: number) => {
    if (!interactive || !onRatingChange) return;
    setUserRating(starValue);
    onRatingChange(starValue);
  };

  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = star <= roundedRating;
          const isHalf = star - 0.5 <= roundedRating && star > roundedRating;
          return (
            <Pressable
              key={star}
              onPress={() => handleStarPress(star)}
              disabled={!interactive}
              style={({ pressed }) => [{ opacity: pressed && interactive ? 0.7 : 1 }]}
            >
              <Text style={[styles.star, { fontSize: px }, isHalf && !isFull && styles.starHalf]}>
                {isFull ? '★' : isHalf ? '★' : '☆'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {showCount && (
        <Text style={[styles.count, { fontSize: size === 'small' ? 12 : 14 }]}>
          {ratingCount > 0 ? (
            <>
              <Text style={styles.countBold}>{(Math.round(rating * 2) / 2).toFixed(1)}</Text>
              {' '}({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
            </>
          ) : (
            <Text style={styles.countMuted}>No ratings yet</Text>
          )}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { color: colors.gold },
  starHalf: { opacity: 0.45 },
  count: { color: colors.textDim, marginLeft: 4 },
  countBold: { color: colors.text, fontWeight: '600' },
  countMuted: { color: '#64748b' },
});
