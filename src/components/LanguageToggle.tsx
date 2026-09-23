import React from 'react';
import { Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useLanguage } from '../context/Language';
import { colors } from '../theme';

type Props = {
  /** "compact" fits in a header; "full" is a wide button for forms/cards. */
  variant?: 'compact' | 'full';
  style?: StyleProp<ViewStyle>;
};

export default function LanguageToggle({ variant = 'compact', style }: Props) {
  const { language, toggleLanguage } = useLanguage();
  // Always label with the language you'd switch TO, written in that language.
  const label = language === 'en' ? 'עברית' : 'English';

  return (
    <TouchableOpacity
      onPress={toggleLanguage}
      style={[variant === 'compact' ? styles.compact : styles.full, style]}
      accessibilityRole="button"
      accessibilityLabel={language === 'en' ? 'Switch to Hebrew' : 'Switch to English'}
    >
      <Text style={variant === 'compact' ? styles.compactText : styles.fullText}>
        {variant === 'full' ? `🌐  ${label}` : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  compactText: { color: colors.primaryLight, fontWeight: '600', fontSize: 13 },
  full: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  fullText: { color: colors.primaryLight, fontWeight: '600', fontSize: 16 },
});
