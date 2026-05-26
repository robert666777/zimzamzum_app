import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  MdAdd,
  MdClose,
  MdDelete,
  MdEdit,
  MdPause,
  MdPlayArrow,
  MdSchedule,
  MdAccessTime,
} from 'react-icons/md';
import axios from '../utils/axios';
import { useSelector } from 'react-redux';
import {
  EDUCATION_PLATFORM_ICON_URL,
  PLATFORM_LOGO_FALLBACK_URLS,
  resolvePlatformLogoUrl,
} from '../utils/educationPlatformIcons';
import { useI18n } from '../i18n/I18nContext';
import { getUserStorageKey, STORAGE_KEYS } from '../utils/userStorage';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function newId() {
  return crypto.randomUUID?.() ?? `sw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = String(m ?? 0).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

function summarizeFrequency(row) {
  const t = row.time || '09:00';
  switch (row.frequency) {
    case 'daily':
      return `Daily · ${formatTime12(t)}`;
    case 'specific_days': {
      const days = (row.daysOfWeek || [])
        .slice()
        .sort((a, b) => a - b)
        .map((d) => SHORT_DAYS[d] || d);
      return `Specific days · ${days.join(', ') || '—'} · ${formatTime12(t)}`;
    }
    case 'every_hour':
      return 'Every hour';
    default:
      return '';
  }
}

const Page = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 28px;
  overflow: hidden;
  background: #1a1a1a;
  color: #fff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  flex-shrink: 0;
`;

const Title = styled.h1`
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: #fff;
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: var(--accent-blue);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(33, 53, 173, 0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    background: var(--accent-blue-hover);
    box-shadow: 0 6px 20px rgba(33, 53, 173, 0.5);
  }
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
`;

const EmptyWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  color: rgba(255, 255, 255, 0.45);
`;

const EmptyIcon = styled.div`
  font-size: 72px;
  opacity: 0.25;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 8px;
`;

const EmptySub = styled.div`
  font-size: 14px;
  max-width: 360px;
  line-height: 1.5;
  margin-bottom: 22px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`;

const WorkflowCard = styled.article`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }
`;

const CardTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  width: fit-content;
  ${(p) =>
    p.$active
      ? `
    background: rgba(34, 197, 94, 0.18);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.35);
  `
      : `
    background: rgba(250, 204, 21, 0.12);
    color: #fde047;
    border: 1px solid rgba(250, 204, 21, 0.25);
  `}
`;

const Dot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
`;

const Desc = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PlatformRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.2);
  border: 1px solid rgba(37, 99, 235, 0.35);
  font-size: 12px;
  font-weight: 600;
  color: #93c5fd;
`;

const PlatLogo = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
`;

const FreqRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }
`;

const IconBtnDanger = styled(IconBtn)`
  margin-left: auto;
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.25);

  &:hover {
    background: rgba(248, 113, 113, 0.12);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 24px;
`;

const Modal = styled.div`
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: #23232f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 22px 22px 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
`;

const ModalHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
`;

const CloseX = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  padding: 4px;
  display: flex;

  &:hover {
    color: #fff;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  outline: none;

  &:focus {
    border-color: rgba(37, 99, 235, 0.55);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.28);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 96px;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  resize: vertical;
  outline: none;

  &:focus {
    border-color: rgba(37, 99, 235, 0.55);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.28);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 11px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  cursor: pointer;
  outline: none;

  option {
    background: #1e1e28;
    color: #fff;
  }
`;

const FieldGap = styled.div`
  margin-bottom: 16px;
`;

const PlatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
`;

const PlatformDetailsBlock = styled.div`
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
`;

const PlatformDetailRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  &:last-child { margin-bottom: 0; }
`;

const PlatformDetailLabel = styled.span`
  color: rgba(255, 255, 255, 0.5);
  min-width: 80px;
`;

const PlatformDetailValue = styled.span`
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
`;

const AutomationToggleButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  margin-top: 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.2);
    border-color: rgba(37, 99, 235, 0.5);
  }
`;

const AutomationGrid = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
`;

const AutomationTile = styled.button`
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.15);
    border-color: rgba(37, 99, 235, 0.4);
  }
`;

const PlatTile = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.2);
  border: 2px solid
    ${(p) => (p.$selected ? 'rgba(37, 99, 235, 0.85)' : 'rgba(255, 255, 255, 0.1)')};
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  ${(p) =>
    p.$selected &&
    `
    background: rgba(37, 99, 235, 0.15);
  `}
`;

const PlatTileLogo = styled.img`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  object-fit: contain;
  flex-shrink: 0;
`;

const PlatFallback = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
`;

const PlatName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DayRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const DayChip = styled.button`
  min-width: 40px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: ${(p) =>
    p.$on ? 'rgba(37, 99, 235, 0.45)' : 'rgba(0, 0, 0, 0.25)'};
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${(p) =>
      p.$on ? 'rgba(37, 99, 235, 0.55)' : 'rgba(255, 255, 255, 0.08)'};
  }
`;

const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  margin-top: 4px;

  input {
    width: 16px;
    height: 16px;
    accent-color: #2563eb;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const GhostBtn = styled.button`
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.75);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'specific_days', label: 'Specific days' },
  { value: 'every_hour', label: 'Every hour' },
];

function PlatformLogoWithFallback({ platformId, platformName, logoHint, ImgComponent = PlatLogo }) {
  const primary = resolvePlatformLogoUrl(platformId, logoHint);
  const candidates = useMemo(() => {
    const fb = PLATFORM_LOGO_FALLBACK_URLS[platformId] || [];
    return [primary, ...fb].filter(Boolean);
  }, [primary, platformId]);
  const [failIndex, setFailIndex] = useState(0);

  useEffect(() => {
    setFailIndex(0);
  }, [platformId, logoHint, primary]);

  if (failIndex >= candidates.length || candidates.length === 0) {
    const letter = String(platformName || platformId || '?')[0].toUpperCase();
    return <PlatFallback>{letter}</PlatFallback>;
  }

  return (
    <ImgComponent
      src={candidates[failIndex]}
      alt=""
      onError={() => setFailIndex((i) => i + 1)}
    />
  );
}

export default function Schedule() {
  const { t } = useI18n();
  const accessToken = useSelector((s) => s.accessToken);
  const user = useSelector((s) => s.user);
  const [rows, setRows] = useState([]);
  const [platformOptions, setPlatformOptions] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAutomations, setShowAutomations] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [time, setTime] = useState('10:00');
  const [daysOfWeek, setDaysOfWeek] = useState(() => [1]);
  const [backgroundMode, setBackgroundMode] = useState(false);

  // Load scheduled tasks with user-specific key
  useEffect(() => {
    if (!user?.id) return;
    const STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.SCHEDULED_TASKS, user);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setRows(Array.isArray(arr) ? arr : []);
      if (window.electronAPI?.syncScheduledTasks) {
        window.electronAPI.syncScheduledTasks(arr);
      }
    } catch {
      setRows([]);
    }
  }, [user?.id]);

  // Load automations with user-specific key
  useEffect(() => {
    if (!user?.id) return;
    const AUTOMATIONS_STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.AUTOMATIONS, user);
    const saved = localStorage.getItem(AUTOMATIONS_STORAGE_KEY);
    if (saved) {
      try {
        setAutomations(JSON.parse(saved) || []);
      } catch (e) {
        console.error('Failed to load automations:', e);
      }
    }
  }, [user?.id]);

  const persist = useCallback((next) => {
    setRows(next);
    if (user?.id) {
      const STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.SCHEDULED_TASKS, user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    if (window.electronAPI?.syncScheduledTasks) {
      window.electronAPI.syncScheduledTasks(next);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const PLATFORMS_STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.PLATFORMS, user);
    const fallback = ['chaoxing', 'icourse', 'xuetangx', 'zhihuishu'].map((id) => ({
      id,
      name: id,
      logoUrl: EDUCATION_PLATFORM_ICON_URL[id],
      letter: id[0].toUpperCase(),
    }));
    
    const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const list = (data || []).map((p) => {
          const id = p.id;
          const logoUrl = resolvePlatformLogoUrl(id, p.logo);
          return {
            id,
            name: p.name,
            logoUrl,
            letter:
              typeof p.logo === 'string' && p.logo.length <= 2 && !logoUrl
                ? p.logo
                : (p.name || '?')[0],
            loginUrl: p.login_url || p.loginUrl,
            username: p.username || null,
            password: p.password || null,
          };
        });
        if (list.length > 0) {
          setPlatformOptions(list);
          return;
        }
      } catch (e) {
        console.error('Failed to load platforms from localStorage:', e);
      }
    }

    if (!accessToken) {
      setPlatformOptions(fallback);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get('/automations/platforms', {
          headers: { Authorization: 'Bearer ' + accessToken },
        });
        if (cancelled) return;
        const list = (data || []).map((p) => {
          const id = p.id;
          const logoUrl = resolvePlatformLogoUrl(id, p.logo);
          return {
            id,
            name: p.name,
            logoUrl,
            letter:
              typeof p.logo === 'string' && p.logo.length <= 2 && !logoUrl
                ? p.logo
                : (p.name || '?')[0],
            loginUrl: p.login_url || p.loginUrl,
            username: p.username || null,
            password: p.password || null,
          };
        });
        setPlatformOptions(list.length > 0 ? list : fallback);
      } catch {
        if (cancelled) return;
        setPlatformOptions(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPlatformId(platformOptions[0]?.id || 'chaoxing');
    setFrequency('daily');
    setTime('10:00');
    setDaysOfWeek([1]);
    setBackgroundMode(false);
    setShowAutomations(false);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setName(row.name || '');
    setDescription(row.description || '');
    setPlatformId(row.platformId || platformOptions[0]?.id || '');
    setFrequency(row.frequency || 'daily');
    setTime(row.time || '10:00');
    setDaysOfWeek(Array.isArray(row.daysOfWeek) ? row.daysOfWeek : [1]);
    setBackgroundMode(!!row.backgroundMode);
    setShowAutomations(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setShowAutomations(false);
  };

  const validate = () => {
    if (!name.trim()) return 'Please enter a schedule name.';
    if (!platformId) return 'Select a platform.';
    if (frequency === 'every_hour') return null;
    if (!time) return 'Choose a time.';
    if (frequency === 'specific_days' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return 'Select at least one day.';
    }
    return null;
  };

  const submitModal = () => {
    const err = validate();
    if (err) {
      window.alert(err);
      return;
    }
    const plat = platformOptions.find((p) => p.id === platformId);
    const payload = {
      id: editingId || newId(),
      name: name.trim(),
      description: description.trim(),
      platformId,
      platformName: plat?.name || platformId,
      platformLogoUrl: plat?.logoUrl || null,
      platformLoginUrl: plat?.loginUrl || null,
      platformUsername: plat?.username || null,
      platformPassword: plat?.password || null,
      frequency,
      time: frequency === 'every_hour' ? '' : time,
      daysOfWeek: frequency === 'specific_days' ? [...new Set(daysOfWeek)].sort((a, b) => a - b) : [],
      backgroundMode,
      status: editingId ? rows.find((r) => r.id === editingId)?.status || 'active' : 'active',
      createdAt: editingId ? rows.find((r) => r.id === editingId)?.createdAt : new Date().toISOString(),
    };

    if (editingId) {
      persist(rows.map((r) => (r.id === editingId ? { ...r, ...payload } : r)));
    } else {
      persist([payload, ...rows]);
    }
    closeModal();
  };

  const togglePause = (row) => {
    persist(
      rows.map((r) =>
        r.id === row.id
          ? { ...r, status: r.status === 'active' ? 'paused' : 'active' }
          : r
      )
    );
  };

  const removeRow = (row) => {
    if (!window.confirm(`Delete schedule "${row.name}"?`)) return;
    persist(rows.filter((r) => r.id !== row.id));
  };

  const toggleDay = (d) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  

  return (
    <Page>
      <TopBar>
        <Title>{t('schedule.title')}</Title>
        <PrimaryBtn type="button" onClick={openCreate}>
          <MdAdd size={20} /> {t('schedule.createSchedule')}
        </PrimaryBtn>
      </TopBar>

      <ScrollArea>
        {rows.length === 0 ? (
          <EmptyWrap>
            <EmptyIcon>
              <MdSchedule />
            </EmptyIcon>
            <EmptyTitle>{t('schedule.title')}</EmptyTitle>
            <EmptySub>{t('schedule.description')}</EmptySub>
            <PrimaryBtn type="button" onClick={openCreate}>
              <MdAdd size={20} /> {t('schedule.createSchedule')}
            </PrimaryBtn>
          </EmptyWrap>
        ) : (
          <CardGrid>
            {rows.map((row) => (
              <WorkflowCard key={row.id}>
                <CardTitle>{row.name}</CardTitle>
                <StatusPill $active={row.status === 'active'}>
                  <Dot />
                  {row.status === 'active' ? 'Active' : 'Paused'}
                </StatusPill>
                {row.description ? <Desc>{row.description}</Desc> : null}
                <PlatformRow>
                  <PlatformLogoWithFallback
                    platformId={row.platformId}
                    platformName={row.platformName || row.platformId}
                    logoHint={row.platformLogoUrl}
                  />
                  {row.platformName || row.platformId}
                </PlatformRow>
                <FreqRow>
                  <MdAccessTime size={18} style={{ opacity: 0.5 }} />
                  {summarizeFrequency(row)}
                </FreqRow>
                <CardActions>
              <IconBtn
                type="button"
                title={row.status === 'active' ? 'Pause' : 'Resume'}
                onClick={() => togglePause(row)}
              >
                {row.status === 'active' ? <MdPause size={20} /> : <MdPlayArrow size={20} />}
              </IconBtn>
              <IconBtn type="button" title="Edit" onClick={() => openEdit(row)}>
                <MdEdit size={20} />
              </IconBtn>
              <IconBtnDanger type="button" title="Delete" onClick={() => removeRow(row)}>
                <MdDelete size={20} />
              </IconBtnDanger>
            </CardActions>
              </WorkflowCard>
            ))}
          </CardGrid>
        )}
      </ScrollArea>

      {modalOpen && (
        <Overlay onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <Modal onMouseDown={(e) => e.stopPropagation()}>
            <ModalHead>
              <ModalTitle>{editingId ? t('schedule.editSchedule') : t('schedule.createSchedule')}</ModalTitle>
              <CloseX type="button" onClick={closeModal} aria-label="Close">
                <MdClose size={22} />
              </CloseX>
            </ModalHead>

            <FieldGap>
              <Label>{t('schedule.scheduleName')}</Label>
              <Input
                placeholder={t('schedule.scheduleNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldGap>

            <FieldGap>
              <Label>{t('schedule.taskDesc')}</Label>
              <TextArea
                placeholder={t('schedule.taskDescPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <AutomationToggleButton
                type="button"
                onClick={() => setShowAutomations(!showAutomations)}
              >
                {showAutomations ? t('schedule.hideAutomations') : t('schedule.scheduleAutomation')}
              </AutomationToggleButton>
              {showAutomations && (
                <AutomationGrid>
                  {automations.length === 0 ? (
                    <AutomationTile type="button" disabled>{t('schedule.noAutomations')}</AutomationTile>
                  ) : (
                    automations.map((auto) => (
                      <AutomationTile
                        key={auto.id}
                        type="button"
                        onClick={() => {
                          setName(auto.name || '');
                          setDescription(auto.taskDescription || '');
                          setPlatformId(auto.platform || '');
                        }}
                      >
                        {auto.name}
                      </AutomationTile>
                    ))
                  )}
                </AutomationGrid>
              )}
            </FieldGap>

            <FieldGap>
              <Label>{t('schedule.platform')}</Label>
              <PlatGrid>
                {platformOptions.map((p) => (
                  <PlatTile
                    key={p.id}
                    type="button"
                    $selected={platformId === p.id}
                    onClick={() => setPlatformId(p.id)}
                  >
                    <PlatformLogoWithFallback
                      platformId={p.id}
                      platformName={p.name}
                      logoHint={p.logoUrl}
                      ImgComponent={PlatTileLogo}
                    />
                    <PlatName title={p.name}>{p.name}</PlatName>
                  </PlatTile>
                ))}
              </PlatGrid>
              {(() => {
                const selected = platformOptions.find(p => p.id === platformId);
                if (!selected) return null;
                return (
                  <PlatformDetailsBlock>
                    <PlatformDetailRow>
                      <PlatformDetailLabel>Platform:</PlatformDetailLabel>
                      <PlatformDetailValue>{selected.name}</PlatformDetailValue>
                    </PlatformDetailRow>
                    <PlatformDetailRow>
                      <PlatformDetailLabel>Login URL:</PlatformDetailLabel>
                      <PlatformDetailValue>{selected.loginUrl || '—'}</PlatformDetailValue>
                    </PlatformDetailRow>
                    <PlatformDetailRow>
                      <PlatformDetailLabel>Username:</PlatformDetailLabel>
                      <PlatformDetailValue>{selected.username || '—'}</PlatformDetailValue>
                    </PlatformDetailRow>
                    <PlatformDetailRow>
                      <PlatformDetailLabel>Password:</PlatformDetailLabel>
                      <PlatformDetailValue>{selected.password || '—'}</PlatformDetailValue>
                    </PlatformDetailRow>
                  </PlatformDetailsBlock>
                );
              })()}
            </FieldGap>

            <FieldGap>
              <Label>{t('schedule.frequency')}</Label>
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`schedule.${o.value}`) || o.label}
                  </option>
                ))}
              </Select>
            </FieldGap>

            {frequency !== 'every_hour' && (
              <FieldGap>
                <Label>{t('schedule.time')}</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </FieldGap>
            )}

            {frequency === 'specific_days' && (
              <FieldGap>
                <Label>{t('schedule.days')}</Label>
                <DayRow>
                  {SHORT_DAYS.map((label, d) => (
                    <DayChip
                      key={label}
                      type="button"
                      $on={daysOfWeek.includes(d)}
                      onClick={() => toggleDay(d)}
                    >
                      {label}
                    </DayChip>
                  ))}
                </DayRow>
              </FieldGap>
            )}

            <CheckRow>
              <input
                type="checkbox"
                checked={backgroundMode}
                onChange={(e) => setBackgroundMode(e.target.checked)}
              />
              {t('schedule.runInBackground')}
            </CheckRow>

            <ModalFooter>
              <GhostBtn type="button" onClick={closeModal}>
                {t('schedule.cancel')}
              </GhostBtn>
              <PrimaryBtn type="button" onClick={submitModal}>
                {editingId ? t('schedule.save') : t('schedule.create')}
              </PrimaryBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
