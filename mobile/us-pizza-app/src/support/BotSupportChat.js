import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CustomerSupportApi } from './api/customerSupportApi';
import { API_BASE_URL } from './config';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { SUPPORT_MENU } from '../screens/CustomerServiceMenuScreen';

const BOT_MENU = SUPPORT_MENU.filter((item) => item.id !== 'other');

export default function BotSupportChat({
  apiBaseUrl = API_BASE_URL,
  initialOption = null,
  onTicketSubmitted,
  onOpenOutlets,
  authUser = null,
}) {
  const { getAuthHeaders, user: contextUser } = useCustomerAuth();
  const activeUser = authUser || contextUser;
  const analyticsUserId = activeUser?.user_id || 'guest';

  const api = useMemo(
    () => new CustomerSupportApi(apiBaseUrl, { getAuthHeaders }),
    [apiBaseUrl, getAuthHeaders],
  );

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuOptions, setMenuOptions] = useState(BOT_MENU);
  const [stage, setStage] = useState('menu');
  const [flow, setFlow] = useState('menu');
  const [photos, setPhotos] = useState([]);
  const [outletOptions, setOutletOptions] = useState([]);
  const [outletSearch, setOutletSearch] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(120);
  const listRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const append = useCallback((text, role) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, role },
    ]);
  }, []);

  const formatReply = (text) =>
    String(text ?? '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\n---\n[\s\S]*$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const applyResponse = useCallback(
    (data, userLabel) => {
      if (userLabel) append(userLabel, 'user');
      if (data.reply) append(data.reply, 'ai');
      setStage(data.stage || stage);
      setFlow(data.flow || flow);
      setShowMenu(Boolean(data.show_menu));
      if (data.menu_options?.length) {
        setMenuOptions(data.menu_options.filter((item) => item.id !== 'other'));
      }
      if (data.outlet_options?.length) setOutletOptions(data.outlet_options);
      if (data.stage !== 'outlet') setOutletSearch('');
      setReadyToSubmit(Boolean(data.ready_to_submit));
    },
    [append, flow, stage],
  );

  const dispatchMessage = useCallback(
    async (text, { showUserBubble = true } = {}) => {
      if (!text?.trim() || !sessionId) return null;
      if (showUserBubble) append(text, 'user');
      setSending(true);
      try {
        const data = await api.sendMessage(text, analyticsUserId);
        applyResponse(data, showUserBubble ? null : text);
        return data;
      } catch (err) {
        append(err.message || 'Send failed.', 'system');
        return null;
      } finally {
        setSending(false);
      }
    },
    [analyticsUserId, api, append, applyResponse, sessionId],
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await api.startBotSession();
        setSessionId(data.sessionId);
        setStage(data.stage || 'menu');
        setFlow(data.flow || 'menu');
        setShowMenu(data.show_menu !== false);
        if (data.menu_options?.length) {
          setMenuOptions(data.menu_options.filter((item) => item.id !== 'other'));
        }
      } catch (err) {
        append(
          `${err.message}\n\nMake sure the API is running and config.js has the correct URL.`,
          'system',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [api, append]);

  useEffect(() => {
    if (!sessionId || !initialOption || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    dispatchMessage(initialOption);
  }, [sessionId, initialOption, dispatchMessage]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event) => setKeyboardHeight(event.endCoordinates?.height || 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const sendMenuOption = async (item) => {
    if (item.id === 'find_outlet') {
      onOpenOutlets?.();
      return;
    }
    await dispatchMessage(item.label);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await dispatchMessage(text);
  };

  const sendOutletChoice = async (name) => {
    await dispatchMessage(name);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      append('Photo access was denied. You can submit without a photo.', 'system');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotos((prev) => [
      ...prev,
      ...result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      })),
    ]);
  };

  const submitComplaint = async () => {
    if (!sessionId || !readyToSubmit || submitting) return;
    setSubmitting(true);
    try {
      const data = await api.submitComplaint(photos, analyticsUserId);
      append(formatReply(data.reply), 'ai');
      setReadyToSubmit(false);
      setPhotos([]);
      onTicketSubmitted?.(data.ticket_id);
    } catch (err) {
      append(err.message || 'Submit failed.', 'system');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOutlets = outletOptions.filter((outlet) => {
    const term = outletSearch.trim().toLowerCase();
    if (!term) return true;
    const name = (outlet.label || outlet.name || '').toLowerCase();
    const state = (outlet.state || '').toLowerCase();
    const city = (outlet.city || '').toLowerCase();
    return name.includes(term) || state.includes(term) || city.includes(term);
  });

  const chatDisabled = submitting || !sessionId || stage === 'done';
  const inComplaintFlow = flow === 'complaint';
  const showPhotoStep = stage === 'photo' || stage === 'ready';

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: footerHeight + 16 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          showMenu && messages.length > 0 ? (
            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterTitle}>Quick options</Text>
              <View style={styles.menuChips}>
                {menuOptions.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.menuChip}
                    onPress={() => sendMenuOption(item)}
                    disabled={chatDisabled || loading || sending}
                  >
                    <Text style={styles.menuChipText}>
                      {item.emoji} {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' && styles.userBubble,
              item.role === 'ai' && styles.aiBubble,
              item.role === 'system' && styles.systemBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                item.role === 'user' && styles.userText,
                item.role === 'system' && styles.systemText,
              ]}
            >
              {formatReply(item.text)}
            </Text>
          </View>
        )}
      />

      {loading && <ActivityIndicator style={styles.loader} color="#c8102e" />}

      <View
        style={[styles.footerDock, { bottom: keyboardHeight }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        {stage === 'outlet' && inComplaintFlow && outletOptions.length > 0 && (
          <View style={styles.outletBar}>
            <Text style={styles.outletTitle}>Select an outlet:</Text>
            <TextInput
              style={styles.outletSearch}
              value={outletSearch}
              onChangeText={setOutletSearch}
              placeholder="Search outlets..."
              placeholderTextColor="#a1a1aa"
            />
            <ScrollView style={styles.outletList} keyboardShouldPersistTaps="handled">
              {filteredOutlets.slice(0, 60).map((outlet) => {
                const name = outlet.label || outlet.name || '';
                const meta = [outlet.city, outlet.state].filter(Boolean).join(', ');
                return (
                  <Pressable
                    key={outlet.id || outlet.outlet_id || name}
                    style={styles.outletOptionBtn}
                    onPress={() => sendOutletChoice(name)}
                  >
                    <Text style={styles.outletOptionName}>{name}</Text>
                    {meta ? <Text style={styles.outletOptionMeta}>{meta}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {showPhotoStep && inComplaintFlow && (
          <View style={styles.photoBar}>
            <Pressable style={styles.photoBtn} onPress={pickPhoto}>
              <Text style={styles.photoBtnText}>📎 Add photo</Text>
            </Pressable>
            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.map((p) => (
                  <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.compose}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor="#a1a1aa"
            multiline
            editable={!chatDisabled}
          />
          <View style={styles.actions}>
            <Pressable
              style={[styles.sendBtn, chatDisabled && styles.btnDisabled]}
              onPress={sendMessage}
              disabled={chatDisabled || sending}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
            {readyToSubmit && inComplaintFlow && (
              <Pressable
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={submitComplaint}
                disabled={submitting}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  list: { padding: 16, flexGrow: 1 },
  menuFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  menuFooterTitle: { fontSize: 13, fontWeight: '700', color: '#71717a', marginBottom: 8 },
  menuChips: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  menuChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  menuChipText: { fontSize: 12, fontWeight: '600', color: '#18181b' },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 8 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#c8102e' },
  systemBubble: { alignSelf: 'center', backgroundColor: '#ecfdf5', maxWidth: '95%' },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#1f1f1f' },
  userText: { color: '#fff' },
  systemText: { color: '#166534', fontSize: 13, textAlign: 'center' },
  loader: { marginVertical: 8 },
  footerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  outletBar: { padding: 12, paddingBottom: 0 },
  outletTitle: { fontSize: 13, fontWeight: '600', color: '#71717a', marginBottom: 8 },
  outletSearch: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  outletList: { maxHeight: 140 },
  outletOptionBtn: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    backgroundColor: '#fafafa',
  },
  outletOptionName: { fontSize: 13, fontWeight: '600', color: '#18181b' },
  outletOptionMeta: { fontSize: 11, color: '#71717a', marginTop: 2 },
  photoBar: { backgroundColor: '#fffbeb', padding: 10, paddingBottom: 0 },
  photoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#92400e' },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 8 },
  compose: { padding: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
    color: '#18181b',
  },
  actions: { flexDirection: 'row', marginTop: 8, gap: 8 },
  sendBtn: {
    flex: 1,
    backgroundColor: '#c8102e',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  submitBtnText: { color: '#1f1f1f', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
