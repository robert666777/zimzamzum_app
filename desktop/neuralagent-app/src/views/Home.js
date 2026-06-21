import React, { useState, useEffect } from 'react';
import { FlexSpacer } from '../components/Elements/SmallElements';
import { useDispatch, useSelector } from 'react-redux';
import axios from '../utils/axios';
import { setLoadingDialog, setError, setUpgradePrompt } from '../store';
import constants from '../utils/constants';
import { Text } from '../components/Elements/Typography';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdOutlineSchedule, MdArrowUpward, MdAdd, MdApps } from 'react-icons/md';
import { GiBrain } from 'react-icons/gi';

import styled from 'styled-components';
import { useI18n } from '../i18n/I18nContext';
import { resolvePlatformLogoUrl } from '../utils/educationPlatformIcons';
import { getUserStorageKey, PRODUCT_TOUR_SESSION_KEY } from '../utils/userStorage';
import ProductTour from '../components/ProductTour';
import paymentApi from '../utils/paymentApi';

const PAGE_BG = '#1a1a1a';
const CARD_BG = '#2b2b2b';

const HomeDiv = styled.div`
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px 20px 32px;
  background: ${PAGE_BG};
`;

const PageTitle = styled(Text)`
  font-size: clamp(22px, 2.5vw, 26px);
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 18px;
  text-align: center;
`;

const SuggestionsRow = styled.div`
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
  justify-content: center;
`;

const SuggestionTag = styled.button`
  padding: 7px 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
  }
`;

const TaskCard = styled.div`
  width: 100%;
  max-width: 640px;
  background: ${CARD_BG};
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 22px 24px 18px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
`;

const PromptInput = styled.textarea`
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 15px;
  font-family: inherit;
  font-weight: 400;
  resize: none;
  outline: none;
  line-height: 1.55;
  padding: 4px 2px 8px;

  &::placeholder {
    color: rgba(255, 255, 255, 0.38);
  }
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 4px;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.65);
`;

const ModeToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: ${({ $active }) =>
    $active ? 'var(--accent-blue)' : 'transparent'};
  color: ${({ disabled }) => (disabled ? 'rgba(255, 255, 255, 0.4)' : '#fff')};
  border: 1px solid ${({ $active, disabled }) =>
    disabled ? 'rgba(255, 255, 255, 0.1)' : ($active ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.14)')};
  border-radius: 999px;
  padding: 7px 13px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};

  &:hover {
    background-color: ${({ $active, disabled }) =>
      disabled ? 'transparent' : ($active ? 'var(--accent-blue-hover)' : 'rgba(255, 255, 255, 0.08)')};
    border-color: ${({ $active, disabled }) =>
      disabled ? 'rgba(255, 255, 255, 0.1)' : ($active ? 'var(--accent-blue-hover)' : 'rgba(255, 255, 255, 0.22)')};
  }
`;

const SubmitCircle = styled.button`
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
  transition: background 0.15s ease, transform 0.12s ease;

  &:hover:not(:disabled) {
    background: var(--accent-blue-hover);
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.32;
    cursor: not-allowed;
  }
`;

const PopupContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: ${CARD_BG};
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-height: 360px;
  overflow-y: auto;
  z-index: 100;
`;

const PopupHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PopupItem = styled.button`
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const PopupItemIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    font-size: 18px;
    color: var(--accent-blue);
  }
`;

const PopupItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const PopupItemTitle = styled.div`
  font-size: 14px;
  color: #fff;
  font-weight: 500;
`;

const PopupItemDescription = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PopupFooter = styled.div`
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
`;

const PopupFooterButton = styled.button`
  width: 100%;
  padding: 10px 16px;
  background: var(--accent-blue);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
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

const PlatformLogo = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    font-size: 18px;
    color: #fff;
  }
`;

export default function Home() {
  const { t } = useI18n();
  const [messageText, setMessageText] = useState('');
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState(''); // 'automation' or 'platform'
  const [automations, setAutomations] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [showProductTour, setShowProductTour] = useState(false);

  const taskSuggestions = [
    t('home.suggestion1'),
    t('home.suggestion2'),
    t('home.suggestion3'),
    t('home.suggestion4'),
  ];

  const accessToken = useSelector((state) => state.accessToken) || window.localStorage.getItem('access_token');
  const user = useSelector((state) => state.user);

  const defaultPlatforms = [
    { id: 'chaoxing', name: 'Chaoxing / 学习通', login_url: 'https://passport2.chaoxing.com/login' },
    { id: 'zhihuishu', name: 'Zhihuishu / 智慧树', login_url: 'https://passport.zhihuishu.com/login' },
    { id: 'yuketang', name: 'Yuketang / 雨课堂', login_url: 'https://www.yuketang.cn/web' },
    { id: 'icourse', name: 'iCourse / 中国大学MOOC', login_url: 'https://www.icourse163.org/' },
    { id: 'xuetangx', name: 'XuetangX / 学堂在线', login_url: 'https://www.xuetangx.com/' },
  ];

  useEffect(() => {
    loadAutomations();
    loadPlatforms();
    
    // Product tour: only after a new account signup (not on login / account switch)
    if (user?.id && sessionStorage.getItem(PRODUCT_TOUR_SESSION_KEY) === '1') {
      const timer = setTimeout(() => {
        setShowProductTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  const handleTourComplete = () => {
    setShowProductTour(false);
    sessionStorage.removeItem(PRODUCT_TOUR_SESSION_KEY);
  };

  const loadAutomations = () => {
    if (!user?.id) return;
    const STORAGE_KEY = getUserStorageKey('neuralagent.automations.v1', user);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAutomations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load automations:', error);
    }
  };

  const loadPlatforms = async () => {
    if (!user?.id) return;
    const PLATFORMS_STORAGE_KEY = getUserStorageKey('neuralagent.platforms.v1', user);
    const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && data.length > 0) {
          // Check if Yuketang is missing and add it
          const hasYuketang = data.some(p => p.id === 'yuketang');
          if (!hasYuketang) {
            const yuketang = { id: 'yuketang', name: 'Yuketang / 雨课堂', login_url: 'https://www.yuketang.cn/web' };
            // Insert at position 2 (after chaoxing and zhihuishu)
            const updated = [...data.slice(0, 2), yuketang, ...data.slice(2)];
            setPlatforms(updated);
            localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(updated));
          } else {
            setPlatforms(data);
          }
          return;
        }
      } catch (error) {
        console.error('Failed to load platforms from localStorage:', error);
      }
    }

    if (!accessToken) {
      setPlatforms(defaultPlatforms);
      return;
    }

    try {
      const response = await axios.get('/automations/platforms', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      });
      if (response.data && response.data.length > 0) {
        setPlatforms(response.data);
        localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(response.data));
      } else {
        setPlatforms(defaultPlatforms);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to load platforms:', error);
      }
      setPlatforms(defaultPlatforms);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageText(value);

    const lastChar = value.slice(-1);
    const secondLastChar = value.slice(-2, -1);

    if (lastChar === '/' && secondLastChar !== '/') {
      setPopupType('automation');
      setShowPopup(true);
    } else if (lastChar === '@' && secondLastChar !== '@') {
      setPopupType('platform');
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  };

  const handlePopupItemClick = (item) => {
    if (popupType === 'automation') {
      // Find the platform details from platforms
      const platform = platforms.find(p => p.id === item.platform) || {};
      const fullDetails = `Automation: ${item.name}\nDescription: ${item.description || 'None'}\nPlatform: ${platform.name || item.platform}\nPlatform Details:\nLogin URL: ${item.platformLoginUrl || platform.loginUrl || 'None'}\nUsername: ${item.platformUsername || platform.username || 'None'}\nPassword: ${item.platformPassword || platform.password || 'None'}\n\nTask:\n${item.taskDescription || 'None'}`;
      setMessageText(messageText.slice(0, -1) + ` ${fullDetails} `);
    } else {
      // For platforms, replace the Platform Details section of the current automation text
      const platformDetails = `Platform: ${item.name}\nPlatform Details:\nLogin URL: ${item.login_url || 'None'}\nUsername: ${item.username || 'None'}\nPassword: ${item.password || 'None'}`;
      
      // Check if there's already a Platform section in the current text
      if (messageText.includes('Platform:')) {
        // Replace the existing Platform section
        const updatedText = messageText.replace(
          /Platform:[^\n]*\n(Platform Details:[^\n]*\n)?(Login URL:[^\n]*\n)?(Username:[^\n]*\n)?(Password:[^\n]*\n)?/,
          platformDetails + '\n'
        );
        setMessageText(updatedText);
      } else {
        // Just append if no platform section exists
        setMessageText(messageText.slice(0, -1) + ` ${platformDetails} `);
      }
    }
    setShowPopup(false);
  };

  const dispatch = useDispatch();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.automationText) {
      setMessageText(location.state.automationText);
      window.history.replaceState({}, document.title, '/');
    }
    
    const scheduledContent = localStorage.getItem('scheduled-task-content');
    if (scheduledContent) {
      setMessageText(scheduledContent);
      localStorage.removeItem('scheduled-task-content');
      
      setTimeout(() => {
        createThreadDirect(scheduledContent);
      }, 500);
    }
  }, [location]);

  const cancelRunningTask = (tid) => {
    dispatch(setLoadingDialog(true));
    axios
      .post(
        `/threads/${tid}/cancel_task`,
        {},
        {
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
        }
      )
      .then((response) => {
        dispatch(setLoadingDialog(false));
        window.electronAPI.stopAIAgent();
      })
      .catch((error) => {
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

  const createThreadDirect = async (taskContent) => {
    if (!taskContent || taskContent.length === 0) {
      return;
    }
    
    if (!accessToken) {
      dispatch(setError(true, 'Please login first.'));
      setTimeout(() => dispatch(setError(false, '')), 3000);
      return;
    }
    
    const cleanedContent = taskContent.replace(/[^\x00-\x7F]/g, '').trim();
    
    const data = {
      task: cleanedContent,
      background_mode: false,
      extended_thinking_mode: false,
    };
    setMessageText('');
    dispatch(setLoadingDialog(true));
    axios
      .post('/threads', data, {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      })
      .then(async (response) => {
        dispatch(setLoadingDialog(false));
        if (response.data.type === 'desktop_task') {
          window.electronAPI.launchAIAgent(
            process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
            response.data.thread_id,
            false
          );
        }
        window.location.href = '/';
      })
      .catch((error) => {
        dispatch(setLoadingDialog(false));
        console.error('Failed to create thread:', error);
      });
  };

  const createThread = async () => {
    if (messageText.length === 0) {
      return;
    }
    
    console.log('[Home] createThread called with:', {
      messageText: messageText.substring(0, 50) + '...',
      backgroundMode,
      thinkingMode,
      accessTokenExists: !!accessToken,
      accessTokenLength: accessToken?.length || 0
    });
    
    if (!accessToken) {
      dispatch(setError(true, 'Please login first.'));
      setTimeout(() => dispatch(setError(false, '')), 3000);
      return;
    }
    
    // Vérifier le plan depuis Supabase (source de vérité)
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
        try {
          const canStart = await window.electronAPI.canStartTask();
          if (!canStart) {
            dispatch(setUpgradePrompt(true));
            return;
          }
        } catch (error) {
          console.error('Error checking free plan status:', error);
        }
      }
    } catch (error) {
      console.error('Error checking user plan:', error);
      // En cas d'erreur, on autorise l'action (ne pas bloquer l'utilisateur)
    }
    
    const data = {
      task: messageText,
      background_mode: backgroundMode,
      extended_thinking_mode: thinkingMode,
    };
    console.log('[Home] Sending data to API:', JSON.stringify(data));
    
    setMessageText('');
    dispatch(setLoadingDialog(true));
    axios
      .post('/threads', data, {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      })
      .then(async (response) => {
        dispatch(setLoadingDialog(false));
        if (response.data.type === 'desktop_task') {
          if (!backgroundMode && response.data.is_background_mode_requested) {
            const ready = await window.electronAPI.isBackgroundModeReady();
            if (!ready) {
              cancelRunningTask(response.data.thread_id);
              return;
            }
          }
          setBackgroundMode(backgroundMode || response.data.is_background_mode_requested);
          setThinkingMode(thinkingMode || response.data.is_extended_thinking_mode_requested);
          window.electronAPI.setLastThinkingModeValue(
            (thinkingMode || response.data.is_extended_thinking_mode_requested).toString()
          );
          window.electronAPI.launchAIAgent(
            process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
            response.data.thread_id,
            backgroundMode || response.data.is_background_mode_requested
          );
        }
        navigate('/threads/' + response.data.thread_id);
        window.location.reload();
      })
      .catch((error) => {
        dispatch(setLoadingDialog(false));
        console.error('[Home] API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        if (error.response?.status === constants.status.BAD_REQUEST) {
          const errorMsg = error.response.data?.message || constants.GENERAL_ERROR;
          dispatch(setError(true, errorMsg));
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
      createThread();
    }
  };

  const onBGModeToggleChange = () => {
    // Background mode is disabled - message shown on hover
  };

  useEffect(() => {
    if (window.electronAPI?.onAIAgentLaunch) {
      window.electronAPI.onAIAgentLaunch((threadId) => {
        navigate('/threads/' + threadId);
        window.location.reload();
      });
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onAIAgentExit) {
      window.electronAPI.onAIAgentExit(() => {
        window.location.reload();
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
    <HomeDiv>
      {showProductTour && <ProductTour onComplete={handleTourComplete} />}
      <PageTitle as="h1">{t('home.title')}</PageTitle>
      <TaskCard>
        <div style={{ position: 'relative' }}>
          <PromptInput
            placeholder={t('home.placeholder')}
            rows={5}
            value={messageText}
            onChange={handleInputChange}
            onKeyDown={handleTextEnterKey}
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
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={platform.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `<span style="font-size: 14px; font-weight: 600; color: #fff;">${platform.name.charAt(0).toUpperCase()}</span>`;
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                              {platform.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </PlatformLogo>
                        <PopupItemContent>
                          <PopupItemTitle>{platform.name}</PopupItemTitle>
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
        <ControlsRow>
          <ToggleContainer>
            <ModeToggle
              type="button"
              $active={false}
              onClick={() => onBGModeToggleChange()}
              disabled
              title="Coming soon! This feature will allow zimzamzum to run tasks in the background while you continue working on your computer."
            >
              <MdOutlineSchedule style={{ fontSize: '19px' }} />
              {t('home.background')}
            </ModeToggle>
          </ToggleContainer>
          <ToggleContainer>
            <ModeToggle
              type="button"
              $active={thinkingMode}
              onClick={() => setThinkingMode(!thinkingMode)}
              title="Extended Thinking Mode: Enables deeper analysis for complex tasks."
            >
              <GiBrain style={{ fontSize: '19px' }} />
              {t('home.thinking')}
            </ModeToggle>
          </ToggleContainer>
          <FlexSpacer isRTL={false} />
          <SubmitCircle
            type="button"
            disabled={messageText.length === 0}
            onClick={() => createThread()}
            aria-label={t('home.sendAria')}
          >
            <MdArrowUpward size={22} />
          </SubmitCircle>
        </ControlsRow>
      </TaskCard>
      <SuggestionsRow>
        {taskSuggestions.map((suggestion, index) => (
          <SuggestionTag
            key={index}
            type="button"
            onClick={() => setMessageText(suggestion)}
          >
            {suggestion}
          </SuggestionTag>
        ))}
      </SuggestionsRow>
    </HomeDiv>
  );
}
