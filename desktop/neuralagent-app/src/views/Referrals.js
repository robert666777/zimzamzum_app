import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { MdContentCopy, MdPeople, MdSchedule, MdShare } from 'react-icons/md';
import { Text } from '../components/Elements/Typography';
import { Button } from '../components/Elements/Button';
import axios from '../utils/axios';
import { useSelector, useDispatch } from 'react-redux';
import { setSuccess } from '../store';
import constants from '../utils/constants';
import { useI18n } from '../i18n/I18nContext';

const Page = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 32px;
  overflow-y: auto;
  background: #1a1a1a;
  color: #fff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
`;

const Header = styled.div`
  margin-bottom: 20px;
  max-width: 720px;
`;

const Title = styled(Text)`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const Sub = styled(Text)`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.55;
`;

const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 20px;
`;

const StatCard = styled.div`
  flex: 1;
  min-width: 140px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 14px 16px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
`;

const CodeBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
`;

const CodeText = styled.code`
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #e9d5ff;
  font-family: ui-monospace, 'Consolas', monospace;
`;

const LinkText = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  word-break: break-all;
  line-height: 1.4;
`;

const CopyBtn = styled(Button)`
  padding: 8px 14px;
  font-size: 13px;
  border-radius: 8px;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: var(--accent-blue-hover);
    opacity: 1;
  }
`;

const Section = styled.div`
  margin-top: 22px;
`;

const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.92);
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
`;

const POLL_MS = 5000;

export default function Referrals() {
  const { t } = useI18n();
  const accessToken = useSelector((s) => s.accessToken);
  const userId = useSelector((s) => s.userId);
  const dispatch = useDispatch();
  const [summary, setSummary] = useState(null);

  const fetchSummary = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { data } = await axios.get('/referrals/summary', {
        headers: { Authorization: 'Bearer ' + accessToken },
      });
      setSummary(data);
      
      // Appliquer les nouveaux jours de récompense si disponibles
      if (data.new_reward_days && data.new_reward_days > 0) {
        try {
          await window.electronAPI.extendPlanByDays(userId, data.new_reward_days);
          dispatch(setSuccess(true, `${data.new_reward_days} day(s) added to your plan!`));
          setTimeout(() => dispatch(setSuccess(false, '')), 2500);
        } catch (e) {
          console.error('Failed to extend plan:', e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [accessToken, userId, dispatch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const id = setInterval(fetchSummary, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSummary]);

  const copy = (text, msg) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      dispatch(setSuccess(true, msg));
      setTimeout(() => dispatch(setSuccess(false, '')), 2500);
    });
  };

  const rewardDays =
    summary?.referral_count != null ? Math.floor(Number(summary.referral_count) / 7) : 0;

  return (
    <Page>
      <Header>
        <Title>{t('referrals.title')}</Title>
        <Sub>{t('referrals.description')}</Sub>
      </Header>

      <StatsRow>
        <StatCard>
          <StatValue>{summary?.referral_count ?? '—'}</StatValue>
          <StatLabel>
            <MdPeople style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {t('referrals.successfulReferrals')}
          </StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{rewardDays}</StatValue>
          <StatLabel>
            <MdSchedule style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {t('referrals.complimentaryDays')}
          </StatLabel>
        </StatCard>
      </StatsRow>

      {summary?.referral_reward_until && (
        <Sub style={{ marginBottom: 16 }}>
          {t('referrals.referralAccess')}{' '}
          <strong style={{ color: '#fff' }}>
            {new Date(summary.referral_reward_until).toLocaleString()}
          </strong>
        </Sub>
      )}

      <Section>
        <SectionTitle>
          <MdShare style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {t('referrals.shareCode')}
        </SectionTitle>
        <CodeBox>
          <CodeText>{summary?.referral_code || 'Loading…'}</CodeText>
        </CodeBox>
        <CopyBtn
          type="button"
          onClick={() =>
            copy(summary?.referral_code, 'Referral code copied.')
          }
        >
          <MdContentCopy /> {t('referrals.copyCode')}
        </CopyBtn>
        <Sub style={{ marginTop: 12, fontSize: 12 }}>
          Share this code with friends. When they sign up using this code, both of you get rewards!
        </Sub>
      </Section>

      <Section>
        <SectionTitle>{t('referrals.friendSignsUp')}</SectionTitle>
        {!summary?.referred?.length ? (
          <Sub>{t('referrals.youGetDays')}</Sub>
        ) : (
          <List>
            {summary.referred.map((r) => (
              <ListItem key={r.id}>
                <span>{r.name_masked}</span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                  {r.joined_at
                    ? new Date(r.joined_at).toLocaleDateString()
                    : ''}
                </span>
              </ListItem>
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}
