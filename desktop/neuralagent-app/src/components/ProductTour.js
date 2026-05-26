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
`;

const GotItButton = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  background: var(--accent-blue);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent-blue-hover);
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
      en: '📅 Schedule your automations to run automatically at specific dates and times to save hours of manual work each week! Perfect for repetitive tasks that need to happen on a regular basis, like checking homework or completing quizzes. Example: Every Monday at 8 AM, ZimZamZum can log into your student platform and check your homework automatically.',
      zh: '📅 安排您的自动化任务在特定日期和时间自动运行，每周节省数小时的手动工作！非常适合需要定期进行的重复任务，比如检查作业或完成测验。示例：每周一上午8点，ZimZamZum 可以自动登录你的学生平台，检查你的作业。'
    },
    route: '/schedule'
  },
  {
    id: 'automations',
    icon: '🤖',
    title: 'Automations',
    titleZh: '自动化',
    description: {
      en: '🤖 Create powerful custom automation workflows that handle complex academic tasks from start to finish! Set up multi-step processes with triggers, actions, and conditions to fully automate your daily academic routines. Example: Set up a workflow that logs into Moodle → checks for new assignments → and fills them out automatically for you with AI.',
      zh: '🤖 创建强大的自定义自动化工作流程，从头到尾处理复杂的学业任务！设置带有触发器、动作和条件的多步流程，完全自动化你的日常学业工作。示例：设置一个工作流程，登录 Moodle → 检查新作业 → 并让 AI 自动帮你填写。'
    },
    route: '/automations-page'
  },
  {
    id: 'credentials',
    icon: '🔐',
    title: 'Credentials',
    titleZh: '凭据',
    description: {
      en: '🔐 Securely store and manage all your educational platform login credentials in one centralized, encrypted location! ZimZamZum uses strong encryption to keep your passwords safe while making them easily accessible for your automations. Example: Save your Moodle, Zhihuishu, and Yuketang logins once, and ZimZamZum will use them automatically when running tasks.',
      zh: '🔐 在一个集中的加密位置安全地存储和管理你所有的教育平台登录凭据！ZimZamZum 使用强大的加密技术保护你的密码安全，同时让它们可以轻松地用于你的自动化任务。示例：保存一次 Moodle、智慧树、雨课堂的登录信息，ZimZamZum 在运行任务时会自动使用它们。'
    },
    route: '/automations'
  },
  {
    id: 'referrals',
    icon: '🎁',
    title: 'Referrals',
    titleZh: '推荐',
    description: {
      en: '🎁 Invite your friends to ZimZamZum and earn free full-access days in return! Share your unique referral code or link, and every time a friend creates an account with your referral, you get rewarded with extra days of access. Example: Share your unique referral code with 7 friends → you get 1 day of full access! 14 friends → 2 days! The more you share, the more you earn!',
      zh: '🎁 邀请你的朋友来 ZimZamZum，并获得免费的完整访问天数作为回报！分享你的唯一推荐码或链接，每次有朋友通过你的推荐注册账户，你都会获得额外的访问天数奖励。示例：分享你的唯一推荐码给7个朋友 → 你获得1天完整访问权限！14个朋友 → 2天！分享越多，赚得越多！'
    },
    route: '/referrals'
  }
];

export default function ProductTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { locale, t } = useI18n();

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleGotIt = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      setCurrentStep(currentStep + 1);
    }
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
          <GotItButton type="button" onClick={handleGotIt}>
            {isLastStep ? (locale === 'zh' ? '开始使用' : 'Got it!') : (locale === 'zh' ? '知道了' : 'Got it')}
          </GotItButton>
        </div>
      </TourCard>
    </Overlay>
  );
}
