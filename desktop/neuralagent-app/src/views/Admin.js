import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MdCheck, MdClose, MdAccessTime, MdPerson, MdBusiness, MdPayment, MdEvent, MdCheckCircle } from 'react-icons/md';
import { Text } from '../components/Elements/Typography';
import { Button } from '../components/Elements/Button';
import { useDispatch, useSelector } from 'react-redux';
import { setSuccess, setError } from '../store';
import { useI18n } from '../i18n/I18nContext';
import paymentApi from '../utils/paymentApi';

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

const FilterTabs = styled.div`
  max-width: 1120px;
  margin: 0 auto 20px;
  display: flex;
  gap: 8px;
`;

const FilterTab = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: ${p => p.$active ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
  color: ${p => p.$active ? '#3b82f6' : 'rgba(255, 255, 255, 0.7)'};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
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
  flex-direction: column;
  gap: 16px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const CardBody = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled(Text)`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const Value = styled(Text)`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
`;

const StatusBadge = styled.span`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;

  ${p => p.$status === 'pending' && `
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  `}
  ${p => p.$status === 'approved' && `
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  `}
  ${p => p.$status === 'rejected' && `
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  `}
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
`;

const ConfirmBtn = styled(Button)`
  background: #4ade80;
  color: #000;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: #22c55e;
  }

  &:disabled {
    background: rgba(74, 222, 128, 0.5);
    cursor: not-allowed;
  }
`;

const RejectBtn = styled(Button)`
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

const ConfirmationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
  margin-top: 8px;
`;

const PlanInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export default function Admin() {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const accessToken = useSelector(state => state.accessToken);
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    
    const loadPayments = async () => {
      try {
        const data = await paymentApi.getAllPaymentRequests(accessToken);
        setPayments(data);
      } catch (error) {
        console.error('Error loading payments:', error);
        if (error.response?.status === 403) {
          dispatch(setError(true, 'You are not authorized to access the admin panel'));
        }
      }
    };
    loadPayments();
    const interval = setInterval(loadPayments, 5000);
    return () => clearInterval(interval);
  }, [dispatch, accessToken]);

  const handleConfirm = async (paymentId) => {
    setLoading(true);
    try {
      await paymentApi.approvePayment(paymentId, accessToken);
      setPayments(prev => prev.map(p => 
        p.id === paymentId ? { ...p, status: 'approved' } : p
      ));
      dispatch(setSuccess(true, t('admin.paymentConfirmed') || 'Payment confirmed successfully'));
    } catch (error) {
      dispatch(setError(true, t('admin.errorConfirming') || 'Error confirming payment'));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (paymentId) => {
    setLoading(true);
    try {
      await paymentApi.rejectPayment(paymentId, 'Payment rejected by admin', accessToken);
      setPayments(prev => prev.map(p => 
        p.id === paymentId ? { ...p, status: 'rejected' } : p
      ));
      dispatch(setSuccess(true, 'Payment rejected successfully'));
    } catch (error) {
      dispatch(setError(true, 'Error rejecting payment'));
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <MdAccessTime size={14} />;
      case 'approved': return <MdCheckCircle size={14} />;
      case 'rejected': return <MdClose size={14} />;
      default: return null;
    }
  };

  return (
    <Page>
      <Header>
        <Title>{t('admin.title') || 'Admin Panel'}</Title>
        <Subtitle>
          {t('admin.subtitle') || 'Manage payment requests and user upgrades'}
        </Subtitle>
      </Header>

      <FilterTabs>
        <FilterTab 
          $active={filter === 'all'} 
          onClick={() => setFilter('all')}
        >
          All ({payments.length})
        </FilterTab>
        <FilterTab 
          $active={filter === 'pending'} 
          onClick={() => setFilter('pending')}
        >
          Pending ({payments.filter(p => p.status === 'pending').length})
        </FilterTab>
        <FilterTab 
          $active={filter === 'approved'} 
          onClick={() => setFilter('approved')}
        >
          Approved ({payments.filter(p => p.status === 'approved').length})
        </FilterTab>
        <FilterTab 
          $active={filter === 'rejected'} 
          onClick={() => setFilter('rejected')}
        >
          Rejected ({payments.filter(p => p.status === 'rejected').length})
        </FilterTab>
      </FilterTabs>

      {filteredPayments.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📭</EmptyIcon>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('admin.noPendingPayments') || 'No payment requests found'}
          </Text>
        </EmptyState>
      ) : (
        <List>
          {filteredPayments.map(payment => (
            <Card key={payment.id}>
              <CardHeader>
                <PlanInfo>
                  <MdBusiness size={18} style={{ color: '#3b82f6' }} />
                  <Value>{payment.plan?.name || payment.plan_id}</Value>
                </PlanInfo>
                <StatusBadge $status={payment.status}>
                  {getStatusIcon(payment.status)}
                  {getStatusText(payment.status)}
                </StatusBadge>
              </CardHeader>

              <CardBody>
                <Info>
                  <Label>
                    <MdPerson size={12} style={{ marginRight: 4 }} />
                    User
                  </Label>
                  <Value>{payment.user_name}</Value>
                </Info>
                <Info>
                  <Label>
                    <MdPayment size={12} style={{ marginRight: 4 }} />
                    Amount
                  </Label>
                  <Value>¥{payment.amount}</Value>
                </Info>
                <Info>
                  <Label>
                    <MdPayment size={12} style={{ marginRight: 4 }} />
                    Method
                  </Label>
                  <Value>{payment.payment_method}</Value>
                </Info>
                <Info>
                  <Label>
                    <MdEvent size={12} style={{ marginRight: 4 }} />
                    Requested
                  </Label>
                  <Value>{payment.created_at ? new Date(payment.created_at).toLocaleString() : '-'}</Value>
                </Info>
              </CardBody>

              {payment.status === 'approved' && payment.confirmed_at && (
                <ConfirmationInfo>
                  <MdCheckCircle size={16} style={{ color: '#4ade80' }} />
                  <span style={{ color: '#4ade80', fontSize: '14px', fontWeight: 500 }}>
                    Confirmed on {new Date(payment.confirmed_at).toLocaleString()}
                  </span>
                </ConfirmationInfo>
              )}

              {payment.status === 'pending' && (
                <Actions>
                  <ConfirmBtn 
                    onClick={() => handleConfirm(payment.id)} 
                    disabled={loading}
                  >
                    <MdCheck size={16} />
                    {loading ? 'Processing...' : (t('admin.confirmPayment') || 'Confirm Payment')}
                  </ConfirmBtn>
                  <RejectBtn 
                    onClick={() => handleReject(payment.id)} 
                    disabled={loading}
                  >
                    <MdClose size={16} />
                    Reject
                  </RejectBtn>
                </Actions>
              )}
            </Card>
          ))}
        </List>
      )}
    </Page>
  );
}