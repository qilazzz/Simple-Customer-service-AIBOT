import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CustomerSupportApi } from './api/customerSupportApi';
import { API_BASE_URL } from './config';

/**
 * US Pizza Customer Support — drop-in React Native screen.
 *
 * Setup:
 *   1. Copy the `mobile/react-native/` folder into your app (e.g. `src/support/`)
 *   2. Set API_BASE_URL in config.js
 *   3. npm install react-native-image-picker  (optional, for photo upload)
 *   4. Add to navigation:
 *        import CustomerSupportChat from './support/CustomerSupportChat';
 *        <Stack.Screen name="Support" component={CustomerSupportChat} />
 *
 * Props:
 *   apiBaseUrl  — override config URL
 *   onTicketSubmitted — callback(ticketId) when complaint is logged
 */
export default function CustomerSupportChat({
  apiBaseUrl = API_BASE_URL,
  onTicketSubmitted,
}) {
  const api = useMemo(() => new CustomerSupportApi(apiBaseUrl), [apiBaseUrl]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [showPhotoStep, setShowPhotoStep] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const [flow, setFlow] = useState('menu');
  const [liveAgentMode, setLiveAgentMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const listRef = useRef(null);
  const lastLiveMessageIdRef = useRef(0);
  const displayedLiveMessageIdsRef = useRef(new Set());

  const append = useCallback((text, role, messageId = null) => {
    setMessages((prev) => [
      ...prev,
      {
        id: messageId ? `live-${messageId}` : `${Date.now()}-${Math.random()}`,
        text,
        role,
      },
    ]);
  }, []);

  const syncLiveMessageCursor = useCallback((messageId) => {
    if (!messageId) return;
    lastLiveMessageIdRef.current = Math.max(
      lastLiveMessageIdRef.current,
      Number(messageId) || 0,
    );
    displayedLiveMessageIdsRef.current.add(Number(messageId));
  }, []);

  const resolveCustomerMessageRole = (message) => {
    const sender = message.sender_type || message.sender;
    if (sender === 'user' || sender === 'customer') return 'user';
    if (sender === 'admin' || message.is_admin) return 'support';
    return 'bot';
  };

  const appendLiveMessage = useCallback(
    (message) => {
      if (!message?.id || displayedLiveMessageIdsRef.current.has(message.id)) {
        return;
      }

      const sender = message.sender_type || message.sender;
      if (sender === 'user' || sender === 'customer') {
        syncLiveMessageCursor(message.id);
        return;
      }

      displayedLiveMessageIdsRef.current.add(message.id);
      lastLiveMessageIdRef.current = Math.max(
        lastLiveMessageIdRef.current,
        Number(message.id) || 0,
      );
      append(message.message_text, resolveCustomerMessageRole(message), message.id);
    },
    [append, syncLiveMessageCursor],
  );

  const formatReply = (text) =>
    String(text ?? '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\n---\n[\s\S]*$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const applyResponse = (data, userLabel) => {
    if (userLabel) append(userLabel, 'user');
    if (data.reply) {
      append(data.reply, data.live_agent ? 'bot' : 'ai');
    }
    if (data.last_live_message_id) {
      syncLiveMessageCursor(data.last_live_message_id);
    }

    setFlow(data.flow || flow);
    setShowMenu(Boolean(data.show_menu));
    setReadyToSubmit(Boolean(data.ready_to_submit));
    setShowPhotoStep(data.stage === 'photo' || data.stage === 'ready');

    if (data.live_agent) {
      setLiveAgentMode(true);
    } else if ((data.flow || flow) !== 'live_agent') {
      setLiveAgentMode(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.startSession();
        setSessionId(data.sessionId);
        setShowMenu(data.show_menu !== false);
        setReadyToSubmit(Boolean(data.ready_to_submit));
        setShowPhotoStep(data.stage === 'photo' || data.stage === 'ready');
      } catch (err) {
        append(
          `${err.message}\n\nCheck that npm start is running and API_BASE_URL in config.js is correct.`,
          'system',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [api, append]);

  useEffect(() => {
    if (!liveAgentMode || !sessionId) return undefined;

    let cancelled = false;

    const pollLiveUpdates = async () => {
      try {
        const data = await api.getLiveUpdates(lastLiveMessageIdRef.current);
        if (cancelled || !data.success) return;

        if (data.last_message_id) {
          lastLiveMessageIdRef.current = Math.max(
            lastLiveMessageIdRef.current,
            Number(data.last_message_id) || 0,
          );
        }

        (data.messages || []).forEach(appendLiveMessage);

        if (data.resolved) {
          setLiveAgentMode(false);
          setFlow('menu');
          setShowMenu(true);
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    pollLiveUpdates();
    const timer = setInterval(pollLiveUpdates, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveAgentMode, sessionId, api, appendLiveMessage]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !sessionId || submitting) return;

    setInput('');
    setLoading(true);

    try {
      const data = await api.sendMessage(text, sessionId);
      applyResponse(data, text);
    } catch (err) {
      append(err.message || 'Send failed.', 'system');
    } finally {
      setLoading(false);
    }
  };

  const pickPhoto = async () => {
    try {
      const { launchImageLibrary } = require('react-native-image-picker');

      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 3,
        quality: 0.8,
      });

      if (result.didCancel || !result.assets?.length) return;

      setPhotos((prev) => [
        ...prev,
        ...result.assets.map((a) => ({
          uri: a.uri,
          type: a.type || 'image/jpeg',
          fileName: a.fileName || `photo-${Date.now()}.jpg`,
        })),
      ]);
    } catch {
      append(
        'Photo picker not installed. Run: npm install react-native-image-picker',
        'system',
      );
    }
  };

  const submitComplaint = async () => {
    if (!sessionId || !readyToSubmit || submitting) return;

    setSubmitting(true);
    try {
      const data = await api.submitComplaint(photos);
      append(formatReply(data.reply), 'ai');
      setReadyToSubmit(false);
      setShowPhotoStep(false);
      setShowMenu(false);
      setSessionId(null);
      setPhotos([]);
      onTicketSubmitted?.(data.ticket_id);
    } catch (err) {
      append(err.message || 'Submit failed.', 'system');
    } finally {
      setSubmitting(false);
    }
  };

  const chatDisabled = submitting || sessionId === null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>US Pizza Support</Text>
          <Text style={styles.headerSub}>Customer Care · Malaysia</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' && styles.userBubble,
                item.role === 'ai' && styles.aiBubble,
                item.role === 'bot' && styles.botBubble,
                item.role === 'support' && styles.supportBubble,
                item.role === 'system' && styles.systemBubble,
              ]}
            >
              {item.role === 'support' && (
                <Text style={styles.supportLabel}>Support</Text>
              )}
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && styles.userText,
                  item.role === 'bot' && styles.botText,
                  item.role === 'system' && styles.systemText,
                ]}
              >
                {formatReply(item.text)}
              </Text>
            </View>
          )}
        />

        {loading && <ActivityIndicator style={styles.loader} color="#c8102e" />}

        {showPhotoStep && (
          <View style={styles.photoBar}>
            <Pressable style={styles.photoBtn} onPress={pickPhoto} disabled={chatDisabled}>
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
            placeholder={chatDisabled ? 'Session ended' : 'Type your message...'}
            placeholderTextColor="#a1a1aa"
            multiline
            editable={!chatDisabled}
          />
          <View style={styles.actions}>
            <Pressable
              style={[styles.sendBtn, chatDisabled && styles.btnDisabled]}
              onPress={sendMessage}
              disabled={chatDisabled}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
            {readyToSubmit && (
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#c8102e' },
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: {
    backgroundColor: '#c8102e',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  supportBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  supportLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c8102e',
    marginBottom: 4,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#c8102e' },
  systemBubble: { alignSelf: 'center', backgroundColor: '#ecfdf5', maxWidth: '95%' },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#1f1f1f' },
  botText: { color: '#52525b', fontSize: 14 },
  userText: { color: '#fff' },
  systemText: { color: '#166534', fontSize: 13, textAlign: 'center' },
  loader: { marginVertical: 8 },
  photoBar: {
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    padding: 10,
  },
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e5e5',
  },
  compose: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff',
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
    color: '#18181b',
  },
  actions: { flexDirection: 'row', marginTop: 8 },
  sendBtn: {
    flex: 1,
    backgroundColor: '#c8102e',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginRight: 4,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginLeft: 4,
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  submitBtnText: { color: '#1f1f1f', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
