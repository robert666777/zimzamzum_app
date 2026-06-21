import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import zimzamzum_logo from '../assets/zimzamzum_logo_ic_only_white.png'
import { AvatarButton, IconButton } from '../components/Elements/Button';
import { useSelector, useDispatch } from 'react-redux';
import axios from '../utils/axios';
import { FaStopCircle } from 'react-icons/fa';
import constants from '../utils/constants';
import { MdOutlineSchedule } from 'react-icons/md';
import { GiBrain } from 'react-icons/gi';
import { setError, setUpgradePrompt } from '../store';
import { useI18n } from '../i18n/I18nContext';
import paymentApi from '../utils/paymentApi';

const Container = styled.div`
  background: #000000;
  padding: 0px 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100%;
  transition: height 0.3s ease;
`;

const Input = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: white;
  font-size: 14px;
  outline: none;
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  margin-left: 8px;
  width: 21px;
  height: 21px;
  border: 2px solid white;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const RecentTasksSection = styled.div`
  margin-top: 5px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }
`;

const RecentTasksList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
`;

const TaskItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }
`;

const EmptyTasks = styled.div`
  padding: 20px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  text-align: center;
`;

const SectionLabel = styled.div`
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
`;

const ModeToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: ${({ active }) => (active ? 'var(--accent-blue)' : 'transparent')};
  color: ${({ disabled }) => (disabled ? 'rgba(255, 255, 255, 0.4)' : '#fff')};
  border: thin solid ${({ active, disabled }) =>
    disabled ? 'rgba(255, 255, 255, 0.1)' : (active ? 'var(--accent-blue)' : 'rgba(255,255,255,0.2)')};
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11.5px;
  transition: all 0.2s ease;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};

  &:hover {
    background-color: ${({ active, disabled }) =>
      disabled ? 'transparent' : (active ? 'var(--accent-blue-hover)' : 'rgba(255,255,255,0.1)')};
  }

  svg {
    font-size: 15px;
  }
`;

export default function Overlay() {
  const [expanded, setExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [runningThreadId, setRunningThreadId] = useState(null);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [threads, setThreads] = useState([]);

  const accessToken = useSelector(state => state.accessToken);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useI18n();

  const fetchThreads = async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get('/threads', {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
        }
      });
      setThreads(response.data || []);
    } catch (error) {
      console.error('Failed to fetch threads:', error);
    }
  };

  const executeTask = () => {
    if (loading) {
      return;
    }
    createThread();
  };

  const handleRecentTaskClick = (threadId) => {
    setShowSuggestions(false);
    setExpanded(false);
    if (window.electronAPI?.openThreadInMainApp) {
      window.electronAPI.openThreadInMainApp(threadId);
    } else {
      navigate(`/threads/${threadId}`);
    }
  };

  const toggleOverlay = async () => {
    if (!expanded) {
      if (runningThreadId === null) {
        window.electronAPI.expandOverlay(true);
        setExpanded(true);
        setShowSuggestions(true);
        fetchThreads();
      } else {
        window.electronAPI.expandOverlay(false);
        setExpanded(true);
      }
    } else {
      window.electronAPI.minimizeOverlay();
      setExpanded(false);
      setShowSuggestions(false);
    }
  };

  const cancelRunningTask = (tid) => {
    setLoading(true);
    axios.post(`/threads/${tid}/cancel_task`, {}, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      setLoading(false);
      window.electronAPI.stopAIAgent();
      setRunningThreadId(null);
    }).catch((error) => {
      setLoading(false);
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  };

  const createThread = async (prompt = null) => {
    if (messageText.length === 0 && prompt === null) {
      return;
    }
    
    // Vérifier le plan depuis Supabase (source de vérité)
    if (accessToken) {
      try {
        const userPlanData = await paymentApi.getUserPlan(accessToken);
        const planId = userPlanData.plan_id || 'free';
        
        // Si le plan vient d'expirer, afficher un message (mais ne pas bloquer)
        if (userPlanData.plan_just_expired) {
          dispatch(setError(true, t('profile.planExpired') || 'Your paid plan has expired. You have been moved to the free plan with 10 min/day.'));
          setTimeout(() => dispatch(setError(false, '')), 8000);
        }
        
        // Pour le free plan seulement : vérifier le quota de minutes
        if (planId === 'free') {
          const canStart = await window.electronAPI.canStartTask();
          if (!canStart) {
            dispatch(setError(true, t('upgradePlans.dailyMinutesUsed')));
            setTimeout(() => dispatch(setError(false, '')), 5000);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking user plan:', error);
      }
    }

    const data = {task: prompt !== null ? prompt : messageText, background_mode: backgroundMode, extended_thinking_mode: thinkingMode};
    setMessageText('');
    setLoading(true);
    axios.post('/threads', data, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then(async (response) => {
      setLoading(false);
      if (response.data.type === 'desktop_task') {
        if (!backgroundMode && response.data.is_background_mode_requested) {
          const ready = await window.electronAPI.isBackgroundModeReady();
          if (!ready) {
            cancelRunningTask();
            return;
          }
        }
        setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
        setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
        window.electronAPI.setLastThinkingModeValue((thinkingMode || response.data.is_extended_thinking_mode_requested).toString());
        window.electronAPI.launchAIAgent(
          process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
          response.data.thread_id,
          backgroundMode || response.data.is_background_mode_requested
        );
        setRunningThreadId(response.data.thread_id);
      }
    }).catch((error) => {
      setLoading(false);
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  };

  const onBGModeToggleChange = () => {
    // Background mode is disabled - message shown on hover
  };

  useEffect(() => {
    if (window.electronAPI?.onAIAgentLaunch) {
      window.electronAPI.onAIAgentLaunch((threadId) => {
        window.electronAPI.expandOverlay(false);
        setExpanded(true);
        setRunningThreadId(threadId);
        setShowSuggestions(false);
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentExit) {
      window.electronAPI.onAIAgentExit(() => {
        setRunningThreadId(null);
        window.electronAPI.expandOverlay(true);
        setShowSuggestions(true);
      });
    }
  }, []);

  useEffect(() => {
    const asyncTask = async () => {
      const lastBackgroundModeValue = await window.electronAPI.getLastBackgroundModeValue();
      setBackgroundMode(lastBackgroundModeValue === 'true');
    };
    asyncTask();
  }, []);

  useEffect(() => {
    const asyncTask = async () => {
      const lastThinkingModeValue = await window.electronAPI.getLastThinkingModeValue();
      setThinkingMode(lastThinkingModeValue === 'true');
    };
    asyncTask();
  }, []);

  return (
    <Container>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '60px'}}>
        <button
          onClick={() => toggleOverlay()}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={zimzamzum_logo}
            alt='zimzamzum'
            height={40}
            width={40}
            style={{userSelect: 'none', pointerEvents: 'none'}}
          />
        </button>
        {expanded && (
          <>
            <div style={{width: '10px'}} />
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Ask zimzamzum..."
              onKeyDown={(e) => e.key === 'Enter' && executeTask()}
            />
            {!loading && runningThreadId === null && (
              <> 
                <div style={{width: '5px'}} />
                <ToggleContainer>
                  <ModeToggle
                    active={false}
                    onClick={() => onBGModeToggleChange()}
                    disabled
                    title="Coming soon! This feature allows zimzamzum to run tasks in the background while you continue working on your computer."
                  >
                    <MdOutlineSchedule />
                  </ModeToggle>
                </ToggleContainer>
                <div style={{width: '5px'}} />
                <ToggleContainer>
                  <ModeToggle
                    active={thinkingMode}
                    onClick={() => setThinkingMode(!thinkingMode)}
                    title="Extended Thinking Mode: Enables deeper analysis for complex tasks."
                  >
                    <GiBrain />
                  </ModeToggle>
                </ToggleContainer>
              </>
            )}
            {(loading || runningThreadId !== null) && <Spinner />}
            <div style={{width: '5px'}} />
            {
            runningThreadId !== null && <>
                <IconButton iconSize='21px' color='white' onClick={() => cancelRunningTask(runningThreadId)}
                  disabled={loading}>
                  <FaStopCircle />
                </IconButton>
              </>
            }
          </>
        )}
      </div>
      {expanded && showSuggestions && (
        <RecentTasksSection>
          <SectionLabel>Recent Tasks</SectionLabel>
          {threads.length === 0 ? (
            <EmptyTasks>No recent tasks</EmptyTasks>
          ) : (
            <RecentTasksList>
              {threads.slice(0, 20).map((thread) => (
                <TaskItem
                  key={thread.id}
                  onClick={() => handleRecentTaskClick(thread.id)}
                >
                  {thread.title || 'Untitled task'}
                </TaskItem>
              ))}
            </RecentTasksList>
          )}
        </RecentTasksSection>
      )}
    </Container>
  );
}