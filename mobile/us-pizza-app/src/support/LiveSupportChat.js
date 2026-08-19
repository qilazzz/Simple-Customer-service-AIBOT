import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CustomerSupportApi } from './api/customerSupportApi';
import { API_BASE_URL } from './config';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

function getSupportStatusLabel(waitingForAgent, liveAgent) {
  if (liveAgent && !waitingForAgent) return 'Live Support Connected';
  if (waitingForAgent) return 'Waiting for Agent';
  return 'Connecting to Support';
}

/**
 * Live agent chat only — loads persisted history, does not mix with bot menu flows.
 */
export default function LiveSupportChat({
  apiBaseUrl = API_BASE_URL,
  guestMode = false,
  onRequestLogin,
  onLogout,
  authUser = null,
}) {
  const { getAuthHeaders, user: contextUser } = useCustomerAuth();
  const activeUser = authUser || contextUser;
  const analyticsUserId = activeUser?.user_id || (guestMode ? 'guest' : null);

  const api = useMemo(
    () => new CustomerSupportApi(apiBaseUrl, { getAuthHeaders }),
    [apiBaseUrl, getAuthHeaders],
  );

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [liveAgentMode, setLiveAgentMode] = useState(true);
  const [waitingForAgent, setWaitingForAgent] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(88);
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

  const applySessionPayload = useCallback(
    (data) => {
      api.sessionId = data.sessionId;
      setSessionId(data.sessionId);
      setLiveAgentMode(Boolean(data.live_agent));
      setWaitingForAgent(Boolean(data.waiting_for_agent));
      if (data.last_live_message_id) syncLiveMessageCursor(data.last_live_message_id);
    },
    [api, syncLiveMessageCursor],
  );

  const loadHistoryState = useCallback(
    (data) => {
      applySessionPayload(data);
      displayedLiveMessageIdsRef.current = new Set();
      lastLiveMessageIdRef.current = 0;

      const restored = (data.messages || []).map((message) => {
        if (message.live_message_id) {
          displayedLiveMessageIdsRef.current.add(Number(message.live_message_id));
        }
        return {
          id: message.live_message_id
            ? `live-${message.live_message_id}`
            : `hist-${message.id}`,
          text: message.message_text,
          role: resolveCustomerMessageRole(message),
        };
      });

      setMessages(restored);
      if (data.last_live_message_id) syncLiveMessageCursor(data.last_live_message_id);

      if (data.reply && !restored.some((message) => message.text === data.reply)) {
        append(data.reply, 'bot');
      }
    },
    [applySessionPayload, append, syncLiveMessageCursor],
  );

  useEffect(() => {
    (async () => {
      try {
        if (activeUser) {
          const history = await api.getLiveChatHistory();
          if (history.found) {
            loadHistoryState(history);
            return;
          }
        }

        const data = await api.startLiveSession();
        if (data.resumed && data.messages?.length) {
          loadHistoryState(data);
          return;
        }

        applySessionPayload(data);
        if (data.reply) append(data.reply, 'bot');
      } catch (err) {
        append(
          `${err.message}\n\nMake sure the API is running (npm start) and config.js has the correct URL.`,
          'system',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [api, append, activeUser, applySessionPayload, loadHistoryState]);

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
        setWaitingForAgent(data.status === 'WAITING_FOR_AGENT');
        (data.messages || []).forEach(appendLiveMessage);
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !sessionId || sending) return;

    append(text, 'user');
    setInput('');
    setSending(true);

    try {
      const data = await api.sendMessage(text, analyticsUserId || 'guest');
      if (data.reply) append(data.reply, 'bot');
      if (data.last_live_message_id) syncLiveMessageCursor(data.last_live_message_id);
      setWaitingForAgent(Boolean(data.waiting_for_agent));
      setLiveAgentMode(Boolean(data.live_agent));
    } catch (err) {
      append(err.message || 'Send failed.', 'system');
    } finally {
      setSending(false);
    }
  };

  const statusLabel = getSupportStatusLabel(waitingForAgent, liveAgentMode);

  return (
    <View style={styles.container}>
      <View style={styles.inlineStatusBar}>
        <View
          style={[
            styles.statusDot,
            liveAgentMode && !waitingForAgent && styles.statusDotConnected,
            waitingForAgent && styles.statusDotWaiting,
          ]}
        />
        <Text style={styles.inlineStatusText}>{statusLabel}</Text>
      </View>

      {(activeUser || guestMode) && (
        <View style={styles.userBar}>
          {activeUser ? (
            <>
              <Text style={styles.userBarText} numberOfLines={1}>
                Signed in as {activeUser.name}
              </Text>
              {onLogout ? (
                <Pressable onPress={onLogout} hitSlop={8}>
                  <Text style={styles.userBarAction}>Log out</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.userBarText}>Continuing as Guest</Text>
              {onRequestLogin ? (
                <Pressable onPress={onRequestLogin} hitSlop={8}>
                  <Text style={styles.userBarAction}>Log in</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: footerHeight + 16 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' && styles.userBubble,
              item.role === 'bot' && styles.botBubble,
              item.role === 'support' && styles.supportBubble,
              item.role === 'system' && styles.systemBubble,
            ]}
          >
            {item.role === 'support' && <Text style={styles.supportLabel}>Support</Text>}
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

      <View
        style={[styles.footerDock, { bottom: keyboardHeight }]}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.compose}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor="#a1a1aa"
            multiline
            editable={!loading && Boolean(sessionId)}
          />
          <Pressable
            style={[styles.sendBtn, (loading || sending || !sessionId) && styles.btnDisabled]}
            onPress={sendMessage}
            disabled={loading || sending || !sessionId}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  flex: { flex: 1 },
  inlineStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineStatusText: { fontSize: 12, fontWeight: '700', color: '#c8102e' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#93c5fd' },
  statusDotConnected: { backgroundColor: '#22c55e' },
  statusDotWaiting: { backgroundColor: '#f59e0b' },
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  userBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#18181b' },
  userBarAction: { fontSize: 13, fontWeight: '700', color: '#c8102e' },
  list: { padding: 16, flexGrow: 1 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 8 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  supportBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  supportLabel: { fontSize: 11, fontWeight: '700', color: '#c8102e', marginBottom: 4 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#c8102e' },
  systemBubble: { alignSelf: 'center', backgroundColor: '#ecfdf5', maxWidth: '95%' },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#1f1f1f' },
  botText: { color: '#52525b', fontSize: 14 },
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
  compose: { padding: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    maxHeight: 100,
    color: '#18181b',
    marginBottom: 8,
  },
  sendBtn: {
    backgroundColor: '#c8102e',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
