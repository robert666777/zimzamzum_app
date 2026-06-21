import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from '../utils/axios';
import constants from '../utils/constants';
import { setLoadingDialog, setError, setUpgradePrompt } from '../store';
import ChatMessage from '../components/ChatMessage';
import { FlexSpacer } from '../components/Elements/SmallElements';
import NATextArea from '../components/Elements/TextAreas';
import { IconButton } from '../components/Elements/Button';
import { MdEdit, MdDelete, MdArrowUpward, MdApps, MdAdd } from 'react-icons/md';
import { FaStopCircle } from 'react-icons/fa';
import ClipLoader from 'react-spinners/ClipLoader';
import { Text } from '../components/Elements/Typography';
import ThreadDialog from '../components/DataDialogs/ThreadDialog';
import YesNoDialog from '../components/Elements/YesNoDialog';
import { useNavigate } from 'react-router-dom';
import { MdOutlineSchedule } from 'react-icons/md';
import { GiBrain } from 'react-icons/gi';

import styled from 'styled-components';
import { useI18n } from '../i18n/I18nContext';
import {
  EDUCATION_PLATFORM_ICON_URL,
  PLATFORM_LOGO_FALLBACK_URLS,
  resolvePlatformLogoUrl,
} from '../utils/educationPlatformIcons';
import { getUserStorageKey } from '../utils/userStorage';
import paymentApi from '../utils/paymentApi';
import { canStartTask } from '../utils/freePlanMinutes';

const ThreadDiv = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #1a1a1a;
`;

const ChatContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-top: 12px;
  padding-bottom: 12px;
`;

const SendingContainer = styled.div`
  border: thin solid rgba(255,255,255,0.3);
  padding: 10px;
  border-radius: 20px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  padding: 20px;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--secondary-color);
`;


const ModeToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  background-color: ${({ $active }) =>
    $active ? 'var(--accent-blue)' : 'transparent'};
  color: ${({ disabled }) => (disabled ? 'rgba(255,255,255,0.3)' : '#fff')};
  border: thin solid ${({ $active }) => ($active ? 'var(--accent-blue)' : 'rgba(255,255,255,0.3)')};
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  transition: background-color 0.2s ease;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};

  &:hover {
    background-color: ${({ disabled, $active }) => (disabled ? 'transparent' : ($active ? 'var(--accent-blue-hover)' : 'rgba(255,255,255,0.1)'))};
  }
`;

const SendCircle = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--accent-blue);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--accent-blue-hover);
  }

  &:disabled {
    opacity: 0.32;
    cursor: not-allowed;
  }
`;

const PopupContainer = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
`;

const PopupHeader = styled.div`
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const PopupItem = styled.button`
  width: 100%;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const PopupItemIcon = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.2);
  border-radius: 8px;
  color: #60a5fa;
`;

const PlatformLogo = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const PopupItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const PopupItemTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #fff;
`;

const PopupItemDescription = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PopupFooter = styled.div`
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const PopupFooterButton = styled.button`
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--accent-blue);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s ease;

  &:hover {
    background: var(--accent-blue-hover);
  }
`;

export default function Thread() {
  const { t } = useI18n();
  const user = useSelector((state) => state.user);

  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setSendingMessage] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState('automation');
  const [automations, setAutomations] = useState([]);
  const [platforms, setPlatforms] = useState([]);

  const [isThreadDialogOpen, setThreadDialogOpen] = useState(false);
  const [isDeleteThreadDialogOpen, setDeleteThreadDialogOpen] = useState(false);

  const accessToken = useSelector(state => state.accessToken);

  const { tid } = useParams();

  const bottomRef = useRef(null);

  const navigate = useNavigate();

  const dispatch = useDispatch();

  const getThread = useCallback((showLoading = true) => {
    if (showLoading) dispatch(setLoadingDialog(true));
    axios.get(`/threads/${tid}`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(response => {
      setThread(response.data);
      if (showLoading) dispatch(setLoadingDialog(false));
    }).catch(error => {
      if (showLoading) dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  }, [tid, accessToken, dispatch]);

  const getThreadMessages = useCallback((showLoading = true) => {
    if (showLoading) dispatch(setLoadingDialog(true));
    axios.get(`/threads/${tid}/thread_messages`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(response => {
      setMessages(response.data);
      if (showLoading) dispatch(setLoadingDialog(false));
    }).catch(error => {
      if (showLoading) dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      }
    });
  }, [tid, accessToken, dispatch]);

  const sendMessage = async () => {
    if (messageText.length === 0 || isSendingMessage || !thread || thread.status === 'working') {
      return;
    }

    // Vérifier le plan depuis Supabase (source de vérité pour les plans payants)
    if (accessToken) {
      try {
        const userPlanData = await paymentApi.getUserPlan(accessToken);
        const planId = userPlanData.plan_id || 'free';
        
        // Si le plan vient d'expirer, afficher un message (mais ne pas bloquer)
        if (userPlanData.plan_just_expired) {
          dispatch(setError(true, t('profile.planExpired') || 'Your paid plan has expired. You have been moved to the free plan with 10 min/day.'));
          setTimeout(() => dispatch(setError(false, '')), 8000);
        }
        
        // Pour le free plan, vérifier le quota avec electron-store
        if (planId === 'free') {
          if (!(await canStartTask())) {
            dispatch(setUpgradePrompt(true));
            return;
          }
        }
      } catch (error) {
        console.error('Error checking user plan:', error);
        // En cas d'erreur, on autorise l'action
      }
    }

    const userMessage = {
      id: 'temp-' + Date.now(),
      thread_chat_from: 'from_user',
      thread_chat_type: 'normal_message',
      text: messageText.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const data = {text: messageText.trim(), background_mode: backgroundMode, extended_thinking_mode: thinkingMode};
    setMessageText('');
    setSendingMessage(true);
    dispatch(setLoadingDialog(true));
    axios.post(`/threads/${tid}/send_message`, data, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then(async (response) => {
      console.log('[Thread] send_message response:', JSON.stringify(response.data));
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
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
          tid,
          backgroundMode || response.data.is_background_mode_requested
        );
      }
      getThread();
      getThreadMessages();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      setSendingMessage(false);
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      if (error.response?.status === constants.status.BAD_REQUEST) {
        if (error.response.data?.message === 'Not_Browser_Task_BG_Mode') {
          dispatch(setError(true, 'Background Mode only supports browser tasks.'));
        } else if (error.response.data?.message === 'No_More_Daily_Minutes') {
          dispatch(setUpgradePrompt(true));
        } else {
          dispatch(setError(true, 'Something Wrong Happened, Please try again.'));
        }
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  };

  const deleteThread = () => {
    dispatch(setLoadingDialog(true));
    axios.delete('/threads/' + tid, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setLoadingDialog(false));
      navigate('/');
      window.location.reload();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        window.location.reload();
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
        setTimeout(() => {
          dispatch(setError(false, ''));
        }, 3000);
      }
    });
  }

  const cancelRunningTask = () => {
    if (!thread || thread.status !== 'working') {
      return;
    }

    dispatch(setLoadingDialog(true));
    axios.post(`/threads/${tid}/cancel_task`, {}, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setLoadingDialog(false));
      window.electronAPI.stopAIAgent();
      // TODO Remove
      getThreadMessages();
      getThread();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.BAD_REQUEST) {
        dispatch(setError(true, constants.GENERAL_ERROR));
      } else {
        dispatch(setError(true, constants.GENERAL_ERROR));
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  };

  const handleTextEnterKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onBGModeToggleChange = () => {
    // Background mode is disabled - message shown on hover
  };

  const onThinkingModeToggleChange = (value) => {
    setThinkingMode(value);
    window.electronAPI.setLastThinkingModeValue(value.toString());
  };

  useEffect(() => {
    getThread();
    getThreadMessages();
  }, [getThread, getThreadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentLaunch) {
      window.electronAPI.onAIAgentLaunch(() => {
        window.location.reload();
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentExit) {
      const handleAgentExit = () => {
        getThread();
        getThreadMessages();
      };
      
      window.electronAPI.onAIAgentExit(handleAgentExit);
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

  useEffect(() => {
    if (!user?.id) return;
    const STORAGE_KEY = getUserStorageKey('neuralagent.automations.v1', user);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setAutomations(JSON.parse(saved) || []);
      } catch (e) {
        console.error('Failed to load automations:', e);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const PLATFORMS_STORAGE_KEY = getUserStorageKey('neuralagent.platforms.v1', user);
    const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
    if (saved) {
      try {
        setPlatforms(JSON.parse(saved) || []);
      } catch (e) {
        console.error('Failed to load platforms:', e);
      }
    }
  }, [user?.id]);

  // Polling for real-time updates when thread is working
  useEffect(() => {
    if (!thread || thread.status !== 'working') return;

    const interval = setInterval(() => {
      getThread(false);
      getThreadMessages(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [thread?.status, getThread, getThreadMessages]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageText(value);

    const lastAtIndex = value.lastIndexOf('@');
    const lastSlashIndex = value.lastIndexOf('/');

    if (lastAtIndex > lastSlashIndex && lastAtIndex === value.length - 1) {
      setPopupType('platform');
      setShowPopup(true);
    } else if (lastSlashIndex > lastAtIndex && lastSlashIndex === value.length - 1) {
      setPopupType('automation');
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  };

  const handlePopupItemClick = (item) => {
    if (popupType === 'automation') {
      const fullDetails = `Automation: ${item.name}\nDescription: ${item.description || 'None'}\nPlatform: ${item.platform || 'None'}\nTask: ${item.taskDescription || 'None'}`;
      setMessageText(messageText.slice(0, -1) + ` ${fullDetails} `);
    } else {
      const platformDetails = `Platform: ${item.name}\nLogin URL: ${item.login_url || item.loginUrl || 'None'}\nUsername: ${item.username || 'None'}\nPassword: ${item.password || 'None'}`;
      setMessageText(messageText.slice(0, -1) + ` ${platformDetails} `);
    }
    setShowPopup(false);
  };

  return thread !== null ? (
    <>
      <ThreadDialog
        isOpen={isThreadDialogOpen}
        setOpen={setThreadDialogOpen}
        threadObj={Object.assign({}, thread)}
        onSuccess={() => window.location.reload()}
      />
      <YesNoDialog
        isOpen={isDeleteThreadDialogOpen}
        setOpen={setDeleteThreadDialogOpen}
        title='Delete Thread'
        text='Are you sure that you want to delete this thread?'
        onYesClicked={deleteThread}
        isDarkMode={true}
      />
      <ThreadDiv>
        <Header>
          <Text fontSize='20px' fontWeight='600' color={'#fff'}>
            {thread.title}
          </Text>
          <FlexSpacer />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <IconButton iconSize='27px' color='#fff' style={{ margin: '0 5px' }} dark
              onClick={() => setThreadDialogOpen(true)}>
              <MdEdit />
            </IconButton>
            <IconButton iconSize='27px' color='#fff' style={{ margin: '0 5px' }} dark
              onClick={() => setDeleteThreadDialogOpen(true)}>
              <MdDelete />
            </IconButton>
          </div>
        </Header>
        <ChatContainer>
          {messages.map((msg) => (
            <ChatMessage key={'thread_message__' + msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </ChatContainer>
        <div style={{ padding: '15px' }}>
          <SendingContainer>
            <div style={{ position: 'relative' }}>
              <NATextArea
                background='transparent'
                placeholder={t('home.placeholder')}
                value={messageText}
                isDarkMode
                rows='2'
                onKeyDown={handleTextEnterKey}
                onChange={handleInputChange}
              />
              {showPopup && (
                <PopupContainer>
                  <PopupHeader>
                    {popupType === 'automation' ? t('home.automations') : t('home.platforms')}
                  </PopupHeader>
                  {popupType === 'automation' ? (
                    <>
                      {automations.map((automation) => (
                        <PopupItem key={automation.id || automation.name} onClick={() => handlePopupItemClick(automation)}>
                          <PopupItemIcon>
                            <MdApps />
                          </PopupItemIcon>
                          <PopupItemContent>
                            <PopupItemTitle>{automation.name}</PopupItemTitle>
                            <PopupItemDescription>{automation.description}</PopupItemDescription>
                          </PopupItemContent>
                        </PopupItem>
                      ))}
                      <PopupFooter>
                        <PopupFooterButton type="button" onClick={() => navigate('/automations-page')}>
                          <MdAdd size={16} />
                          {t('home.createAutomation')}
                        </PopupFooterButton>
                      </PopupFooter>
                    </>
                  ) : (
                    <>
                      {platforms.map((platform) => {
                        const logoUrl = resolvePlatformLogoUrl(platform.id, platform.logo);
                        return (
                          <PopupItem key={platform.id || platform.name} onClick={() => handlePopupItemClick(platform)}>
                            <PlatformLogo>
                              <img src={logoUrl} alt={platform.name} />
                            </PlatformLogo>
                            <PopupItemContent>
                              <PopupItemTitle>{platform.name}</PopupItemTitle>
                              <PopupItemDescription>{platform.login_url || platform.loginUrl}</PopupItemDescription>
                            </PopupItemContent>
                          </PopupItem>
                        );
                      })}
                      <PopupFooter>
                        <PopupFooterButton type="button" onClick={() => navigate('/automations')}>
                          <MdAdd size={16} />
                          {t('home.addPlatform')}
                        </PopupFooterButton>
                      </PopupFooter>
                    </>
                  )}
                </PopupContainer>
              )}
            </div>
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center' }}>
              <ToggleContainer>
                <ModeToggle
                  type="button"
                  $active={backgroundMode}
                  onClick={() => onBGModeToggleChange(!backgroundMode)}
                  disabled
                >
                  <MdOutlineSchedule style={{fontSize: '19px'}} />
                  {t('home.background')}
                </ModeToggle>
              </ToggleContainer>
              <div style={{width: '10px'}} />
              <ToggleContainer>
                <ModeToggle
                  type="button"
                  $active={thinkingMode}
                  onClick={() => onThinkingModeToggleChange(!thinkingMode)}
                >
                  <GiBrain style={{fontSize: '19px'}} />
                  {t('home.thinking')}
                </ModeToggle>
              </ToggleContainer>
              <FlexSpacer />
              {isSendingMessage ? (
                <ClipLoader color={'#fff'} size={40} />
              ) : (
                thread.status === 'working' ? (
                  <IconButton
                    iconSize='35px'
                    color={'#fff'}
                    onClick={() => cancelRunningTask()}>
                    <FaStopCircle />
                  </IconButton>
                ) : (
                  <SendCircle
                    type="button"
                    disabled={messageText.length === 0}
                    onClick={() => sendMessage()}
                    aria-label={t('home.sendAria')}
                  >
                    <MdArrowUpward size={22} />
                  </SendCircle>
                )
              )}
            </div>
          </SendingContainer>
        </div>
      </ThreadDiv>
    </>
  ) : <></>;
}
