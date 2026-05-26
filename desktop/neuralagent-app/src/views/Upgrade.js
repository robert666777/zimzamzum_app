import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { HiSparkles } from 'react-icons/hi2';
import { MdCheck, MdRocket, MdSchool, MdWorkspacePremium, MdClose, MdReceipt, MdCalendarToday, MdCheckCircle, MdTimer, MdAddAlert } from 'react-icons/md';
import { Text } from '../components/Elements/Typography';
import { Button } from '../components/Elements/Button';
import { useDispatch, useSelector } from 'react-redux';
import { setSuccess, setError } from '../store';
import { useI18n } from '../i18n/I18nContext';
import { useNavigate } from 'react-router-dom';
import alipayQR from '../assets/alipay.png';
import wechatQR from '../assets/wechat.png';

// QR codes by plan and payment method
import alipayQR49 from '../assets/alipay49.png';
import wechatQR49 from '../assets/wechat49.png';
import alipayQR199 from '../assets/alipay199.png';
import wechatQR199 from '../assets/wechat199.png';
import alipayQR399 from '../assets/alipay399.png';
import wechatQR399 from '../assets/wechat399.png';

const plansData = [
  { id: 'free', name: 'Free', price: 0, icon: MdCheck, color: '#6b7280', features: ['1-day free trial on every new account', 'Full access to all features', 'Free during your trial'] },
  { id: 'starter', name: 'Starter', price: 49, icon: MdRocket, color: '#8b5cf6', features: ['Full access to every feature in zimzamzum', 'Assignments checked, analyzed, saved, submitted, compiled', 'Use it as often as you need – no monthly cap'] },
  { id: 'semester', name: 'Semester', price: 199, icon: MdSchool, color: '#06b6d4', features: ['Everything in Starter for a full semester window', 'Daily homework support throughout the whole semester', 'Best value if you only need a single-semester boost'] },
  { id: 'annual', name: 'Annual', price: 399, icon: MdWorkspacePremium, color: '#f59e0b', features: ['Full access for the entire academic year', 'Daily assignments support throughout both semesters', 'Faster responses and priority handling when it matters', 'Lowest equivalent monthly cost'] },
];

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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(252px, 1fr));
  gap: 20px;
  max-width: 1120px;
  margin: 0 auto;
  width: 100%;
  align-items: stretch;
`;

const Card = styled.article`
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 22px 20px 20px;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  }

  ${p =>
    p.$accent === 'free' &&
    `
    border-color: rgba(255, 255, 255, 0.18);
  `}
  ${p =>
    p.$accent === 'starter' &&
    `
    border-color: rgba(139, 92, 246, 0.55);
    background: linear-gradient(165deg, rgba(139, 92, 246, 0.12), rgba(255, 255, 255, 0.04));
  `}
  ${p =>
    p.$accent === 'semester' &&
    `
    border-color: rgba(56, 189, 248, 0.45);
    background: linear-gradient(165deg, rgba(56, 189, 248, 0.1), rgba(255, 255, 255, 0.04));
  `}
  ${p =>
    p.$accent === 'annual' &&
    `
    border-color: rgba(251, 191, 36, 0.5);
    background: linear-gradient(165deg, rgba(251, 191, 36, 0.12), rgba(255, 255, 255, 0.04));
  `}
`;

const Badge = styled.span`
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(75, 181, 67, 0.25);
  color: #a7f3a0;
  border: 1px solid rgba(75, 181, 67, 0.4);
`;

const PlanIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  font-size: 24px;

  ${p => p.$variant === 'free' && `background: rgba(255, 255, 255, 0.1); color: #e2e8f0;`}
  ${p =>
    p.$variant === 'starter' &&
    `background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff;`}
  ${p =>
    p.$variant === 'semester' &&
    `background: linear-gradient(135deg, #0ea5e9, #0369a1); color: #fff;`}
  ${p =>
    p.$variant === 'annual' &&
    `background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff;`}
`;

const PlanName = styled.h2`
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #fff;
`;

const PlanTagline = styled.p`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0 0 16px;
  line-height: 1.45;
`;

const PriceRow = styled.div`
  margin-bottom: 6px;
`;

const PriceMain = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.03em;

  span.currency {
    font-size: 18px;
    font-weight: 600;
    margin-right: 2px;
    opacity: 0.95;
  }
`;

const PricePeriod = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 14px;
`;

const StrikeRow = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 4px;

  s {
    text-decoration: line-through;
    text-decoration-color: rgba(255, 255, 255, 0.35);
  }
`;

const FeatureList = styled.ul`
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  flex: 1;
`;

const Feature = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.45;
  margin-bottom: 10px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: #4ade80;
    font-size: 18px;
  }
`;

const SubscribeBtn = styled(Button)`
  width: 100%;
  justify-content: center;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  margin-top: auto;
  background: var(--accent-blue);
  color: #fff;
  border: none;

  &:hover {
    opacity: 1;
    background: var(--accent-blue-hover);
  }
`;

const CurrentBtn = styled(SubscribeBtn)`
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: default;

  &:hover {
    opacity: 1;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: #2a2a2a;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }
`;

const PaymentMethods = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 20px 0;
`;

const AlipayBtn = styled(Button)`
  width: 100%;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  background: #1677FF;
  border: 2px solid #1677FF;
  color: #fff;
  transition: all 0.2s ease;
  opacity: ${p => p.$selected ? 1 : 0.7};

  &:hover {
    background: #4096FF;
    opacity: 1;
  }
`;

const WechatBtn = styled(Button)`
  width: 100%;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  background: #07C160;
  border: 2px solid #07C160;
  color: #fff;
  transition: all 0.2s ease;
  opacity: ${p => p.$selected ? 1 : 0.7};

  &:hover {
    background: #52C41A;
    opacity: 1;
  }
`;

const QRCodeContainer = styled.div`
  margin: 20px 0;
  text-align: center;
`;

const QRImage = styled.img`
  max-width: 250px;
  width: 100%;
  height: 250px;
  object-fit: contain;
  border-radius: 12px;
  border: 3px solid rgba(255,255,255,0.1);
  background: white;
`;

const ConfirmBtn = styled(Button)`
  width: 100%;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: #4ade80;
  color: #000;
  border: none;
  margin-top: 20px;

  &:hover {
    background: #22c55e;
  }
`;

const PLAN_CONFIG = [
  {
    id: 'free',
    accent: 'free',
    icon: 'free',
    Icon: HiSparkles,
    price: null,
    strike: null,
    cta: 'current',
  },
  {
    id: 'starter',
    accent: 'starter',
    icon: 'starter',
    Icon: MdRocket,
    price: 49,
    strike: null,
    cta: 'subscribe',
  },
  {
    id: 'semester',
    accent: 'semester',
    icon: 'semester',
    Icon: MdSchool,
    price: 199,
    strike: 299,
    cta: 'subscribe',
  },
  {
    id: 'annual',
    accent: 'annual',
    icon: 'annual',
    Icon: MdWorkspacePremium,
    price: 399,
    strike: 599,
    cta: 'subscribe',
  },
];

const BillingSection = styled.div`
  margin-top: 40px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
`;

const BillingTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 20px;
`;

const BillingEmpty = styled.div`
  text-align: center;
  padding: 30px;
  color: rgba(255, 255, 255, 0.5);
`;

const BillingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BillingItem = styled.div`
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
`;

const BillingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:not(:last-child) {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

const BillingInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const BillingPlan = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #fff;
`;

const BillingDate = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  
  .time {
    margin-left: 4px;
    opacity: 0.7;
  }
`;

const BillingConfirmation = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #07C160;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(7, 193, 96, 0.2);
`;

const BillingAmount = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #fff;
`;

const BillingMethod = styled.div`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
`;

const BillingStatus = styled.div`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  
  ${p => p.$confirmed 
    ? 'background: rgba(7, 193, 96, 0.2); color: #07C160;' 
    : 'background: rgba(255, 193, 7, 0.2); color: #FFC107;'
  }
`;

const CountdownBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: ${p => p.$expired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)'};
  border-radius: 12px;
  margin-bottom: 24px;
  
  svg {
    color: ${p => p.$expired ? '#ef4444' : '#4ade80'};
    font-size: 18px;
  }
`;

const CountdownText = styled.span`
  font-size: 14px;
  color: ${p => p.$expired ? '#ef4444' : '#4ade80'};
  font-weight: 600;
`;

const CountdownValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-left: 8px;
`;

const ExpirationModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
`;

const ExpirationContent = styled.div`
  background: #2a2a2a;
  border-radius: 20px;
  padding: 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
`;

const ExpirationIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  
  svg {
    font-size: 40px;
    color: #ef4444;
  }
`;

const ExpirationTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
`;

const ExpirationText = styled.p`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 24px;
  line-height: 1.6;
`;

const ExpirationBtn = styled(Button)`
  width: 100%;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: #1677FF;
  color: #fff;
  border: none;
  
  &:hover {
    background: #4096FF;
  }
`;

export default function Upgrade() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t, messages } = useI18n();
  const plansCopy = messages.upgradePlans;
  const user = useSelector(state => state.user);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [userPayments, setUserPayments] = useState([]);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, expired: false });
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [planExpired, setPlanExpired] = useState(false);

  useEffect(() => {
    const loadUserPlan = async () => {
      if (window.electronAPI && user?.id) {
        const plan = await window.electronAPI.getUserPlan(user.id);
        setUserPlan(plan.plan || 'free');
        setPlanExpired(plan.isExpired || false);
      }
    };
    loadUserPlan();
  }, [user?.id]);

  useEffect(() => {
    const loadUserPayments = async () => {
      if (window.electronAPI) {
        const payments = await window.electronAPI.getPendingPayments();
        const userPays = payments.filter(p => p.userId === user?.id);
        setUserPayments(userPays);
      }
    };
    loadUserPayments();
    const interval = setInterval(loadUserPayments, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const loadCountdown = async () => {
      if (window.electronAPI && user?.id) {
        const cd = await window.electronAPI.getPlanCountdown(user.id);
        const plan = await window.electronAPI.getUserPlan(user.id);
        setCountdown(cd);
        if (cd.expired && plan.plan === 'free') {
          setShowExpirationModal(true);
        }
      }
    };
    loadCountdown();
    const interval = setInterval(loadCountdown, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleCloseExpirationModal = useCallback(() => {
    setShowExpirationModal(false);
  }, []);

  const currentPlanConfig = PLAN_CONFIG.map(config => ({
    ...config,
    cta: config.id === userPlan ? 'current' : 'subscribe',
  }));

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowModal(true);
    setSelectedPayment(null);
  };

  const handlePaid = async () => {
    if (!selectedPlan || !selectedPayment) return;
    
    const payment = {
      id: Date.now(),
      userId: user?.id || 'guest',
      userName: user?.name || 'User',
      plan: selectedPlan.id,
      amount: selectedPlan.price,
      method: selectedPayment,
      date: new Date().toISOString(),
      status: 'pending'
    };

    if (window.electronAPI) {
      window.electronAPI.addPendingPayment(payment);
    } else {
      const payments = JSON.parse(localStorage.getItem('pendingPayments') || '[]');
      payments.push(payment);
      localStorage.setItem('pendingPayments', JSON.stringify(payments));
    }

    dispatch(setSuccess(true, t('upgrade.paymentPending')));
    setShowModal(false);
    setSelectedPlan(null);
    setSelectedPayment(null);
  };

  return (
    <Page>
      <Header>
        <Title>{t('upgrade.title')}</Title>
        <Subtitle>
          {t('upgrade.subtitle', { currency: t('upgrade.currency') })}
        </Subtitle>
      </Header>

      {userPlan === 'free' && (
        <CountdownBanner $expired={countdown.expired}>
          <MdTimer />
          <CountdownText $expired={countdown.expired}>
            {countdown.expired ? 'Free Trial Expired' : 'Free Trial Ends In:'}
          </CountdownText>
          <CountdownValue>
            {countdown.days}d {countdown.hours}h {countdown.minutes}m
          </CountdownValue>
        </CountdownBanner>
      )}

      {userPlan !== 'free' && !countdown.expired && (
        <CountdownBanner $expired={false}>
          <MdTimer />
          <CountdownText $expired={false}>Plan Expires In:</CountdownText>
          <CountdownValue>
            {countdown.days}d {countdown.hours}h {countdown.minutes}m
          </CountdownValue>
        </CountdownBanner>
      )}

      <Grid>
        {currentPlanConfig.map(cfg => {
          const copy = plansCopy[cfg.id];
          const Icon = cfg.Icon;
          return (
            <Card key={cfg.id} $accent={cfg.accent}>
              {(cfg.id === 'free' || cfg.cta === 'current') && <Badge>{t('upgrade.badgeCurrent')}</Badge>}

              <PlanIcon $variant={cfg.icon}>
                <Icon />
              </PlanIcon>

              <PlanName>{copy.name}</PlanName>
              <PlanTagline>{copy.tagline}</PlanTagline>

              {cfg.price !== null ? (
                <>
                  {cfg.strike != null && (
                    <StrikeRow>
                      <s>¥{cfg.strike}</s>
                    </StrikeRow>
                  )}
                  <PriceRow>
                    <PriceMain>
                      <span className="currency">¥</span>
                      {cfg.price}
                    </PriceMain>
                  </PriceRow>
                  <PricePeriod>{copy.period}</PricePeriod>
                </>
              ) : (
                <>
                  <PriceRow>
                    <PriceMain>
                      <span className="currency">¥</span>0
                    </PriceMain>
                  </PriceRow>
                  <PricePeriod>{t('upgrade.periodFreeNote')}</PricePeriod>
                </>
              )}

              <FeatureList>
                {copy.features.map((line, idx) => (
                  <Feature key={idx}>
                    <MdCheck aria-hidden />
                    <span>{line}</span>
                  </Feature>
                ))}
              </FeatureList>

              {cfg.id === 'free' ? (
                <CurrentBtn disabled>{t('upgrade.ctaCurrent')}</CurrentBtn>
              ) : cfg.cta === 'current' ? (
                <CurrentBtn disabled>{t('upgrade.ctaCurrent')}</CurrentBtn>
              ) : (
                <SubscribeBtn dark onClick={() => handleSelectPlan(cfg)}>
                  {t('upgrade.ctaSubscribe')}
                </SubscribeBtn>
              )}
            </Card>
          );
        })}
      </Grid>

      <BillingSection>
        <BillingTitle>
          <MdReceipt />
          {t('upgrade.billing')}
        </BillingTitle>
        
        {userPayments.length === 0 ? (
          <BillingEmpty>
            {t('upgrade.noPayments')}
          </BillingEmpty>
        ) : (
          <BillingList>
            {userPayments.map(payment => (
                <BillingItem key={payment.id}>
                  <BillingRow>
                    <BillingPlan>{payment.plan}</BillingPlan>
                    <BillingAmount>¥{payment.amount}</BillingAmount>
                  </BillingRow>
                  <BillingRow>
                    <BillingMethod>{payment.method}</BillingMethod>
                    <BillingStatus $confirmed={payment.status === 'confirmed'}>
                      {payment.status === 'confirmed' ? t('upgrade.planStarted') : t('upgrade.pending')}
                    </BillingStatus>
                  </BillingRow>
                  {payment.status === 'confirmed' && payment.confirmedAt && (
                    <BillingConfirmation>
                      <MdCheckCircle size={14} />
                      <span>{t('upgrade.confirmedOn')} {new Date(payment.confirmedAt).toLocaleString()}</span>
                    </BillingConfirmation>
                  )}
                </BillingItem>
              ))}
          </BillingList>
        )}
      </BillingSection>

      {showModal && selectedPlan && (
        <ModalOverlay onClick={() => setShowModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <CloseBtn onClick={() => setShowModal(false)}>
              <MdClose />
            </CloseBtn>
            
            <Title style={{ fontSize: '22px', marginBottom: '8px' }}>
              {plansCopy[selectedPlan.id].name} - ¥{selectedPlan.price}
            </Title>
            
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
              {t('upgrade.selectPaymentMethod')}
            </Text>

            <PaymentMethods>
              <AlipayBtn 
                $selected={selectedPayment === 'alipay'}
                onClick={() => setSelectedPayment('alipay')}
              >
                {t('upgrade.paymentMethods.alipay')}
              </AlipayBtn>
              <WechatBtn 
                $selected={selectedPayment === 'wechat'}
                onClick={() => setSelectedPayment('wechat')}
              >
                {t('upgrade.paymentMethods.wechat')}
              </WechatBtn>
            </PaymentMethods>

            {selectedPayment && (
              <QRCodeContainer>
                <Text style={{ marginBottom: '12px', fontSize: '14px' }}>
                  {t('upgrade.scanQrCode')}
                </Text>
                {selectedPayment === 'alipay' && (
                  <QRImage 
                    src={
                      selectedPlan.price === 49 ? alipayQR49 :
                      selectedPlan.price === 199 ? alipayQR199 :
                      alipayQR399
                    } 
                    alt="Alipay QR Code" 
                  />
                )}
                {selectedPayment === 'wechat' && (
                  <QRImage 
                    src={
                      selectedPlan.price === 49 ? wechatQR49 :
                      selectedPlan.price === 199 ? wechatQR199 :
                      wechatQR399
                    } 
                    alt="WeChat Pay QR Code" 
                  />
                )}
              </QRCodeContainer>
            )}

            {selectedPayment && (
              <ConfirmBtn onClick={handlePaid}>
                {t('upgrade.ivePaid')}
              </ConfirmBtn>
            )}
          </ModalContent>
        </ModalOverlay>
      )}

      {showExpirationModal && (
        <ExpirationModal onClick={handleCloseExpirationModal}>
          <ExpirationContent onClick={e => e.stopPropagation()}>
            <ExpirationIcon>
              <MdAddAlert />
            </ExpirationIcon>
            <ExpirationTitle>1-Day Free Trial Expired</ExpirationTitle>
            <ExpirationText>
              Your free trial has expired. Upgrade to access ZimZamZum features.
            </ExpirationText>
            <ExpirationBtn onClick={handleCloseExpirationModal}>
              Upgrade Now
            </ExpirationBtn>
          </ExpirationContent>
        </ExpirationModal>
      )}
    </Page>
  );
}