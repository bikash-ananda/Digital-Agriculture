import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Check, Download, FileText, LoaderCircle, MessageCircle,
  Paperclip, Phone, PhoneOff, Send, Trash2, Users, Video, Wifi, X
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/useAuth';
import useLang from '../../utils/useLang';
import {
  clearLocalConversation, getChatIdentity, getLocalAttachment,
  listConversationMessages, openChatDatabase, saveLocalAttachment,
  saveLocalMessage
} from '../../services/smartChatLocalStore';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const CHUNK_BYTES = 16 * 1024;
const BUFFER_LIMIT = 512 * 1024;
const BUFFER_LOW = 128 * 1024;

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function conversationFor(left, right) {
  return `smart:${[String(left), String(right)].sort((a, b) => Number(a) - Number(b)).join(':')}`;
}

function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function waitForBuffer(channel) {
  if (channel.readyState !== 'open') return Promise.reject(new Error('The peer connection closed'));
  if (channel.bufferedAmount <= BUFFER_LIMIT) return Promise.resolve();
  channel.bufferedAmountLowThreshold = BUFFER_LOW;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('File transfer stalled')); }, 30000);
    const cleanup = () => {
      window.clearTimeout(timer);
      channel.removeEventListener('bufferedamountlow', onLow);
      channel.removeEventListener('close', onClose);
    };
    const onLow = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('The peer connection closed')); };
    channel.addEventListener('bufferedamountlow', onLow, { once: true });
    channel.addEventListener('close', onClose, { once: true });
  });
}

export default function SmartFarmingChat() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [identity, setIdentity] = useState(null);
  const [database, setDatabase] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageConversationId, setMessageConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signalingReady, setSignalingReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [peerState, setPeerState] = useState('disconnected');
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [restartKey, setRestartKey] = useState(0);
  const messagesEnd = useRef(null);
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const fileInput = useRef(null);
  const eventSource = useRef(null);
  const peerRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingCallRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingIceRef = useRef([]);
  const incomingTransferRef = useRef(null);
  const callRef = useRef(null);
  const contactsRef = useRef([]);
  const runtimeRef = useRef({});
  const finishCallRef = useRef(null);

  const selectedContact = contacts.find((contact) => String(contact.id) === selectedId) || null;
  const selectedSession = selectedContact?.onlineSessions?.find((item) => item.sessionId === selectedSessionId)
    || selectedContact?.onlineSessions?.[0] || null;
  const target = useMemo(() => selectedContact && selectedSession ? {
    id: String(selectedContact.id),
    name: lang === 'en' ? (selectedContact.nameEn || selectedContact.nameNe) : (selectedContact.nameNe || selectedContact.nameEn),
    nameEn: selectedContact.nameEn,
    sessionId: selectedSession.sessionId,
    deviceId: selectedSession.deviceId,
    conversationId: identity ? conversationFor(identity.userId, selectedContact.id) : ''
  } : null, [identity, lang, selectedContact, selectedSession]);
  const visibleMessages = useMemo(() => target && messageConversationId === target.conversationId ? messages : [], [messageConversationId, messages, target]);
  const contactLabel = useCallback((contact) => lang === 'en'
    ? (contact.nameEn || contact.nameNe || contact.title || `User ${contact.id}`)
    : (contact.nameNe || contact.nameEn || contact.title || `प्रयोगकर्ता ${contact.id}`), [lang]);

  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    let opened;
    try {
      const nextIdentity = getChatIdentity(user.id);
      queueMicrotask(() => { if (active) setIdentity(nextIdentity); });
      openChatDatabase(user.id, nextIdentity.deviceId).then((db) => {
        opened = db;
        if (active) setDatabase(db);
        else db.close();
      }).catch((cause) => {
        if (active) setError(cause.message || t('यस यन्त्रमा सुरक्षित च्याट भण्डारण खोल्न सकिएन।', 'Could not open this device’s private chat storage.'));
      });
    } catch (cause) {
      queueMicrotask(() => {
        if (active) setError(cause.message || t('यस ब्राउजरमा स्थानीय च्याट भण्डारण उपलब्ध छैन।', 'Local chat storage is unavailable in this browser.'));
      });
    }
    return () => { active = false; opened?.close(); };
  }, [user?.id, t]);

  const refreshContacts = useCallback(async () => {
    try {
      const response = await api.get('/smart-chat/contacts');
      setContacts(response.data);
      setError('');
    } catch (cause) {
      setError(cause.response?.data?.message || t('सम्पर्कहरू लोड भएनन्।', 'Could not load Smart Farming contacts.'));
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => {
    const initial = window.setTimeout(refreshContacts, 0);
    const timer = window.setInterval(refreshContacts, 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshContacts]);

  const signalTo = useCallback(async (destination, type, payload) => {
    if (!identity || !destination?.id || !destination.sessionId) throw new Error('Select an online contact first');
    await api.post('/smart-chat/signal', {
      toUserId: destination.id,
      toSessionId: destination.sessionId,
      fromDeviceId: identity.deviceId,
      fromSessionId: identity.sessionId,
      type,
      payload
    });
  }, [identity]);

  const setMessageList = useCallback((conversationId, message) => {
    if (runtimeRef.current.target?.conversationId !== conversationId) return;
    setMessageConversationId(conversationId);
    setMessages((current) => current.some((item) => item.id === message.id)
      ? current.map((item) => item.id === message.id ? { ...item, ...message } : item)
      : [...current, message].sort((a, b) => a.createdAt - b.createdAt));
  }, []);

  const updateLocalMessage = useCallback(async (messageId, update) => {
    const db = runtimeRef.current.database;
    if (!db) return;
    const current = await getLocalMessageSafe(db, messageId);
    if (!current) return;
    const next = { ...current, ...update };
    await saveLocalMessage(db, next);
    setMessageList(next.conversationId, next);
  }, [setMessageList]);

  const handleData = useCallback(async (raw, remote) => {
    const db = runtimeRef.current.database;
    if (!db) return;
    if (typeof raw !== 'string') {
      const pending = incomingTransferRef.current;
      if (!pending) return;
      const chunk = raw instanceof ArrayBuffer ? raw : raw instanceof Blob ? await raw.arrayBuffer() : raw.buffer;
      pending.chunks.push(chunk);
      pending.received += chunk.byteLength;
      if (pending.received > pending.size) {
        incomingTransferRef.current = null;
        setTransfer(null);
        return;
      }
      setTransfer({ name: pending.name, received: pending.received, size: pending.size, direction: 'receiving' });
      return;
    }

    let packet;
    try { packet = JSON.parse(raw); } catch { return; }
    if (packet.kind === 'ack' && typeof packet.messageId === 'string') {
      await updateLocalMessage(packet.messageId, { status: 'delivered' });
      return;
    }
    if (packet.kind === 'message' && packet.message && packet.message.conversationId === remote.conversationId
      && packet.message.senderId === remote.id && typeof packet.message.body === 'string') {
      const received = { ...packet.message, status: 'received' };
      await saveLocalMessage(db, received);
      setMessageList(received.conversationId, received);
      try { channelRef.current?.send(JSON.stringify({ kind: 'ack', messageId: received.id })); } catch { /* The local message is saved even if delivery acknowledgement fails. */ }
      return;
    }
    if (packet.kind === 'file-start' && packet.file && packet.file.conversationId === remote.conversationId
      && typeof packet.file.messageId === 'string' && typeof packet.file.name === 'string'
      && Number.isSafeInteger(packet.file.size) && packet.file.size >= 0 && packet.file.size <= MAX_FILE_BYTES) {
      incomingTransferRef.current = { ...packet.file, chunks: [], received: 0, senderId: remote.id, senderName: remote.name };
      setTransfer({ name: packet.file.name, received: 0, size: packet.file.size, direction: 'receiving' });
      return;
    }
    if (packet.kind === 'file-end' && incomingTransferRef.current?.messageId === packet.messageId) {
      const incoming = incomingTransferRef.current;
      incomingTransferRef.current = null;
      if (incoming.received !== incoming.size) { setTransfer(null); return; }
      const blob = new Blob(incoming.chunks, { type: incoming.type || 'application/octet-stream' });
      await saveLocalAttachment(db, {
        id: incoming.messageId, conversationId: incoming.conversationId,
        fileName: incoming.name, mimeType: incoming.type || blob.type,
        size: incoming.size, blob, createdAt: Date.now()
      });
      const received = {
        id: incoming.messageId, conversationId: incoming.conversationId,
        senderId: incoming.senderId, senderName: incoming.senderName,
        body: '', attachmentId: incoming.messageId, fileName: incoming.name,
        mimeType: incoming.type, size: incoming.size, createdAt: Date.now(), status: 'received'
      };
      await saveLocalMessage(db, received);
      setMessageList(received.conversationId, received);
      try { channelRef.current?.send(JSON.stringify({ kind: 'ack', messageId: received.id })); } catch { /* The local file is saved. */ }
      setTransfer(null);
      return;
    }
    if (packet.kind === 'file-abort' && incomingTransferRef.current?.messageId === packet.messageId) {
      incomingTransferRef.current = null;
      setTransfer(null);
    }
  }, [setMessageList, updateLocalMessage]);

  const attachDataChannel = useCallback((channel, remote) => {
    channel.binaryType = 'arraybuffer';
    channelRef.current = channel;
    channel.onopen = () => setPeerState('connected');
    channel.onclose = () => setPeerState('disconnected');
    channel.onerror = () => setError(t('प्रत्यक्ष च्याट जडानमा समस्या आयो।', 'The direct chat connection encountered an error.'));
    channel.onmessage = (event) => runtimeRef.current.handleData?.(event.data, remote);
  }, [t]);

  const flushIce = useCallback(async (pc, remote, callId = null) => {
    const remaining = [];
    for (const item of pendingIceRef.current) {
      if (item.fromUserId === remote.id && item.fromSessionId === remote.sessionId && (item.callId || null) === callId) {
        try { await pc.addIceCandidate(item.candidate); } catch { /* Ignore candidates rejected after a peer restart. */ }
      } else remaining.push(item);
    }
    pendingIceRef.current = remaining;
  }, []);

  const signalRuntime = useCallback((remote, type, payload) => {
    runtimeRef.current.signalTo?.(remote, type, payload).catch((cause) => {
      setError(cause.response?.data?.message || cause.message || t('सिग्नल पठाउन सकिएन।', 'Could not send connection signal.'));
    });
  }, [t]);

  const createPeer = useCallback(async (remote, makeChannel = false) => {
    const current = peerRef.current;
    if (current?.remote.id === remote.id && current.remote.sessionId === remote.sessionId) return current.pc;
    if (current) {
      current.pc.close();
      peerRef.current = null;
      channelRef.current = null;
    }
    let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    try {
      const response = await api.get('/smart-chat/ice-config');
      if (Array.isArray(response.data.iceServers) && response.data.iceServers.length) iceServers = response.data.iceServers;
    } catch { /* Public STUN remains available when optional TURN config is absent. */ }
    const pc = new RTCPeerConnection({ iceServers });
    const record = { pc, remote, negotiatedCallId: null };
    peerRef.current = record;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const callId = callRef.current?.callId || incomingCallRef.current?.callId || null;
        signalRuntime(remote, 'ice', { candidate: event.candidate.toJSON(), ...(callId ? { callId } : {}) });
      }
    };
    pc.ondatachannel = (event) => runtimeRef.current.attachDataChannel?.(event.channel, remote);
    pc.ontrack = (event) => setRemoteStream(event.streams[0] || new MediaStream([event.track]));
    pc.onconnectionstatechange = () => {
      if (peerRef.current !== record) return;
      setPeerState(pc.connectionState === 'connected' ? 'connected'
        : pc.connectionState === 'connecting' || pc.connectionState === 'new' ? 'connecting' : 'disconnected');
      if (pc.connectionState === 'failed') setError(t('प्रत्यक्ष जडान असफल भयो। फेरि जडान गर्नुहोस् वा साइटको नेटवर्कमा TURN सेवा कन्फिगर गर्नुहोस्।', 'Direct connection failed. Reconnect or configure a TURN service for this network.'));
    };
    if (makeChannel) attachDataChannel(pc.createDataChannel('smart-farming-chat', { ordered: true }), remote);
    setPeerState('connecting');
    return pc;
  }, [attachDataChannel, signalRuntime, t]);

  const sendOffer = useCallback(async (remote, callId = null, stream = null) => {
    const pc = await createPeer(remote, !callId);
    if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signalTo(remote, 'description', { description: pc.localDescription.toJSON(), ...(callId ? { callId } : {}) });
  }, [createPeer, signalTo]);

  const answerOffer = useCallback(async (remote, description, callId = null, stream = null) => {
    const pc = await createPeer(remote, false);
    if (stream) stream.getTracks().forEach((track) => {
      if (!pc.getSenders().some((sender) => sender.track === track)) pc.addTrack(track, stream);
    });
    await pc.setRemoteDescription(description);
    if (peerRef.current?.pc === pc) peerRef.current.negotiatedCallId = callId || null;
    await flushIce(pc, remote, callId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signalTo(remote, 'description', { description: pc.localDescription.toJSON(), ...(callId ? { callId } : {}) });
  }, [createPeer, flushIce, signalTo]);

  const handleSignal = useCallback(async (event) => {
    const remote = {
      id: String(event.fromUserId), name: event.fromName || `User ${event.fromUserId}`,
      sessionId: event.fromSessionId, deviceId: event.fromDeviceId,
      conversationId: identity ? conversationFor(identity.userId, event.fromUserId) : ''
    };
    const contact = contactsRef.current.find((item) => String(item.id) === remote.id);
    if (contact) remote.name = contactLabel(contact);

    if (event.type === 'chat-invite') {
      if (!callRef.current && Number(identity?.userId) < Number(remote.id)) {
        setSelectedId(remote.id);
        setSelectedSessionId(remote.sessionId);
      }
      return;
    }
    if (event.type === 'call-invite') {
      if (callRef.current || incomingCallRef.current) {
        if (callRef.current?.callId !== event.payload.callId && incomingCallRef.current?.callId !== event.payload.callId) {
          signalRuntime(remote, 'call-reject', { callId: event.payload.callId });
        }
        return;
      }
      const invitation = { remote, callId: event.payload.callId, media: event.payload.media, fromName: remote.name };
      incomingCallRef.current = invitation;
      setIncomingCall(invitation);
      setSelectedId(remote.id);
      setSelectedSessionId(remote.sessionId);
      setNotice('');
      return;
    }
    if (event.type === 'description') {
      const description = event.payload.description;
      if (description.type === 'offer' && event.payload.callId) {
        pendingOfferRef.current = { remote, description, callId: event.payload.callId };
        if (callRef.current?.direction === 'incoming' && callRef.current.callId === event.payload.callId && callRef.current.accepted) {
          await answerOffer(remote, description, event.payload.callId, localStreamRef.current);
          await signalTo(remote, 'call-accept', { callId: event.payload.callId });
          setCall((current) => current ? { ...current, status: 'connected' } : current);
        }
        return;
      }
      if (description.type === 'offer') {
        const activeCall = callRef.current || incomingCallRef.current;
        if (activeCall && activeCall.remote.id !== remote.id) return;
        setSelectedId(remote.id);
        setSelectedSessionId(remote.sessionId);
        await answerOffer(remote, description);
        return;
      }
      const current = peerRef.current;
      if (description.type === 'answer' && current?.remote.id === remote.id && current.remote.sessionId === remote.sessionId) {
        await current.pc.setRemoteDescription(description);
        current.negotiatedCallId = event.payload.callId || null;
        await flushIce(current.pc, remote, current.negotiatedCallId);
      }
      return;
    }
    if (event.type === 'ice') {
      const current = peerRef.current;
      const callId = event.payload.callId || null;
      if (current?.remote.id === remote.id && current.remote.sessionId === remote.sessionId && current.pc.remoteDescription && current.negotiatedCallId === callId) {
        try { await current.pc.addIceCandidate(event.payload.candidate); } catch { /* Ignore late ICE after a connection restart. */ }
      } else if (pendingIceRef.current.length < 256) {
        pendingIceRef.current.push({ fromUserId: remote.id, fromSessionId: remote.sessionId, callId, candidate: event.payload.candidate });
      }
      return;
    }
    if (event.type === 'call-accept') {
      setCall((current) => current?.callId === event.payload.callId && current.remote?.id === remote.id ? { ...current, status: 'connected' } : current);
      return;
    }
    if (event.type === 'call-reject') {
      const currentCall = callRef.current || incomingCallRef.current;
      if (currentCall?.callId !== event.payload.callId || currentCall.remote?.id !== remote.id || currentCall.remote?.sessionId !== remote.sessionId) return;
      setNotice(t('सम्पर्कले कल अस्वीकार गर्नुभयो।', 'The contact declined the call.'));
      finishCallRef.current?.(false);
      return;
    }
    if (event.type === 'call-end') {
      const currentCall = callRef.current || incomingCallRef.current;
      if (currentCall?.callId !== event.payload.callId || currentCall.remote?.id !== remote.id || currentCall.remote?.sessionId !== remote.sessionId) return;
      setNotice(t('कल समाप्त भयो।', 'The call ended.'));
      finishCallRef.current?.(false);
    }
  }, [answerOffer, contactLabel, flushIce, identity, signalRuntime, signalTo, t]);

  useEffect(() => {
    runtimeRef.current = {
      database, identity, target, handleData, handleSignal,
      attachDataChannel, signalTo
    };
  }, [database, identity, target, handleData, handleSignal, attachDataChannel, signalTo]);

  useEffect(() => {
    if (!identity) return undefined;
    let active = true;
    const source = new EventSource(`/api/smart-chat/events?deviceId=${encodeURIComponent(identity.deviceId)}&sessionId=${encodeURIComponent(identity.sessionId)}`, { withCredentials: true });
    eventSource.current = source;
    source.onopen = () => { if (active) { setSignalingReady(true); setNotice(''); } };
    source.onerror = () => { if (active) { setSignalingReady(false); setNotice(t('च्याट सर्भरसँग पुनः जडान हुँदैछ।', 'Reconnecting to chat signaling…')); } };
    source.onmessage = (message) => {
      try { runtimeRef.current.handleSignal?.(JSON.parse(message.data)); }
      catch { /* Ignore malformed signaling events. */ }
    };
    return () => { active = false; source.close(); if (eventSource.current === source) eventSource.current = null; };
  }, [identity, t]);

  useEffect(() => {
    if (!database || !target) return undefined;
    let active = true;
    listConversationMessages(database, target.conversationId)
      .then((rows) => {
        if (active) {
          setMessageConversationId(target.conversationId);
          setMessages(rows);
        }
      })
      .catch(() => { if (active) setError(t('यस यन्त्रका पुराना सन्देश पढ्न सकिएन।', 'Could not read previous messages from this device.')); });
    return () => { active = false; };
  }, [database, target, t]);

  useEffect(() => {
    if (!identity || !signalingReady || !target || incomingCall || call) return undefined;
    let active = true;
    const connect = async () => {
      try {
        const current = peerRef.current;
        if (current?.remote.id === target.id && current.remote.sessionId === target.sessionId) return;
        if (Number(identity.userId) < Number(target.id)) await sendOffer(target);
        else await signalTo(target, 'chat-invite', { conversationId: target.conversationId });
      } catch (cause) {
        if (active) setError(cause.response?.data?.message || cause.message || t('च्याट जडान सुरु गर्न सकिएन।', 'Could not start the chat connection.'));
      }
    };
    connect();
    return () => {
      active = false;
      const current = peerRef.current;
      if (current && current.remote.id !== target.id) {
        current.pc.close();
        peerRef.current = null;
        channelRef.current = null;
      }
    };
  }, [identity, signalingReady, target, incomingCall, call, restartKey, sendOffer, signalTo, t]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [visibleMessages]);
  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream;
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  useEffect(() => () => {
    eventSource.current?.close();
    peerRef.current?.pc.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function selectContact(contact) {
    const session = contact.onlineSessions?.[0];
    if (peerRef.current && peerRef.current.remote.id !== String(contact.id)) {
      peerRef.current.pc.close();
      peerRef.current = null;
      channelRef.current = null;
    }
    setSelectedId(String(contact.id));
    setSelectedSessionId(session?.sessionId || '');
    setError('');
    setNotice('');
  }

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    const channel = channelRef.current;
    if (!body || busy || !database || !target || channel?.readyState !== 'open') return;
    setBusy(true);
    const message = {
      id: makeId(), conversationId: target.conversationId,
      senderId: String(identity.userId), senderName: user.full_name_en || user.username,
      body, createdAt: Date.now(), status: 'sending'
    };
    try {
      await saveLocalMessage(database, message);
      setMessages((current) => [...current, message]);
      await waitForBuffer(channel);
      channel.send(JSON.stringify({ kind: 'message', message }));
      const sent = { ...message, status: 'sent' };
      await saveLocalMessage(database, sent);
      setMessageList(target.conversationId, sent);
      setDraft('');
    } catch (cause) { setError(cause.message || t('सन्देश पठाउन सकिएन।', 'Could not send the message.')); }
    finally { setBusy(false); }
  }

  async function sendFile(file) {
    if (!file || !database || !target) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(t('फाइल १०० MB भन्दा सानो हुनुपर्छ।', 'Files must be 100 MB or smaller.'));
      return;
    }
    const channel = channelRef.current;
    if (channel?.readyState !== 'open') {
      setError(t('फाइल पठाउनुअघि सम्पर्क अनलाइन हुनुपर्छ।', 'The contact must be online before sending a file.'));
      return;
    }
    setBusy(true);
    setError('');
    const id = makeId();
    const attachment = {
      id, conversationId: target.conversationId, fileName: file.name,
      mimeType: file.type || 'application/octet-stream', size: file.size,
      blob: file, createdAt: Date.now()
    };
    const message = {
      id, conversationId: target.conversationId, senderId: String(identity.userId),
      senderName: user.full_name_en || user.username, body: '', attachmentId: id,
      fileName: file.name, mimeType: attachment.mimeType, size: file.size,
      createdAt: Date.now(), status: 'sending'
    };
    try {
      await saveLocalAttachment(database, attachment);
      await saveLocalMessage(database, message);
      setMessages((current) => [...current, message]);
      await waitForBuffer(channel);
      channel.send(JSON.stringify({ kind: 'file-start', file: {
        messageId: id, conversationId: target.conversationId, name: file.name,
        type: attachment.mimeType, size: file.size
      } }));
      let sentBytes = 0;
      for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
        await waitForBuffer(channel);
        const chunk = await file.slice(offset, Math.min(offset + CHUNK_BYTES, file.size)).arrayBuffer();
        channel.send(chunk);
        sentBytes += chunk.byteLength;
        if (sentBytes === file.size || sentBytes % (CHUNK_BYTES * 64) === 0) {
          setTransfer({ name: file.name, received: sentBytes, size: file.size, direction: 'sending' });
        }
      }
      await waitForBuffer(channel);
      channel.send(JSON.stringify({ kind: 'file-end', messageId: id }));
      const sent = { ...message, status: 'sent' };
      await saveLocalMessage(database, sent);
      setMessageList(target.conversationId, sent);
      setTransfer(null);
    } catch (cause) {
      try { channel.send(JSON.stringify({ kind: 'file-abort', messageId: id })); } catch { /* Best effort. */ }
      const failed = { ...message, status: 'failed' };
      await saveLocalMessage(database, failed).catch(() => {});
      setMessageList(target.conversationId, failed);
      setTransfer(null);
      setError(cause.message || t('फाइल स्थानान्तरण असफल भयो।', 'File transfer failed.'));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function downloadFile(message) {
    try {
      const attachment = await getLocalAttachment(database, message.attachmentId);
      if (!attachment?.blob) throw new Error(t('फाइल यस यन्त्रमा भेटिएन।', 'This file is not stored on this device.'));
      const url = URL.createObjectURL(attachment.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName || message.fileName || 'attachment';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (cause) { setError(cause.message || t('फाइल डाउनलोड गर्न सकिएन।', 'Could not download the file.')); }
  }

  async function startCall(media) {
    if (!target || !channelRef.current || channelRef.current.readyState !== 'open' || busy) {
      setError(t('कल सुरु गर्न सम्पर्क अनलाइन र प्रत्यक्ष च्याट जडान भएको हुनुपर्छ।', 'The contact must be online and the direct chat must be connected to start a call.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === 'video' });
      const pc = peerRef.current?.pc;
      if (!pc || pc.signalingState !== 'stable') throw new Error(t('जडान तयार छैन। एकछिनपछि फेरि प्रयास गर्नुहोस्।', 'The connection is not ready. Try again in a moment.'));
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const callId = makeId();
      callRef.current = { callId, media, direction: 'outgoing', status: 'calling', remote: target };
      setCall(callRef.current);
      await signalTo(target, 'call-invite', { callId, media });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signalTo(target, 'description', { description: pc.localDescription.toJSON(), callId });
    } catch (cause) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setCall(null);
      callRef.current = null;
      setError(cause.response?.data?.message || cause.message || t('क्यामेरा वा माइक्रोफोन खोल्न सकिएन।', 'Could not access the camera or microphone.'));
    } finally { setBusy(false); }
  }

  async function acceptCall() {
    const invitation = incomingCallRef.current;
    if (!invitation) return;
    setBusy(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: invitation.media === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);
      callRef.current = { ...invitation, direction: 'incoming', status: 'answering', accepted: true };
      setCall(callRef.current);
      setIncomingCall(null);
      incomingCallRef.current = null;
      const pending = pendingOfferRef.current;
      if (pending?.callId === invitation.callId) {
        await answerOffer(invitation.remote, pending.description, invitation.callId, stream);
        await signalTo(invitation.remote, 'call-accept', { callId: invitation.callId });
        setCall((current) => current ? { ...current, status: 'connected' } : current);
      }
    } catch (cause) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setCall(null);
      callRef.current = null;
      setError(cause.response?.data?.message || cause.message || t('क्यामेरा वा माइक्रोफोन खोल्न सकिएन।', 'Could not access the camera or microphone.'));
    } finally { setBusy(false); }
  }

  async function declineCall() {
    const invitation = incomingCallRef.current;
    if (invitation) await signalTo(invitation.remote, 'call-reject', { callId: invitation.callId }).catch(() => {});
    incomingCallRef.current = null;
    pendingOfferRef.current = null;
    setIncomingCall(null);
    finishCall(true);
  }

  const finishCall = useCallback(async (sendEnd) => {
    const active = callRef.current || incomingCallRef.current;
    if (sendEnd && active?.remote && active.callId) {
      await signalTo(active.remote, 'call-end', { callId: active.callId }).catch(() => {});
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    peerRef.current?.pc.close();
    peerRef.current = null;
    channelRef.current = null;
    incomingCallRef.current = null;
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    callRef.current = null;
    setCall(null);
    setIncomingCall(null);
    setPeerState('disconnected');
    setRestartKey((value) => value + 1);
  }, [signalTo]);

  useEffect(() => { finishCallRef.current = finishCall; }, [finishCall]);

  async function clearConversation() {
    if (!database || !target) return;
    const approved = window.confirm(t('यो यन्त्रमा सुरक्षित सबै सन्देश र फाइल हटाउने?', 'Delete all messages and files saved for this contact on this device?'));
    if (!approved) return;
    try {
      await clearLocalConversation(database, target.conversationId);
      setMessages([]);
      setError('');
    } catch (cause) { setError(cause.message || t('स्थानीय च्याट हटाउन सकिएन।', 'Could not delete local chat data.')); }
  }

  const isOnline = peerState === 'connected' && channelRef.current?.readyState === 'open';
  const initials = useMemo(() => (target?.name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), [target?.name]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-white"><MessageCircle size={25} aria-hidden="true" /></span>
            <div>
              <h1 className="text-2xl font-bold text-gov-blue">{t('स्मार्ट फार्मिङ टोली च्याट', 'Smart Farming team chat')}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{t('सन्देश र फाइलहरू तपाईं र सम्पर्कको यन्त्रबीच सिधै पठाइन्छन्। च्याट सामग्री सर्भरमा भण्डारण हुँदैन।', 'Messages and files travel directly between your device and the contact’s device. Chat content is not stored on the server.')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"><Wifi size={14} aria-hidden="true" /> {t('प्रत्यक्ष यन्त्र जडान', 'Direct device connection')}</span>
        </div>
      </header>

      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-sky-200 bg-sky-50 text-sky-900'}`}>
        {error ? <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Wifi size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <span className="min-w-0 flex-1">{error || notice}</span>
        {error && <button type="button" onClick={() => setError('')} className="rounded p-1" aria-label={t('त्रुटि बन्द गर्नुहोस्', 'Dismiss error')}><X size={16} aria-hidden="true" /></button>}
      </div>}

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Users size={18} aria-hidden="true" /> {t('सम्पर्कहरू', 'Contacts')}</h2>
            <button type="button" onClick={refreshContacts} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50">{t('ताजा', 'Refresh')}</button>
          </div>
          {loading ? <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />{t('लोड हुँदैछ…', 'Loading…')}</p>
            : contacts.length === 0 ? <p className="p-4 text-sm text-slate-500">{t('स्मार्ट फार्मिङ पहुँच भएका अरू प्रयोगकर्ता भेटिएनन्।', 'No other users with Smart Farming access were found.')}</p>
              : <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                {contacts.map((contact) => {
                  const online = contact.onlineSessions?.length > 0;
                  const active = String(contact.id) === selectedId;
                  return <li key={contact.id}>
                    <button type="button" disabled={Boolean(call)} onClick={() => selectContact(contact)} aria-pressed={active} className={`flex w-full items-center gap-3 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{contactLabel(contact).slice(0, 1).toUpperCase()}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900">{contactLabel(contact)}</span><span className="block truncate text-xs text-slate-500">{online ? t(`${contact.onlineSessions.length} यन्त्र अनलाइन`, `${contact.onlineSessions.length} device(s) online`) : (contact.title || t('अफलाइन', 'Offline'))}</span></span>
                    </button>
                  </li>;
                })}
              </ul>}
        </aside>

        <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={t('च्याट', 'Chat')}>
          <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-900">{initials || <Users size={18} aria-hidden="true" />}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate font-semibold text-slate-900">{target?.name || t('सम्पर्क छान्नुहोस्', 'Choose a contact')}</h2><p className="text-xs text-slate-500">{!target ? t('सन्देश सुरु गर्न टोलीबाट प्रयोगकर्ता छान्नुहोस्।', 'Choose a team member to start a conversation.') : !signalingReady ? t('सिग्नल सर्भरसँग जडान हुँदैछ…', 'Connecting to signaling…') : isOnline ? t('प्रत्यक्ष जडान सुरक्षित छ', 'Direct connection is ready') : selectedSession ? t('जडान हुँदैछ…', 'Connecting…') : t('सम्पर्कका यन्त्रहरू अफलाइन छन्', 'The contact’s devices are offline')}</p></div>
            {target && <>
              <button type="button" disabled={!isOnline || busy} onClick={() => startCall('audio')} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-slate-200 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('आवाज कल गर्नुहोस्', 'Start voice call')} title={t('आवाज कल', 'Voice call')}><Phone size={18} aria-hidden="true" /></button>
              <button type="button" disabled={!isOnline || busy} onClick={() => startCall('video')} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-slate-200 text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('भिडियो कल गर्नुहोस्', 'Start video call')} title={t('भिडियो कल', 'Video call')}><Video size={18} aria-hidden="true" /></button>
              <button type="button" onClick={clearConversation} className="grid min-h-10 min-w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700" aria-label={t('यस यन्त्रको च्याट हटाउनुहोस्', 'Delete this device’s chat')} title={t('यस यन्त्रबाट मेटाउनुहोस्', 'Delete local chat')}><Trash2 size={17} aria-hidden="true" /></button>
            </>}
          </header>

          {incomingCall && <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-900"><Phone size={18} aria-hidden="true" /></span>
            <p className="min-w-0 flex-1 text-sm text-amber-950"><strong>{incomingCall.fromName}</strong> {incomingCall.media === 'video' ? t('ले भिडियो कल गर्दै हुनुहुन्छ।', 'is calling by video.') : t('ले आवाज कल गर्दै हुनुहुन्छ।', 'is calling by voice.')}</p>
            <button type="button" disabled={busy} onClick={acceptCall} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('स्वीकार', 'Accept')}</button>
            <button type="button" disabled={busy} onClick={declineCall} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900">{t('अस्वीकार', 'Decline')}</button>
          </div>}

          {call && <div className="border-b border-slate-100 bg-slate-950 p-3 text-white">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{call.media === 'video' ? t('भिडियो कल', 'Video call') : t('आवाज कल', 'Voice call')} · {call.status === 'connected' ? t('जडान भयो', 'Connected') : call.status === 'calling' ? t('कल गर्दै…', 'Calling…') : t('जडान हुँदैछ…', 'Connecting…')}</p>
              <button type="button" onClick={() => finishCall(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white"><PhoneOff size={17} aria-hidden="true" />{t('कल अन्त्य', 'End call')}</button>
            </div>
            {call.media === 'video' && <div className="grid gap-2 sm:grid-cols-2">
              <video ref={remoteVideo} autoPlay playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label={t('सम्पर्कको भिडियो', 'Contact video')} />
              <video ref={localVideo} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label={t('तपाईंको भिडियो', 'Your video')} />
            </div>}
            {call.media === 'audio' && <><audio ref={remoteVideo} autoPlay /><audio ref={localVideo} autoPlay muted /></>}
          </div>}

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50/70 p-4" role="log" aria-label={t('स्थानीय च्याट सन्देशहरू', 'Local chat messages')} aria-relevant="additions text">
            {!target && <div className="m-auto max-w-sm text-center text-sm text-slate-500"><MessageCircle size={28} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />{t('सम्पर्क अनलाइन भएपछि सन्देश, फाइल वा कल सुरु गर्न सक्नुहुन्छ।', 'When a contact is online, you can exchange messages and files or start a call.')}</div>}
            {target && visibleMessages.length === 0 && <div className="m-auto max-w-sm text-center text-sm text-slate-500">{t('यो यन्त्रमा अझै सन्देश छैन।', 'There are no messages saved on this device yet.')}</div>}
            {visibleMessages.map((message) => {
              const mine = String(message.senderId) === String(identity?.userId);
              return <article key={message.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? 'self-end rounded-tr-sm bg-emerald-800 text-white' : 'self-start rounded-tl-sm border border-slate-200 bg-white text-slate-900'}`}>
                <p className="mb-1 text-[11px] font-semibold opacity-75">{mine ? t('तपाईं', 'You') : (message.senderName || target?.name)}</p>
                {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                {message.attachmentId && <button type="button" onClick={() => downloadFile(message)} className={`mt-1 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm ${mine ? 'border-white/30 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
                  {message.mimeType?.startsWith('video/') ? <Video size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}
                  <span className="min-w-0 flex-1"><span className="block max-w-52 truncate font-medium">{message.fileName}</span><span className="block text-xs opacity-75">{fileSize(message.size || 0)}</span></span><Download size={16} aria-hidden="true" />
                </button>}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70"><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString(lang === 'ne' ? 'ne-NP' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</time>{mine && <span>{message.status === 'delivered' ? <Check size={13} aria-label={t('पुग्यो', 'Delivered')} /> : message.status === 'failed' ? '!' : message.status === 'sending' ? '…' : '✓'}</span>}</div>
              </article>;
            })}
            {transfer && <div className="self-center rounded-full bg-white px-3 py-1.5 text-xs text-slate-600 shadow">{transfer.direction === 'sending' ? t('पठाउँदै', 'Sending') : t('प्राप्त हुँदै', 'Receiving')} {transfer.name} · {fileSize(transfer.received)} / {fileSize(transfer.size)}</div>}
            <div ref={messagesEnd} />
          </div>

          <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4">
            <input ref={fileInput} type="file" className="sr-only" onChange={(event) => sendFile(event.target.files?.[0])} aria-label={t('फाइल छान्नुहोस्', 'Choose a file')} />
            <button type="button" disabled={!isOnline || busy} onClick={() => fileInput.current?.click()} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40" aria-label={t('फाइल वा भिडियो पठाउनुहोस्', 'Send a file or video')} title={t('फाइल वा भिडियो', 'File or video')}><Paperclip size={19} aria-hidden="true" /></button>
            <label className="sr-only" htmlFor="smart-chat-message">{t('सन्देश लेख्नुहोस्', 'Write a message')}</label>
            <textarea id="smart-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} maxLength={3000} disabled={!isOnline || busy} placeholder={!target ? t('पहिले सम्पर्क छान्नुहोस्', 'Choose a contact first') : isOnline ? t('सन्देश लेख्नुहोस्…', 'Write a message…') : t('प्रत्यक्ष जडान पर्खँदै…', 'Waiting for a direct connection…')} className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50" />
            <button type="submit" disabled={!isOnline || busy || !draft.trim()} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('सन्देश पठाउनुहोस्', 'Send message')}>{busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}</button>
          </form>
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-slate-500">{t('फाइलको अधिकतम आकार १०० MB हो। सन्देश र फाइलहरू यस ब्राउजरको यन्त्रमा मात्रै सुरक्षित हुन्छन्; अर्को यन्त्रमा स्वतः सिङ्क हुँदैनन्।', 'Files are limited to 100 MB. Messages and files are saved only in this browser on this device; they do not sync automatically to another device.')}</p>
        </section>
      </div>
    </div>
  );
}

async function getLocalMessageSafe(database, messageId) {
  const transaction = database.transaction('messages', 'readonly');
  const request = transaction.objectStore('messages').get(messageId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
