import styled from 'styled-components';
import { NavLink } from 'react-router-dom';

export const SidebarContainer = styled.div`
  width: 268px;
  min-width: 268px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 12px 12px;
  box-sizing: border-box;
  background: #121212;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
`;

export const LogoWrapper = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 16px;
  text-decoration: none;
  flex-shrink: 0;
`;

export const Logo = styled.img`
  object-fit: contain;
  pointer-events: none;
  user-select: none;
`;
