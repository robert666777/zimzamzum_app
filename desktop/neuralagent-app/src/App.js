import React, { useState, useEffect } from 'react';
import './App.css';
import {
  HashRouter as Router, // BrowserRouter
  Routes,
  Route
} from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux';
import LoadingDialog from './components/LoadingDialog';
import FullLoading from './components/FullLoading';
import constants from './utils/constants';
import MessageBar from './components/Elements/MessageBar';
import UpgradePrompt from './components/Elements/UpgradePrompt';
import { setAppLoading, setUser, setAccessToken, setLoadingDialog, setSuccess, setUpgradePrompt } from './store';
import RedirectTo from './components/RedirectTo';
import axios from './utils/axios';
import { logoutUser, refreshToken } from './utils/helpers';
import { AppMainContainer, OverlayContainer } from './layouts/Containers';
import Sidebar from './layouts/Sidebar';
import { useLocation, useNavigate } from 'react-router-dom';

import Login from './views/Login';
import SignUp from './views/SignUp';
import Home from './views/Home';
import Thread from './views/Thread';
import Overlay from './views/Overlay';
import BackgroundAuth from './views/BackgroundAuth';
import BackgroundTask from './views/BackgroundTask';
import BackgroundSetup from './views/BackgroundSetup';
import Automations from './views/Automations';
import AutomationsNew from './views/AutomationsNew';
import HelpPage from './views/HelpPage';
import Upgrade from './views/Upgrade';
import Referrals from './views/Referrals';
import Schedule from './views/Schedule';
import Admin from './views/Admin';
import { I18nProvider } from './i18n/I18nContext';

const handleScheduledTask = async (taskData) => {
  if (!window.electronAPI) return;
  
  const { task, background_mode, extended_thinking_mode } = taskData;
  
  if (!task || task.length === 0) return;
  
  const accessToken = window.localStorage.getItem('access_token');
  if (!accessToken) {
    console.error('[Scheduler] No access token found');
    return;
  }
  
  console.log('[Scheduler] Executing task:', task.substring(0, 50) + '...');
  
  const data = {
    task: task,
    background_mode: background_mode || false,
    extended_thinking_mode: extended_thinking_mode || false,
  };
  
  axios
    .post('/threads', data, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
    .then(async (response) => {
      console.log('[Scheduler] Task executed successfully');
      if (response.data.type === 'desktop_task') {
        window.electronAPI.launchAIAgent(
          process.env.REACT_APP_PROTOCOL + '://' + process.env.REACT_APP_DNS,
          response.data.thread_id,
          background_mode || response.data.is_background_mode_requested
        );
      }
      window.location.href = '/';
    })
    .catch((error) => {
      console.error('[Scheduler] Failed to execute scheduled task:', error.response?.data || error.message);
    });
};

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOverlayRoute = location.pathname === '/overlay';
  const isBackgroundModeRoutes = location.pathname === '/background-auth' || location.pathname === '/background-task' || location.pathname === '/background-setup';

  const accessToken = useSelector(state => state.accessToken);
  const isError = useSelector(state => state.isError);
  const errorMessage = useSelector(state => state.errorMessage);
  const isSuccess = useSelector(state => state.isSuccess);
  const successMsg = useSelector(state => state.successMsg);
  const showUpgradePrompt = useSelector(state => state.showUpgradePrompt);
  const dispatch = useDispatch();

  useEffect(() => {
    if (window.electronAPI?.onNavigateToThread) {
      window.electronAPI.onNavigateToThread((threadId) => {
        navigate(`/threads/${threadId}`);
      });
    }
  }, [navigate]);

  return (
    <>
      {isError && <MessageBar message={errorMessage} backgroundColor='var(--danger-color)' />}
      {isSuccess && <MessageBar message={successMsg} backgroundColor='var(--success-color)' />}
      {!isOverlayRoute && !isBackgroundModeRoutes && showUpgradePrompt && (
        <UpgradePrompt show={showUpgradePrompt} onClose={() => dispatch(setUpgradePrompt(false))} />
      )}

      {location.pathname === '/admin' ? (
        <AppMainContainer>
          <Routes>
            <Route path='/admin' element={<Admin />} />
          </Routes>
        </AppMainContainer>
      ) : (
        accessToken !== null ? (
          isOverlayRoute || isBackgroundModeRoutes ? (
            isOverlayRoute ? (
              <OverlayContainer>
                <Routes>
                  <Route path="/overlay" element={<Overlay />} />
                </Routes>
              </OverlayContainer>
            ) : (
              <Routes>
                <Route path="/background-auth" element={<BackgroundAuth />} />
                <Route path="/background-task" element={<BackgroundTask />} />
                <Route path="/background-setup" element={<BackgroundSetup />} />
              </Routes>
            )
          ) : (
            <AppMainContainer>
              <Sidebar />
              <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/threads/:tid' element={<Thread />} />
                <Route path='/automations' element={<Automations />} />
                <Route path='/automations-page' element={<AutomationsNew />} />
                <Route path='/help/:topic' element={<HelpPage />} />
                <Route path='/upgrade' element={<Upgrade />} />
                <Route path='/referrals' element={<Referrals />} />
                <Route path='/schedule' element={<Schedule />} />
                <Route path="*" element={<RedirectTo linkType="router" to="/" redirectType="replace" />} />
              </Routes>
            </AppMainContainer>
          )
        ) : (
          <Routes>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<SignUp />} />
            <Route path="*" element={<RedirectTo linkType="router" to="/login" redirectType="replace" />} />
          </Routes>
        )
      )}
    </>
  );
}


function App() {

  const isAppLoading = useSelector(state => state.isAppLoading);
  const isFullLoading = useSelector(state => state.isFullLoading);
  const isLoadingDialog = useSelector(state => state.isLoadingDialog);

  const dispatch = useDispatch();
  const [_windowDims, setWindowDims] = useState();

  const [isMobileBarOpen, setMobileBarOpen] = useState(false);

  const handleResize = () => {
    setWindowDims({
      height: window.innerHeight,
      width: window.innerWidth
    });
  }

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const asyncTask = async () => {
      if (!window.electronAPI) {
        dispatch(setAppLoading(false));
        return;
      }
      const storedAccessToken = await window.electronAPI.getToken();
      console.log(storedAccessToken);
      if (storedAccessToken !== undefined && storedAccessToken !== null) {
        dispatch(setAccessToken(storedAccessToken));
        getUserInfo(storedAccessToken);
      } else {
        dispatch(setAppLoading(false));
      }
    }
    asyncTask();
  }, []);

  // Removed signup success toast to avoid confusion with free trial messaging

  const getUserInfo = (accessToken) => {
    dispatch(setAppLoading(true));
    axios.get('/auth/user_info', {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
      }
    }).then((response) => {
      dispatch(setUser(response.data));
      dispatch(setAppLoading(false));
    }).catch((error) => {
      if (error.response?.status === constants.status.UNAUTHORIZED) {
        refreshToken();
      } else {
        dispatch(setAppLoading(false));
      }
    });
  };

  useEffect(() => {
    if (window.electronAPI?.onLogout) {
      window.electronAPI.onLogout(async () => {
        const token = await window.electronAPI.getToken();
        logoutUser(token, dispatch);
      });
    }
  }, []);

  const cancelAllRunningTasks = async () => {
    if (!window.electronAPI) return;
    const token = await window.electronAPI.getToken();
    if (token === null) {
      return;
    }
    dispatch(setLoadingDialog(true));
    try {
      await axios.post(`/threads/cancel_all_running_tasks`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      window.electronAPI.stopAIAgent();
    } catch (error) {
    } finally {
      dispatch(setLoadingDialog(false));
    }
  };

  useEffect(() => {
    if (window.electronAPI?.onCancelAllTasksTrigger) {
      window.electronAPI.onCancelAllTasksTrigger(async () => {
        await cancelAllRunningTasks();
        window.electronAPI.cancelAllTasksDone();
      });
    }
  }, []);

  useEffect(() => {
    const handleScheduledTaskReady = (taskData) => {
      console.log('[Scheduler] Received task ready from main process:', taskData);
      localStorage.setItem('scheduled-task-content', taskData.task);
      window.location.href = '/';
    };
    
    console.log('[Scheduler] Setting up IPC listener');
    if (window.electronAPI?.onScheduledTaskReady) {
      console.log('[Scheduler] Adding onScheduledTaskReady listener');
      window.electronAPI.onScheduledTaskReady(handleScheduledTaskReady);
    } else {
      console.log('[Scheduler] electronAPI not available, checking localStorage');
      
      const checkPendingTask = () => {
        try {
          const pendingTaskStr = localStorage.getItem('pending-scheduled-task');
          if (pendingTaskStr) {
            const pendingTask = JSON.parse(pendingTaskStr);
            console.log('[Scheduler] Found pending task from localStorage:', pendingTask);
            localStorage.setItem('scheduled-task-content', pendingTask.task);
            localStorage.removeItem('pending-scheduled-task');
            window.location.href = '/';
          }
        } catch (error) {
          console.error('[Scheduler] Error checking pending task:', error);
          localStorage.removeItem('pending-scheduled-task');
        }
      };
      
      checkPendingTask();
      const interval = setInterval(checkPendingTask, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <>
      {
        isFullLoading ? <FullLoading /> : <></>
      }
      {
        isLoadingDialog ? <LoadingDialog /> : <></>
      }
      {
        isAppLoading ? <FullLoading /> :
        <Router>
          <I18nProvider>
            <AppRoutes />
          </I18nProvider>
        </Router>
      }
    </>
  );
}


export default App;