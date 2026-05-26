import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useDispatch } from 'react-redux';
import { setLoadingDialog, setError } from '../store';
import constants from '../utils/constants';
import { PRODUCT_TOUR_SESSION_KEY } from '../utils/userStorage';
import { useNavigate, Link } from 'react-router-dom';
import axios, { API_KEY_HEADER } from '../utils/axios';
import { Text } from '../components/Elements/Typography';
import { FaPhone, FaEye, FaEyeSlash, FaChevronDown } from "react-icons/fa";

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

const SignUpButton = styled.button`
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


function SignUp() {

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const isFormValid = () => {
    return name.length > 0 && phoneNumber.length >= 10 && password.length >= 6 && confirmPassword === password;
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      signUpUser();
    }
  }

  const setTitle = () => {
    document.title = 'Sign Up | ' + constants.APP_NAME;
  }

  const signUpUser = () => {
    if (!isFormValid()) {
      return;
    }
    dispatch(setLoadingDialog(true));
    
    const data = { name: name, phone_number: phoneNumber, password: password, referral_code: referralCode };
    
    axios.post('/auth/signup', data, API_KEY_HEADER).then((response) => {
      dispatch(setLoadingDialog(false));
      sessionStorage.setItem(PRODUCT_TOUR_SESSION_KEY, '1');
      window.electronAPI.setToken(response.data.token);
      window.electronAPI.setRefreshToken(response.data.refresh_token);
      window.location.reload();
    }).catch((error) => {
      dispatch(setLoadingDialog(false));
      if (error.response && error.response.status === constants.status.CONFLICT) {
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
  }, []);

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
            <LogoImage src="/logo.png" alt="Logo" />
          </LogoContainer>
          
          <Slogan>
            Never ever miss any<br/>
            assignments deadlines<br/>
            with <span>zimzamzum</span>
          </Slogan>
        </LeftSection>
        
        <RightSection>
          <HeaderTabs>
            <Tab active={false} onClick={() => navigate('/login')}>Log In</Tab>
            <Tab active={true}>Sign Up</Tab>
          </HeaderTabs>
          
          <Text fontSize="14px" color="rgba(255,255,255,0.6)" style={{marginBottom: '25px'}}>
            Create your account to get started.
          </Text>
          
          <InputField 
            placeholder="Full Name" 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown} 
          />
          
          <PhoneInputContainer>
            <PhonePrefix>+86</PhonePrefix>
            <PhoneInput 
              placeholder="Phone number" 
              type="tel"
              maxLength={11}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              onKeyDown={handleKeyDown} 
            />
          </PhoneInputContainer>
          
          <PasswordContainer>
            <InputField 
              placeholder="Password" 
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown} 
            />
            <PasswordToggle onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
            </PasswordToggle>
          </PasswordContainer>
          
          <InputField 
            placeholder="Confirm Password" 
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown} 
          />
          
          <InputField 
            placeholder="Referral Code (optional)" 
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown} 
          />
          
          {password !== confirmPassword && confirmPassword.length > 0 && (
            <Text fontSize="14px" color="#ff4444" style={{marginBottom: '10px'}}>
              Passwords do not match
            </Text>
          )}
          
          <SignUpButton disabled={!isFormValid()} onClick={signUpUser}>
            Sign Up
          </SignUpButton>
          
          <LinkText>
            Already have an account? <Link to="/login">Log In</Link>
          </LinkText>
          
          <TermsText>
            By signing up, you agree to our <a href="https://zimzamzum.site/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="https://zimzamzum.site/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </TermsText>
        </RightSection>
      </LoginCard>
    </MainContainer>
  );
}

export default SignUp;