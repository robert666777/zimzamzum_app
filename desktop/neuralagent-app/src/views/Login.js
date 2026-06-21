import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useDispatch } from 'react-redux';
import { setLoadingDialog, setError } from '../store';
import constants from '../utils/constants';
import { useNavigate, Link } from 'react-router-dom';
import axios, { API_KEY_HEADER } from '../utils/axios';
import { Text } from '../components/Elements/Typography';
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useI18n } from '../i18n/I18nContext';

const pulseGlow = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 20px rgba(0, 150, 255, 0.5)) drop-shadow(0 0 40px rgba(0, 150, 255, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 40px rgba(0, 150, 255, 0.8)) drop-shadow(0 0 80px rgba(0, 150, 255, 0.5));
  }
`;

const MainContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 900px;
  background: rgba(20, 20, 30, 0.95);
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6), 0 0 80px rgba(0, 100, 255, 0.1);
  display: flex;
  overflow: hidden;
`;

const LeftSection = styled.div`
  flex: 1;
  padding: 60px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(0, 100, 255, 0.08) 0%, transparent 100%);
  border-right: 1px solid rgba(0, 100, 255, 0.15);
  position: relative;
`;

const CircleBackground = styled.div`
  position: absolute;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  border: 1px solid rgba(0, 150, 255, 0.2);
  opacity: 0.5;
`;

const CircleBackground2 = styled.div`
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 1px solid rgba(0, 150, 255, 0.15);
  opacity: 0.3;
`;

const DotContainer = styled.div`
  position: absolute;
  display: flex;
  gap: 80px;
  opacity: 0.4;
  
  div {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 150, 255, 0.3);
  }
`;

const LogoContainer = styled.div`
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const Slogan = styled.div`
  text-align: center;
  color: #fff;
  font-size: 18px;
  line-height: 1.6;
  margin-top: 40px;
  position: relative;
  z-index: 1;
  
  span {
    color: #0096ff;
    font-weight: 600;
  }
`;

const LogoImage = styled.img`
  width: 600px;
  height: 600px;
  object-fit: contain;
  animation: ${pulseGlow} 2s ease-in-out infinite;
`;

const RightSection = styled.div`
  flex: 1;
  padding: 60px 40px;
  position: relative;
`;

const InputField = styled.input`
  width: 100%;
  padding: 16px 20px;
  margin-bottom: 15px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 16px;
  outline: none;
  transition: all 0.3s ease;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    border-color: #0096ff;
    box-shadow: 0 0 20px rgba(0, 150, 255, 0.2);
  }
`;

const PasswordContainer = styled.div`
  position: relative;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 18px;
  
  &:hover {
    color: #fff;
  }
`;

const LoginButton = styled.button`
  width: 100%;
  padding: 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #0096ff 0%, #0066cc 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 5px 20px rgba(0, 150, 255, 0.4);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 150, 255, 0.5);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const LinkText = styled.div`
  text-align: center;
  margin-top: 25px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  
  a {
    color: #0096ff;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const LangToggle = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  margin-bottom: 22px;
`;

const LangButton = styled.button`
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: ${(props) => (props.active ? 'rgba(0, 150, 255, 0.18)' : 'transparent')};
  color: ${(props) => (props.active ? '#0096ff' : 'rgba(255, 255, 255, 0.6)')};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 150, 255, 0.4);
    color: #fff;
  }
`;

const HeaderTabs = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 25px;
`;

const Tab = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.active ? '#fff' : 'rgba(255, 255, 255, 0.5)'};
  cursor: pointer;
  padding-bottom: 8px;
  border-bottom: 2px solid ${props => props.active ? '#0096ff' : 'transparent'};
  transition: all 0.3s ease;
  
  &:hover {
    color: #fff;
  }
`;

const PhoneInputContainer = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  margin-bottom: 15px;
  
  &:focus-within {
    border-color: #0096ff;
    box-shadow: 0 0 20px rgba(0, 150, 255, 0.2);
  }
`;

const PhonePrefix = styled.div`
  padding: 16px 15px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
`;

const PhoneInput = styled.input`
  flex: 1;
  padding: 16px 20px;
  background: transparent;
  color: #fff;
  font-size: 16px;
  outline: none;
  border: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const TermsText = styled.div`
  text-align: center;
  margin-top: 20px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  
  a {
    color: #0096ff;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;


function Login() {

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  
  const isFormValid = () => {
    return phoneNumber.length >= 10 && password.length > 0;
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      loginUser();
    }
  }

  const setTitle = () => {
    document.title = `${t('auth.loginTitle')} | ${constants.APP_NAME}`;
  }

  const loginUser = () => {
    if (!isFormValid()) {
      return;
    }
    dispatch(setLoadingDialog(true));
    
    const data = { phone_number: phoneNumber, password: password };
    
    axios.post('/auth/login', data, API_KEY_HEADER).then((response) => {
      dispatch(setLoadingDialog(false));
      window.electronAPI.setToken(response.data.token);
      window.electronAPI.setRefreshToken(response.data.refresh_token);
      window.location.reload();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        dispatch(setError(true, 'Incorrect Phone Number or Password, Please try again.'));
      } else if (error.response?.status === constants.status.CONFLICT) {
        dispatch(setError(true, 'Phone already exists, Please try again.'));
      } else {
        dispatch(setError(true, 'Server connection failed. Please check if the backend server is running.'));
      }
      setTimeout(() => {
        dispatch(setError(false, ''));
      }, 3000);
    });
  }
  
  useEffect(() => {
    setTitle();
  }, [t]);

  return (
    <MainContainer>
      <LoginCard>
        <LeftSection>
          <CircleBackground />
          <CircleBackground2 />
          <DotContainer>
            <div />
            <div />
            <div />
          </DotContainer>
          
          <LogoContainer>
            <LogoImage src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" />
          </LogoContainer>
          
          <Slogan>
            {t('auth.sloganLine1')}<br/>
            {t('auth.sloganLine2')}<br/>
            {t('auth.sloganLine3')} <span>zimzamzum</span>
          </Slogan>
        </LeftSection>
        
        <RightSection>
          <HeaderTabs>
            <Tab active={true}>{t('auth.loginTitle')}</Tab>
            <Tab active={false} onClick={() => navigate('/signup')}>{t('auth.signupTitle')}</Tab>
          </HeaderTabs>
          
          <LangToggle>
            <LangButton type="button" active={locale === 'en'} onClick={() => setLocale('en')}>
              {t('profile.langEn')}
            </LangButton>
            <LangButton type="button" active={locale === 'zh'} onClick={() => setLocale('zh')}>
              {t('profile.langZh')}
            </LangButton>
          </LangToggle>

          <Text fontSize="14px" color="rgba(255,255,255,0.6)" style={{marginBottom: '25px'}}>
            {t('auth.loginSubtitle')}
          </Text>
          
          <PhoneInputContainer>
            <PhonePrefix>+86</PhonePrefix>
            <PhoneInput 
              placeholder={t('auth.phonePlaceholder')} 
              type="tel"
              maxLength={11}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              onKeyDown={handleKeyDown} 
            />
          </PhoneInputContainer>
          
          <PasswordContainer>
            <InputField 
              placeholder={t('auth.passwordPlaceholder')} 
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown} 
            />
            <PasswordToggle onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
            </PasswordToggle>
          </PasswordContainer>
          
          <LoginButton disabled={!isFormValid()} onClick={loginUser}>
            {t('auth.loginButton')}
          </LoginButton>
          
          <LinkText>
            {t('auth.dontHaveAccount')} <Link to="/signup">{t('auth.signupButton')}</Link>
          </LinkText>
          
          <TermsText>
            {t('auth.termsLoginPrefix')} <a href="https://zimzamzum.site/terms" target="_blank" rel="noopener noreferrer">{t('auth.termsOfService')}</a> {t('auth.termsAnd')} <a href="https://zimzamzum.site/privacy" target="_blank" rel="noopener noreferrer">{t('auth.privacyPolicy')}</a>.
          </TermsText>
        </RightSection>
      </LoginCard>
    </MainContainer>
  );
}

export default Login;