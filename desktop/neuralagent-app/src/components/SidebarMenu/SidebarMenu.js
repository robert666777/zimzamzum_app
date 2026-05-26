import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  MdSchedule,
  MdShare,
  MdSmartToy,
  MdLogout,
  MdCreditCard,
  MdEmail,
  MdPersonOutline,
  MdLanguage,
  MdKey,
  MdHourglassEmpty,
  MdReplay,
  MdHeadphones,
} from 'react-icons/md';
import { HiSparkles } from 'react-icons/hi2';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setAccessToken, setUser } from '../../store';
import { useI18n } from '../../i18n/I18nContext';

export const NewTaskButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 18px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  color: #fff;
  background: var(--accent-blue);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.18s ease, transform 0.12s ease;

  &:hover {
    background: var(--accent-blue-hover);
  }

  &:active {
    transform: scale(0.99);
  }
`;

export const PlusInCircle = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  flex-shrink: 0;
`;

const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
  padding: 12px 10px 8px;
  margin-top: 4px;
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 2px;
  box-sizing: border-box;
  border: none;
  border-radius: 8px;
  background: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.08)' : 'transparent')};
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
  }

  svg {
    font-size: 20px;
    flex-shrink: 0;
    opacity: 0.95;
  }
`;

const RecentTasksSection = styled.div`
  margin-top: 6px;
`;

const RecentTasksList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }
`;

const TaskItem = styled.button`
  display: block;
  width: 100%;
  padding: 8px 12px;
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
  padding: 8px 12px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.4;
`;

const ProfileShell = styled.div`
  flex-shrink: 0;
  padding-top: 10px;
  margin-top: auto;
  position: relative;
`;

const ProfileCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 12px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.09);
  }
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
`;

const ProfileTextCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ProfileName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlanBadge = styled.span`
  align-self: flex-start;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
`;

const ProfilePopover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #2b2b2b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 0 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  z-index: 200;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transform: translateY(${(p) => (p.$open ? '0' : '6px')});
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
`;

const PopoverDivider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0 6px;
`;

const PopoverRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};

  ${(p) =>
    p.$clickable &&
    `
    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  `}

  svg {
    font-size: 18px;
    flex-shrink: 0;
    opacity: 0.9;
  }
`;

const PopoverRowText = styled.div`
  flex: 1;
  min-width: 0;
`;

const PopoverLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 2px;
`;

const PopoverValue = styled.div`
  font-size: 13px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressBar = styled.div`
  height: 100%;
  background: var(--accent-blue);
  border-radius: 2px;
  transition: width 0.3s ease;
`;

const LangPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
`;

const LangPill = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.14)' : 'transparent')};
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

async function getPlanLabel(user, t) {
  let plan = user?.plan ?? user?.subscription_tier ?? user?.tier;
  
  if (window.electronAPI) {
    const storedPlan = await window.electronAPI.getUserPlan();
    if (storedPlan.plan && storedPlan.plan !== 'free') {
      plan = storedPlan.plan;
    }
  }
  
  if (typeof plan === 'string') {
    const planLower = plan.toLowerCase();
    if (planLower === 'pro') return t('profile.planPro');
    if (planLower === 'starter') return 'Starter';
    if (planLower === 'semester') return 'Semester';
    if (planLower === 'annual') return 'Annual';
  }
  return t('profile.planFree');
}

export function SidebarNavSections() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const threads = useSelector((state) => state.threads || []);

  const recentTasks = threads.slice(0, 20).map((thread) => ({
    id: thread.id,
    title: thread.title || 'Untitled task',
  }));

  return (
    <>
      <SectionLabel>{t('sidebar.features')}</SectionLabel>
      <MenuItem
        type="button"
        $active={location.pathname === '/schedule'}
        onClick={() => navigate('/schedule')}
      >
        <MdSchedule />
        {t('sidebar.schedule')}
      </MenuItem>
      <MenuItem
        type="button"
        $active={location.pathname === '/automations-page'}
        onClick={() => navigate('/automations-page')}
      >
        <MdSmartToy />
        {t('sidebar.automations')}
      </MenuItem>
      <MenuItem
        type="button"
        $active={location.pathname === '/automations'}
        onClick={() => navigate('/automations')}
      >
        <MdKey />
        {t('sidebar.credentials')}
      </MenuItem>
      <MenuItem
        type="button"
        $active={location.pathname === '/referrals'}
        onClick={() => navigate('/referrals')}
      >
        <MdShare />
        {t('sidebar.referrals')}
      </MenuItem>
      <MenuItem
        type="button"
        $active={location.pathname === '/upgrade'}
        onClick={() => navigate('/upgrade')}
      >
        <HiSparkles />
        {t('sidebar.upgrade')}
      </MenuItem>
      <SectionLabel>{t('sidebar.recentTasks')}</SectionLabel>
      <RecentTasksSection>
        {recentTasks.length === 0 ? (
          <EmptyTasks>{t('sidebar.noRecentTasks')}</EmptyTasks>
        ) : (
          <RecentTasksList>
            {recentTasks.map((task) => (
              <TaskItem
                type="button"
                key={task.id}
                title={task.title}
                onClick={() => navigate(`/threads/${task.id}`)}
              >
                {task.title}
              </TaskItem>
            ))}
          </RecentTasksList>
        )}
      </RecentTasksSection>
    </>
  );
}

export function SidebarUserProfile() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, expired: false });
  const [totalDurationMs, setTotalDurationMs] = useState(24 * 60 * 60 * 1000); // 1 jour par défaut
  const shellRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    const fetchPlan = async () => {
      let userPlan = null;
      let storedPlanData = null;
      let cd = null;
      
      if (window.electronAPI && user?.id) {
        storedPlanData = await window.electronAPI.getUserPlan(user.id);
        cd = await window.electronAPI.getPlanCountdown(user.id);
        // Prioriser le plan stocké dans Electron
        if (storedPlanData && storedPlanData.plan) {
          userPlan = storedPlanData.plan;
        }
      }
      
      // Fallback sur les données de l'utilisateur si pas de plan stocké
      if (!userPlan) {
        userPlan = user?.plan ?? user?.subscription_tier ?? user?.tier ?? 'free';
      }
      
      let calculatedTotalMs = 24 * 60 * 60 * 1000; // 1 jour par défaut
      if (typeof userPlan === 'string') {
        const planLower = userPlan.toLowerCase();
        if (planLower === 'pro') {
          setPlan(t('profile.planPro'));
          calculatedTotalMs = 30 * 24 * 60 * 60 * 1000; // 30 jours
        } else if (planLower === 'starter') {
          setPlan('Starter');
          calculatedTotalMs = 30 * 24 * 60 * 60 * 1000; // 30 jours
        } else if (planLower === 'semester') {
          setPlan('Semester');
          calculatedTotalMs = 180 * 24 * 60 * 60 * 1000; // 180 jours
        } else if (planLower === 'annual') {
          setPlan('Annual');
          calculatedTotalMs = 365 * 24 * 60 * 60 * 1000; // 365 jours
        } else {
          setPlan(t('profile.planFree'));
          calculatedTotalMs = 24 * 60 * 60 * 1000; // 1 jour
        }
      } else {
        setPlan(t('profile.planFree'));
        calculatedTotalMs = 24 * 60 * 60 * 1000; // 1 jour
      }
      setTotalDurationMs(calculatedTotalMs);
      
      if (cd) {
        setCountdown(cd);
      }
    };
    
    fetchPlan();
    const interval = setInterval(fetchPlan, 60000); // Rafraîchir toutes les minutes
    return () => clearInterval(interval);
  }, [user, t]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (shellRef.current && !shellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleLogout = async () => {
    try {
      window.electronAPI?.deleteToken();
      window.electronAPI?.deleteRefreshToken();
      dispatch(setAccessToken(null));
      dispatch(setUser(null));
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProgressWidth = (countdownData, totalMs) => {
    if (countdownData.expired) {
      return '100%';
    }
    const remainingMs = countdownData.days * 24 * 60 * 60 * 1000 + 
                        countdownData.hours * 60 * 60 * 1000 + 
                        countdownData.minutes * 60 * 1000;
    const progress = ((totalMs - remainingMs) / totalMs) * 100;
    return `${Math.max(0, Math.min(100, progress))}%`;
  };

  return (
    <ProfileShell ref={shellRef}>
      <ProfilePopover $open={open}>
        <PopoverRow>
          <MdHourglassEmpty />
          <PopoverRowText>
              <PopoverLabel>
                {!plan ? t('profile.daysRemaining') : 
                  plan === t('profile.planFree') ? t('profile.freeTrialEndsIn') : 
                  t(`profile.${plan.toLowerCase()}PlanEndsIn`)}
              </PopoverLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <PopoverValue>
                  {countdown.expired ? t('profile.expired') : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`}
                </PopoverValue>
                <ProgressBarContainer>
                  <ProgressBar 
                    style={{ 
                      width: getProgressWidth(countdown, totalDurationMs)
                    }} 
                  />
                </ProgressBarContainer>
              </div>
            </PopoverRowText>
        </PopoverRow>
        <PopoverRow>
          <MdPersonOutline />
          <PopoverRowText>
            <PopoverLabel>{t('profile.name')}</PopoverLabel>
            <PopoverValue>{user?.name || '—'}</PopoverValue>
          </PopoverRowText>
        </PopoverRow>
        <PopoverRow>
          <MdEmail />
          <PopoverRowText>
            <PopoverLabel>{t('profile.phone')}</PopoverLabel>
            <PopoverValue>{user?.phone_number || '—'}</PopoverValue>
          </PopoverRowText>
        </PopoverRow>
        <PopoverRow
          $clickable
          onClick={() => {
            setOpen(false);
            navigate('/upgrade');
          }}>
          <MdCreditCard />
          <PopoverRowText>
            <PopoverLabel>{t('profile.billing')}</PopoverLabel>
            <PopoverValue>{t('profile.billingHint')}</PopoverValue>
          </PopoverRowText>
        </PopoverRow>
        <PopoverRow>
          <MdLanguage />
          <PopoverRowText>
            <PopoverLabel>{t('profile.language')}</PopoverLabel>
            <LangPills>
              <LangPill
                type="button"
                $active={locale === 'en'}
                onClick={() => setLocale('en')}
              >
                {t('profile.langEn')}
              </LangPill>
              <LangPill
                type="button"
                $active={locale === 'zh'}
                onClick={() => setLocale('zh')}
              >
                {t('profile.langZh')}
              </LangPill>
            </LangPills>
          </PopoverRowText>
        </PopoverRow>
        <PopoverRow>
          <MdHeadphones />
          <PopoverRowText>
            <PopoverLabel>{t('profile.support')}</PopoverLabel>
            <PopoverValue>WeChat: zimzamzum</PopoverValue>
          </PopoverRowText>
        </PopoverRow>
        <PopoverRow
          $clickable
          onClick={() => {
            setOpen(false);
            handleLogout();
          }}
        >
          <MdLogout />
          <PopoverRowText>
            <PopoverValue>{t('profile.logout')}</PopoverValue>
          </PopoverRowText>
        </PopoverRow>
      </ProfilePopover>

      <ProfileCard type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar>{getInitials(user?.name)}</Avatar>
        <ProfileTextCol>
          <ProfileName>{user?.name || t('profile.userFallback')}</ProfileName>
          <PlanBadge>{plan}</PlanBadge>
        </ProfileTextCol>
      </ProfileCard>
    </ProfileShell>
  );
}
