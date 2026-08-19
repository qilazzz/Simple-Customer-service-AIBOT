import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { OutletsApi } from '../api/outletsApi';
import { API_BASE_URL } from '../support/config';

export default function OutletsScreen() {
  const api = useMemo(() => new OutletsApi(API_BASE_URL), []);
  const [states, setStates] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOutlets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listOutlets({
        state: selectedState || undefined,
        search: debouncedSearch || undefined,
      });
      setOutlets(data.outlets || []);
    } catch (err) {
      setError(err.message || 'Could not load outlets.');
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }, [api, debouncedSearch, selectedState]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listStates();
        setStates(data.states || []);
      } catch (err) {
        setError(err.message || 'Could not load outlet states.');
      }
    })();
  }, [api]);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const openMaps = (outlet) => {
    if (outlet.location_url) {
      Linking.openURL(outlet.location_url);
      return;
    }
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(outlet.address)}`,
    );
  };

  const callOutlet = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const renderOutlet = ({ item }) => (
    <Pressable style={styles.card} onPress={() => openMaps(item)}>
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardMeta}>
        {item.city}, {item.state}
      </Text>
      <Text style={styles.cardAddress}>{item.address}</Text>
      {item.opening_hours ? (
        <Text style={styles.cardHours}>🕐 {item.opening_hours}</Text>
      ) : null}
      <View style={styles.cardActions}>
        {item.phone ? (
          <Pressable style={styles.actionBtn} onPress={() => callOutlet(item.phone)}>
            <Text style={styles.actionBtnText}>📞 Call</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={() => openMaps(item)}>
          <Text style={styles.actionBtnText}>📍 Directions</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search outlet, city, or address..."
          placeholderTextColor="#a1a1aa"
          returnKeyType="search"
          onSubmitEditing={loadOutlets}
        />
      </View>

      <View style={styles.stateFilterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stateScroll}
          contentContainerStyle={styles.stateRow}
        >
          <Pressable
            style={[styles.stateChip, !selectedState && styles.stateChipActive]}
            onPress={() => setSelectedState('')}
          >
            <Text style={[styles.stateChipText, !selectedState && styles.stateChipTextActive]}>
              All
            </Text>
          </Pressable>
          {states.map((state) => (
            <Pressable
              key={state}
              style={[styles.stateChip, selectedState === state && styles.stateChipActive]}
              onPress={() => setSelectedState(state)}
            >
              <Text
                style={[
                  styles.stateChipText,
                  selectedState === state && styles.stateChipTextActive,
                ]}
              >
                {state}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#c8102e" />
      ) : error ? (
        <View style={styles.messageBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadOutlets}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={outlets}
          keyExtractor={(item) => item.outlet_id}
          contentContainerStyle={styles.list}
          renderItem={renderOutlet}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No outlets found for your search.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  searchBar: { padding: 16, paddingBottom: 8, backgroundColor: '#fff' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#18181b',
    backgroundColor: '#fafafa',
  },
  stateFilterBar: {
    height: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  stateScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  stateChip: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 36,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  stateChipActive: {
    backgroundColor: '#c8102e',
    borderColor: '#c8102e',
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525b',
    textAlign: 'center',
    includeFontPadding: false,
  },
  stateChipTextActive: { color: '#fff' },
  loader: { marginTop: 32 },
  messageBox: { padding: 24, alignItems: 'center' },
  errorText: { color: '#c8102e', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#c8102e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#18181b' },
  cardMeta: { fontSize: 14, color: '#c8102e', fontWeight: '600', marginTop: 4 },
  cardAddress: { fontSize: 14, color: '#52525b', marginTop: 8, lineHeight: 20 },
  cardHours: { fontSize: 13, color: '#71717a', marginTop: 8 },
  cardActions: { flexDirection: 'row', marginTop: 12 },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#c8102e' },
  emptyText: { textAlign: 'center', color: '#71717a', marginTop: 24 },
});
