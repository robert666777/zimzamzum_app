import React from 'react';
import styled from 'styled-components';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

const Page = styled.div`
  flex: 1;
  min-height: 100%;
  padding: 28px 24px;
  background: #11131b;
  color: #fff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
`;

const Header = styled.div`
  max-width: 880px;
`;

const Title = styled.h1`
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
`;

const Description = styled.p`
  margin: 0 0 24px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.7;
  max-width: 860px;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.08);
  text-decoration: none;
  font-weight: 600;
  margin-top: 14px;

  &:hover {
    background: rgba(96, 165, 250, 0.16);
  }
`;

const ContentSection = styled.div`
  max-width: 880px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 24px;
`;

const SectionHeading = styled.h2`
  font-size: 20px;
  margin: 0 0 16px;
  color: #fff;
`;

const SectionText = styled.p`
  margin: 0 0 14px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.75;
`;

const helpTopics = (t) => ({
  schedule: {
    title: t('help.scheduleTitle'),
    description: t('help.scheduleDescription'),
    intro: t('help.scheduleIntro') || 'A scheduled workflow lets zimzamzum run automations automatically. Select an automation, define when it should run, and save your schedule.',
    tips: t('help.scheduleTips') || 'Tip: Use Daily, Weekly, or Hourly schedules for repeated work, then return here to edit or pause the workflow anytime.',
  },
  automations: {
    title: t('help.automationsTitle'),
    description: t('help.automationsDescription'),
    intro: t('help.automationsIntro') || 'Create automations to complete routine academic tasks. Each automation includes the platform, login credentials, and task instructions zimzamzum should follow.',
    tips: t('help.automationsTips') || 'Tip: Start with a simple automation and add more detail as you go. You can run it manually or schedule it later.',
  },
  credentials: {
    title: t('help.credentialsTitle'),
    description: t('help.credentialsDescription'),
    intro: t('help.credentialsIntro') || 'Save credentials for your platforms to allow zimzamzum to log in automatically when running automations.',
    tips: t('help.credentialsTips') || 'Tip: Use a unique name for each platform and verify the login details before saving.',
  },
});

function HelpPage() {
  const { topic } = useParams();
  const { t } = useI18n();
  const topics = helpTopics(t);
  const content = topics[topic] || {
    title: t('help.defaultTitle') || 'Help',
    description: t('help.defaultDescription') || 'Select a topic to learn how to use this page.',
    intro: t('help.defaultIntro') || 'Choose one of the help topics from the app menu.',
    tips: '',
  };

  return (
    <Page>
      <Header>
        <Title>{content.title}</Title>
        <Description>{content.description}</Description>
        <BackLink to="/">← {t('help.back')}</BackLink>
      </Header>

      <ContentSection>
        <SectionHeading>{content.title}</SectionHeading>
        <SectionText>{content.intro}</SectionText>
        {content.tips ? <SectionText>{content.tips}</SectionText> : null}
      </ContentSection>
    </Page>
  );
}

export default HelpPage;
