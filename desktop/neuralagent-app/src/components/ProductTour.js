import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TourCard = styled.div`
  background: var(--card-bg, #2b2b2b);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const TourIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--accent-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  font-size: 28px;
`;

const TourTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
`;

const TourDescription = styled.p`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin: 0 0 28px 0;
  white-space: pre-line;
`;



const GotItButton = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid var(--accent-blue);
  background: var(--accent-blue);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent-blue-hover);
    border-color: var(--accent-blue-hover);
  }
`;

const UpgradeButton = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid #8b5cf6;
  background: #8b5cf6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
  margin-right: 12px;

  &:hover {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #fff;
  }
`;

const ProgressDots = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.2)'};
  transition: all 0.3s ease;
`;

const TOUR_STEPS = [
  {
    id: 'schedule',
    icon: '📅',
    title: 'Schedule',
    titleZh: '定时任务',
    description: {
      en: 'Schedule your tasks and automations to run automatically at specific dates and times.\n\nThis saves hours of manual work each week. It is perfect for repetitive academic tasks that need to happen on a regular basis, like checking homework or completing quizzes.\n\nFor example, every Monday at 8 AM, ZimZamZum can log into your student platform and check your assignments automatically.',
      zh: '安排您的任务和自动化流程在特定日期和时间自动运行。\n\n每周节省数小时的手动工作，非常适合需要定期进行的重复性学业任务，例如检查作业或完成测验。\n\n示例：每周一上午8点，ZimZamZum 可以自动登录您的学生平台并检查作业。'
    },
    route: '/schedule'
  },
  {
    id: 'automations',
    icon: '🤖',
    title: 'Automations',
    titleZh: '自动化',
    description: {
      en: 'Create powerful custom automation workflows that handle complex academic tasks from start to finish.\n\nSet up multi-step processes with triggers, actions, and conditions to fully automate your daily academic routines.\n\nFor example, configure a workflow that logs into Moodle, checks for new assignments, and completes them automatically using AI.',
      zh: '创建强大的自定义自动化工作流程，从头到尾处理复杂的学业任务。\n\n设置带有触发器、动作和条件的多步流程，完全自动化您的日常学业工作。\n\n示例：配置一个工作流程，登录 Moodle，检查新作业，并使用 AI 自动完成。'
    },
    route: '/automations-page'
  },
  {
    id: 'credentials',
    icon: '🔐',
    title: 'Credentials',
    titleZh: '凭据',
    description: {
      en: 'Securely store and manage all your educational platform login credentials in one centralized, encrypted location.\n\nZimZamZum uses strong encryption to keep your passwords safe while making them easily accessible for your automations.\n\nFor example, save your Moodle, Zhihuishu, and Yuketang logins once, and ZimZamZum will use them automatically when running tasks.',
      zh: '在一个集中的加密位置安全地存储和管理您所有的教育平台登录凭据。\n\nZimZamZum 使用强大的加密技术保护您的密码安全，同时让您的自动化任务可以轻松调用它们。\n\n示例：保存一次 Moodle、智慧树和雨课堂的登录信息，ZimZamZum 将在运行任务时自动使用。'
    },
    route: '/automations'
  },
  {
    id: 'referrals',
    icon: '🎁',
    title: 'Referrals',
    titleZh: '推荐',
    description: {
      en: 'Invite your friends to ZimZamZum and earn free access days.\n\nShare your unique referral code, and every time a friend creates an account using your referral, you get closer to earning free access days as a reward.\n\nFor example, share your referral code with 30 friends to unlock free access to all ZimZamZum features.',
      zh: '邀请您的朋友使用 ZimZamZum，即可获得免费访问天数。\n\n分享您的唯一推荐码，每次有朋友通过您的推荐注册账户，您都会获得免费访问天数奖励。\n\n示例：将您的推荐码分享给 30 位朋友，即可解锁 ZimZamZum 全部功能的免费访问权限。'
    },
    route: '/referrals'
  },
  {
    id: 'upgrade',
    icon: '⭐',
    title: 'Upgrade',
    titleZh: '升级',
    description: {
      en: 'Every new user starts with a Free Plan that includes 10 minutes of task runtime per day.\n\nThis means you can use all features for up to 10 minutes daily. Your usage resets to 0/10 at midnight every day. As you launch tasks, your minutes increase.\n\nTo remove this daily limit and enjoy unlimited task runtime, upgrade to one of our premium plans.',
      zh: '每位新用户都从免费计划开始，每天包含 10 分钟的任务运行时间。\n\n这意味着您每天最多可以使用所有功能 10 分钟。您的使用量每天午夜重置为 0/10。当您启动任务时，分钟数会逐渐增加。\n\n要移除此每日限制并享受无限任务运行时间，请升级到我们的高级计划之一。'
    },
    route: '/upgrade'
  }
];

export default function ProductTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { locale, t } = useI18n();

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isUpgradeStep = step.id === 'upgrade';

  const handleGotIt = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleUpgrade = () => {
    onComplete?.();
    navigate('/upgrade');
  };

  return (
    <Overlay>
      <TourCard>
        <ProgressDots>
          {TOUR_STEPS.map((_, index) => (
            <Dot key={index} $active={index === currentStep} />
          ))}
        </ProgressDots>

        <TourIcon>{step.icon}</TourIcon>

        <TourTitle>
          {locale === 'zh' ? step.titleZh : step.title}
        </TourTitle>

        <TourDescription>
          {locale === 'zh' ? step.description.zh : step.description.en}
        </TourDescription>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {isUpgradeStep && (
            <UpgradeButton type="button" onClick={handleUpgrade}>
              {locale === 'zh' ? '升级' : 'Upgrade'}
            </UpgradeButton>
          )}
          <GotItButton type="button" onClick={handleGotIt}>
            {isLastStep ? (locale === 'zh' ? '开始使用' : 'Got it!') : (locale === 'zh' ? '知道了' : 'Got it')}
          </GotItButton>
        </div>
      </TourCard>
    </Overlay>
  );
}
