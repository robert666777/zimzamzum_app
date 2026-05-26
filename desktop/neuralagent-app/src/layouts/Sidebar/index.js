import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setLoadingDialog } from '../../store';
import constants from '../../utils/constants';
import axios from '../../utils/axios';
import {
  SidebarContainer,
  LogoWrapper,
} from './SidebarElements';
import {
  SidebarNavSections,
  SidebarUserProfile,
  NewTaskButton,
  PlusInCircle,
} from '../../components/SidebarMenu/SidebarMenu';
import { setThreads } from '../../store';
import styled from 'styled-components';
import { MdAdd } from 'react-icons/md';
import { useI18n } from '../../i18n/I18nContext';

const LogoText = styled.span`
  font-size: 22px;
  font-weight: 700;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #ffffff;
  letter-spacing: 0.12em;
`;

const ScrollableContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.28);
    }
  }
`;

export default function Sidebar() {
  const { t } = useI18n();
  const accessToken = useSelector((state) => state.accessToken);

  const navigate = useNavigate();

  const dispatch = useDispatch();

  const getThreads = useCallback(() => {
    dispatch(setLoadingDialog(true));
    axios
      .get('/threads', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      })
      .then((response) => {
        const threadsData = response.data;
        dispatch(setThreads(threadsData));
        dispatch(setLoadingDialog(false));
      })
      .catch((error) => {
        dispatch(setLoadingDialog(false));
        if (error.response?.status === constants.status.UNAUTHORIZED) {
          window.location.reload();
        }
      });
  }, [accessToken, dispatch]);

  useEffect(() => {
    getThreads();
  }, [getThreads]);

  return (
    <SidebarContainer>
      <LogoWrapper to="/">
        <LogoText>zimzamzum</LogoText>
      </LogoWrapper>

      <NewTaskButton type="button" onClick={() => navigate('/')}>
        <PlusInCircle>
          <MdAdd size={16} />
        </PlusInCircle>
        {t('sidebar.newTask')}
      </NewTaskButton>

      <ScrollableContent>
        <SidebarNavSections />
      </ScrollableContent>

      <SidebarUserProfile />
    </SidebarContainer>
  );
}
