import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import { useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import axios from '../utils/axios';

const Page = styled.div`
  flex: 1;
  padding: 16px 18px 24px;
  background: #1a1a1a;
  color: #fff;
  overflow-y: auto;
`;

const Header = styled.div`
  margin-bottom: 20px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
  margin-top: 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
  max-width: 720px;
  margin: 0;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 16px 20px;
  flex: 1;
  min-width: 200px;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const ShareSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
`;

const ShareLabel = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 10px;
`;

const ShareCodeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const ShareCode = styled.div`
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 18px;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${({ $active }) => $active ? '#16a34a' : 'var(--accent-blue, #3b82f6)'};
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${({ $active }) => $active ? '#15803d' : '#2563eb'};
  }
`;

const InfoText = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
  margin-bottom: 20px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
`;

const ReferredList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ReferredItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px 16px;
`;

const ReferredName = styled.div`
  font-size: 14px;
  color: #fff;
  font-weight: 500;
`;

const ReferredDate = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
`;

export default function Referrals() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const accessToken = useSelector((state) => state.accessToken) || window.localStorage.getItem('access_token');

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const response = await axios.get('/referrals/summary', {
        headers: {
          Authorization: 'Bearer ' + accessToken
        }
      });
      setSummary(response.data);
    } catch (err) {
      console.warn('API error:', err.message);
      setSummary({
        referral_code: '',
        referral_count: 0,
        share_url: '',
        referred: [],
        new_reward_days: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Page>
        <Header>
          <Title>{t('referrals.title')}</Title>
          <Description>{t('referrals.description')}</Description>
        </Header>
        <EmptyState>Loading...</EmptyState>
      </Page>
    );
  }

  if (!summary) {
    return (
      <Page>
        <Header>
          <Title>{t('referrals.title')}</Title>
          <Description>{t('referrals.description')}</Description>
        </Header>
        <EmptyState>{t('referrals.youGetDays')}</EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      <Header>
        <Title>{t('referrals.title')}</Title>
        <Description>{t('referrals.description')}</Description>
      </Header>

      <StatsRow>
        <StatCard>
          <StatValue>{summary.referral_count}</StatValue>
          <StatLabel>{t('referrals.successfulReferrals')}</StatLabel>
        </StatCard>
      </StatsRow>

      <ShareSection>
        <ShareLabel>{t('referrals.shareCode')}</ShareLabel>
        <ShareCodeRow>
          <ShareCode>
            <MdContentCopy style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }} />
            {summary.referral_code}
          </ShareCode>
          <CopyButton $active={copied} onClick={() => copyToClipboard(summary.referral_code)}>
            {copied ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
            {copied ? 'Copied!' : t('referrals.copyCode')}
          </CopyButton>
        </ShareCodeRow>
      </ShareSection>

      <InfoText>
        {t('referrals.shareCodeInfo')}
      </InfoText>

      {summary.referred.length === 0 ? (
        <EmptyState>{t('referrals.youGetDays')}</EmptyState>
      ) : (
        <ReferredList>
          {summary.referred.map((r) => (
            <ReferredItem key={r.id}>
              <ReferredName>{r.name_masked}</ReferredName>
              <ReferredDate>{formatDate(r.joined_at)}</ReferredDate>
            </ReferredItem>
          ))}
        </ReferredList>
      )}
    </Page>
  );
}
