import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MdCheck, MdClose } from 'react-icons/md';
import { Text } from '../components/Elements/Typography';
import { Button } from '../components/Elements/Button';
import { useDispatch } from 'react-redux';
import { setSuccess, setError } from '../store';
import { useI18n } from '../i18n/I18nContext';

const Page = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 20px 32px;
  overflow-y: auto;
  background: #1a1a1a;
  color: #fff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
`;

const Header = styled.div`
  max-width: 1100px;
  margin: 0 auto 28px;
  text-align: center;
`;

const Title = styled(Text)`
  font-size: clamp(26px, 4vw, 32px);
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
`;

const Subtitle = styled(Text)`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.65;
  max-width: 720px;
  margin: 0 auto;
`;

const List = styled.div`
  max-width: 1120px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Card = styled.article`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
`;

const Info = styled.div`
  flex: 1;
  min-width: 200px;
`;

const Label = styled(Text)`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
`;

const Value = styled(Text)`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
`;

const ConfirmBtn = styled(Button)`
  background: #4ade80;
  color: #000;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;

  &:hover {
    background: #22c55e;
  }
`;

const EmptyState = styled.div`
  max-width: 500px;
  margin: 60px auto;
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  opacity: 0.2;
  margin-bottom: 20px;
`;

export default function Admin() {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const loadPayments = async () => {
      let saved = [];
      if (window.electronAPI) {
        saved = await window.electronAPI.getPendingPayments();
      } else {
        saved = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
      }
      setPayments(saved);
    };
    loadPayments();
  }, []);

  const handleConfirm = (paymentId) => {
    const updated = payments.map(p => 
      p.id === paymentId ? { ...p, status: 'confirmed' } : p
    );
    setPayments(updated);
    
    if (window.electronAPI) {
      window.electronAPI.confirmPayment(paymentId);
    } else {
      localStorage.setItem('pendingPayments', JSON.stringify(updated));
    }
    
    dispatch(setSuccess(true, t('admin.paymentConfirmed')));
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');

  return (
    <>
      <Header>
        <Title>{t('admin.title')}</Title>
      </Header>

      {pendingPayments.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📭</EmptyIcon>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('admin.noPendingPayments')}
          </Text>
        </EmptyState>
      ) : (
        <List>
          {pendingPayments.map(payment => (
            <Card key={payment.id}>
              <Info>
                <Label>{t('admin.user')}</Label>
                <Value>{payment.userName}</Value>
              </Info>
              <Info>
                <Label>{t('admin.plan')}</Label>
                <Value>{payment.plan}</Value>
              </Info>
              <Info>
                <Label>{t('admin.amount')}</Label>
                <Value>¥{payment.amount}</Value>
              </Info>
              <Info>
                <Label>{t('admin.method')}</Label>
                <Value>{payment.method}</Value>
              </Info>
              <Info>
                <Label>{t('admin.date')}</Label>
                <Value>{new Date(payment.date).toLocaleString()}</Value>
              </Info>
              <ConfirmBtn onClick={() => handleConfirm(payment.id)}>
                <MdCheck style={{ marginRight: '8px' }} />
                {t('admin.confirmPayment')}
              </ConfirmBtn>
            </Card>
          ))}
        </List>
      )}
    </>
  );
}
