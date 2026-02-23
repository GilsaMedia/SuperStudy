import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme';

type CityOption = { name: string; displayName: string; district?: string };

type CitySelectorProps = {
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
  placeholder?: string;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

async function searchCities(query: string): Promise<CityOption[]> {
  if (!query.trim() || query.trim().length < 2) return [];
  const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=il&addressdetails=1&limit=15&accept-language=en`;
  const res = await fetch(url, { headers: { 'User-Agent': 'SuperStudy/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  const seen = new Set<string>();
  const options: CityOption[] = [];
  (data || []).forEach((place: any) => {
    const address = place.address || {};
    const cityName =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      place.name;
    if (!cityName || address.country_code !== 'il') return;
    const key = cityName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const district = address.state || address.region || '';
    options.push({
      name: cityName,
      displayName: district ? `${cityName}, ${district}` : cityName,
      district,
    });
  });
  return options.slice(0, 12);
}

export default function CitySelector({
  value,
  onChange,
  placeholder = 'Select a city',
}: CitySelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!modalVisible) return;
    setSearchQuery('');
    setResults([]);
  }, [modalVisible]);

  useEffect(() => {
    if (!modalVisible) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchCities(searchQuery);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [modalVisible, searchQuery]);

  const handleSelect = (city: CityOption) => {
    onChange(city.name);
    setModalVisible(false);
  };

  const handleCancel = () => setModalVisible(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={value ? styles.triggerText : styles.triggerPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.triggerChevron}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View style={styles.modalCard} pointerEvents="box-none">
            <Text style={styles.modalTitle}>Choose city</Text>
            <Text style={styles.modalHint}>Search for a city in Israel (min. 2 letters)</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="e.g. Tel Aviv, Jerusalem..."
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.listWrap}>
              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : searchQuery.trim().length < 2 ? (
                <Text style={styles.emptyText}>Type at least 2 letters to search</Text>
              ) : results.length === 0 ? (
                <Text style={styles.emptyText}>No cities found. Try another search.</Text>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.name}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rowName}>{item.name}</Text>
                      {item.district ? (
                        <Text style={styles.rowDistrict}>{item.district}</Text>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(2,6,23,0.6)',
  },
  triggerText: { color: colors.text, fontSize: 16 },
  triggerPlaceholder: { color: colors.textDim, fontSize: 16 },
  triggerChevron: { color: colors.textDim, fontSize: 10 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalHint: { fontSize: 13, color: colors.textDim, marginBottom: 14 },
  searchInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  listWrap: { minHeight: 200, maxHeight: 320, marginBottom: 16 },
  list: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: colors.textDim, fontSize: 14 },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 40 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '500' },
  rowDistrict: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
