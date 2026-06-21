import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../../i18n/I18nContext.jsx';
import { useDispatch } from 'react-redux';
import { setUpgradePrompt } from '../../../store';
import { DialogContainer, DialogOverlay } from '../Dialog/DialogElements';
import { Divider } from '../SmallElements';
import { IconButton } from '../Button';
import { IoMdClose } from 'react-icons/io';
import { useSelector } from 'react-redux';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -45%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`;

const ModalContainer = styled.div`
  position: fixed;
  z-index: 1000;
  width: 90%;
  max-width: 500px;
  background: var(--dark-theme-background);
  justify-content: center;
  align-items: center;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 10px;
  box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
  max-height: 100vh;
  animation: ${slideUp} 0.25s ease-out;
  padding: 20px;
`;

const ModalOverlay = styled.div`
  position: fixed;
  z-index: 1000;
  height: 100%;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  left: 0%;
  top: 0%;
  animation: ${fadeIn} 0.2s ease-out;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0 0 10px 0;
`;

const ModalTitle = styled.div`
  font-size: 17px;
  color: #fff;
  font-weight: 700;
  flex: 1;
`;

const HeaderEnd = styled.div`
  margin-left: auto;
`;

const ModalContent = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const IconContainer = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(22, 119, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  text-align: center;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  margin: 0;
  text-align: center;
`;

const Link = styled.span`
  color: #1677FF;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;

  &:hover {
    color: #4096FF;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  width: 100%;
  margin-top: 8px;
`;

const UpgradeButton = styled.button`
  flex: 1;
  background: #1677FF;
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #4096FF;
  }
`;

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="#1677FF" strokeWidth="2"/>
    <path d="M12 7V12L15 15" stroke="#1677FF" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const UpgradeModal = ({ show, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const isRTL = useSelector(state => state.isRTL);

  if (!show) return null;

  const handleUpgradeClick = () => {
    dispatch(setUpgradePrompt(false));
    navigate('/upgrade');
  };

  const handleClose = () => {
    dispatch(setUpgradePrompt(false));
    onClose?.();
  };

  return (
    <>
      <ModalOverlay onClick={handleClose} />
      <ModalContainer>
        <ModalHeader>
          <ModalTitle></ModalTitle>
          <HeaderEnd>
            <IconButton onClick={handleClose} iconSize="30px" color="rgba(255, 255, 255, 0.75)">
              <IoMdClose />
            </IconButton>
          </HeaderEnd>
        </ModalHeader>
        <Divider color='rgba(255, 255, 255, 0.2)' style={{marginBottom: '10px'}} />
        <ModalContent>
          <IconContainer>
            <ClockIcon />
          </IconContainer>
          <Title>{t('upgradePlans.upgradePrompt.title')}</Title>
          <Description>
            {t('upgradePlans.upgradePrompt.dailyMinutesUsed')}{' '}
            <Link onClick={handleUpgradeClick}>{t('upgradePlans.upgradePrompt.upgradeLink')}</Link>{' '}
            {t('upgradePlans.upgradePrompt.toRemoveLimit')}.
          </Description>
          <ButtonContainer>
            <UpgradeButton onClick={handleUpgradeClick}>
              {t('upgradePlans.upgradePrompt.upgradeButton')}
            </UpgradeButton>
          </ButtonContainer>
        </ModalContent>
      </ModalContainer>
    </>
  );
};

export default UpgradeModal;
