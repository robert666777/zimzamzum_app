import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  MdEdit,
  MdAdd,
  MdSave,
  MdClose,
  MdLanguage,
  MdSearch,
  MdDelete,
} from 'react-icons/md';
import { Text } from '../components/Elements/Typography';
import { Button } from '../components/Elements/Button';
import NATextField from '../components/Elements/TextFields';
import axios from '../utils/axios';
import { useSelector } from 'react-redux';
import { EDUCATION_PLATFORM_ICON_URL as PLATFORM_ICON_URL } from '../utils/educationPlatformIcons';
import { useI18n } from '../i18n/I18nContext';
import { getUserStorageKey, STORAGE_KEYS } from '../utils/userStorage';

const DEFAULT_ORDER = ['chaoxing', 'zhihuishu', 'yuketang', 'icourse', 'xuetangx'];

const AutomationsContainer = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 24px;
  background: #1a1a1a;
  color: white;
`;

const Header = styled.div`
  margin-bottom: 18px;
`;

const Title = styled(Text)`
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const Description = styled(Text)`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.5;
  max-width: 720px;
`;

const PlatformsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
`;

const PlatformCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 12px 12px 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
  }
`;

const PlatformHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
`;

const PlatformInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const LogoWrap = styled.div`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const LogoImg = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
`;

const LogoFallback = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
  font-weight: 700;
`;

const PlatformName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DetailsBlock = styled.div`
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const FieldLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.45);
`;

const FieldValue = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
  line-height: 1.35;
`;

const UrlLink = styled.a`
  color: #3b82f6;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

function PlatformLogo({ platform }) {
  const [broken, setBroken] = useState(false);
  const url = platform.logoImageUrl;
  
  const handleError = () => {
    setBroken(true);
  };

  return (
    <LogoWrap>
      {url && !broken ? (
        <LogoImg src={url} alt="" onError={handleError} />
      ) : (
        <LogoFallback>
          {platform.logoLetter || (platform.name ? platform.name.charAt(0).toUpperCase() : 'C')}
        </LogoFallback>
      )}
    </LogoWrap>
  );
}

const EditButton = styled(Button)`
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }
`;

const DeleteButton = styled(Button)`
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  flex-shrink: 0;
  margin-top: 4px;

  &:hover {
    background: rgba(239, 68, 68, 0.3);
  }
`;

const ButtonsWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 20px;
  max-width: 420px;

  svg {
    color: rgba(255, 255, 255, 0.45);
    font-size: 18px;
  }

  input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 14px;

    &::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const SectionLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
`;

const AddPlatformButton = styled(Button)`
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 8px;
  background: var(--accent-blue);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: var(--accent-blue-hover);
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(33, 53, 173, 0.45);
    opacity: 1;
  }
`;

const Modal = styled.div`
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
`;

const ModalContent = styled.div`
  background: #1a1a2e;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
`;

const ModalTitle = styled(Text)`
  font-size: 18px;
  font-weight: 600;
  color: #fff;
`;

const CloseButton = styled(Button)`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  padding: 0;

  &:hover {
    color: #fff;
  }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FormLabel = styled(Text)`
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
`;

const SaveButton = styled(Button)`
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 8px;
  background: var(--accent-blue);
  color: white;
  border: none;
  margin-top: 8px;

  &:hover {
    background: var(--accent-blue-hover);
    box-shadow: 0 8px 22px rgba(33, 53, 173, 0.45);
    opacity: 1;
  }
`;

function normalizePlatform(raw) {
  const loginUrl = raw.login_url || raw.loginUrl || '';
  const id = raw.id;
  const logoHint = raw.logo;
  const iconFromLogo =
    typeof logoHint === 'string' && /^https?:\/\//i.test(logoHint) ? logoHint : null;

  return {
    id,
    name: raw.name || '',
    loginUrl,
    username: raw.username ?? null,
    password: raw.password ?? null,
    logoImageUrl: PLATFORM_ICON_URL[id] || iconFromLogo || null,
    logoLetter:
      (typeof logoHint === 'string' && logoHint.length <= 2 && !iconFromLogo
        ? logoHint
        : null) || (raw.name && raw.name.charAt(0).toUpperCase()) || '?',
  };
}

function mergePlatformsList(rows) {
  const merged = {};
  for (const raw of rows) {
    const n = normalizePlatform(raw);
    merged[n.id] = { ...(merged[n.id] || {}), ...n };
  }
  const result = Object.values(merged);
  result.sort((a, b) => {
    const ia = DEFAULT_ORDER.indexOf(a.id);
    const ib = DEFAULT_ORDER.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

const defaultPlatformsSeed = mergePlatformsList([
  {
    id: 'chaoxing',
    name: 'Chaoxing / 学习通',
    login_url: 'https://passport2.chaoxing.com/login',
  },
  {
    id: 'zhihuishu',
    name: 'Zhihuishu / 智慧树',
    login_url: 'https://passport.zhihuishu.com/login',
  },
  {
    id: 'yuketang',
    name: 'Yuketang / 雨课堂',
    login_url: 'https://www.yuketang.cn/web',
  },
  {
    id: 'icourse',
    name: 'iCourse / 中国大学MOOC',
    login_url: 'https://www.icourse163.org/',
  },
  {
    id: 'xuetangx',
    name: 'XuetangX / 学堂在线',
    login_url: 'https://www.xuetangx.com/',
  },
]);

export default function Automations() {
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState(defaultPlatformsSeed);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    loginUrl: '',
    username: '',
    password: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  const accessToken = useSelector((state) => state.accessToken);
  const user = useSelector((state) => state.user);

  const filteredPlatforms = platforms.filter((platform) =>
    platform.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadPlatforms();
  }, [user?.id]);

  const loadPlatforms = async () => {
    const PLATFORMS_STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.PLATFORMS, user);
    const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && data.length > 0) {
          // Check if Yuketang is missing and add it
          const hasYuketang = data.some(p => p.id === 'yuketang');
          if (!hasYuketang) {
            const yuketang = { id: 'yuketang', name: 'Yuketang / 雨课堂', login_url: 'https://www.yuketang.cn/web' };
            // Insert at position 2 (after chaoxing and zhihuishu)
            const updated = [...data.slice(0, 2), yuketang, ...data.slice(2)];
            setPlatforms(mergePlatformsList(updated));
            localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(updated));
          } else {
            setPlatforms(mergePlatformsList(data));
          }
          return;
        }
      } catch (e) {
        console.error('Failed to load platforms from localStorage:', e);
      }
    }
    
    if (!accessToken) return;
    
    try {
      const response = await axios.get('/automations/platforms', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      });
      if (response.data && response.data.length > 0) {
        const merged = mergePlatformsList(response.data);
        setPlatforms(merged);
        localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(response.data));
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to load platforms from API:', error);
      }
    }
  };

  const savePlatform = async (platformData) => {
    const payload = {
      name: platformData.name,
      login_url: platformData.login_url,
      username: platformData.username,
      password: platformData.password,
    };

    try {
      if (editingPlatform) {
        await axios.put(`/automations/platforms/${editingPlatform.id}`, payload, {
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
        });
      } else {
        await axios.post('/automations/platforms', payload, {
          headers: {
            Authorization: 'Bearer ' + accessToken,
          },
        });
      }
      await loadPlatforms();
    } catch (error) {
      console.error('Failed to save platform:', error);
      let updatedPlatforms;
      if (editingPlatform) {
        updatedPlatforms = platforms.map((p) =>
          p.id === editingPlatform.id
            ? {
                ...p,
                ...normalizePlatform({
                  id: editingPlatform.id,
                  name: payload.name || editingPlatform.name,
                  login_url: payload.login_url,
                  username: payload.username,
                  password: payload.password,
                }),
              }
            : p
        );
      } else {
        const id = platformData.name.toLowerCase().replace(/\s+/g, '-');
        updatedPlatforms = [
          ...platforms,
          normalizePlatform({
            id,
            name: platformData.name,
            login_url: platformData.login_url,
            username: platformData.username,
            password: platformData.password,
          }),
        ];
      }
      setPlatforms(updatedPlatforms);
      const rawPlatforms = updatedPlatforms.map(p => ({
        id: p.id,
        name: p.name,
        login_url: p.loginUrl,
        username: p.username,
        password: p.password,
      }));
      const PLATFORMS_STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.PLATFORMS, user);
      localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(rawPlatforms));
    }
  };

  const handleEdit = (platform) => {
    setEditingPlatform(platform);
    setFormData({
      name: platform.name,
      loginUrl: platform.loginUrl,
      username: platform.username || '',
      password: platform.password || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (platform) => {
    if (!window.confirm(t('credentials.confirmDelete', { name: platform.name }))) {
      return;
    }

    const updatedPlatforms = platforms.filter((p) => p.id !== platform.id);
    setPlatforms(updatedPlatforms);
    const PLATFORMS_STORAGE_KEY = getUserStorageKey(STORAGE_KEYS.PLATFORMS, user);
    localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(updatedPlatforms));

    if (accessToken) {
      try {
        await axios.delete(`/automations/platforms/${platform.id}`, {
          headers: { Authorization: 'Bearer ' + accessToken },
        });
      } catch (error) {
        console.error('Failed to delete platform:', error);
      }
    }
  };

  const handleAdd = () => {
    setEditingPlatform(null);
    setFormData({
      name: '',
      loginUrl: '',
      username: '',
      password: '',
    });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    await savePlatform({
      name: formData.name,
      login_url: formData.loginUrl,
      username: formData.username,
      password: formData.password,
    });

    setShowAddModal(false);
    setEditingPlatform(null);
    setFormData({ name: '', loginUrl: '', username: '', password: '' });
  };

  const handleClose = () => {
    setShowAddModal(false);
    setEditingPlatform(null);
    setFormData({ name: '', loginUrl: '', username: '', password: '' });
  };

  return (
    <AutomationsContainer>
      <Header>
        <Title>{t('credentials.title')}</Title>
        <Description>{t('credentials.description')}</Description>
      </Header>

      <SearchBar>
        <MdSearch />
        <input
          type="text"
          placeholder={t('credentials.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchBar>

      <SectionHeader>
        <SectionLabel>{t('credentials.yourPlatforms')}</SectionLabel>
        <AddPlatformButton type="button" onClick={handleAdd}>
          <MdAdd size={14} />
          {t('credentials.addPlatform')}
        </AddPlatformButton>
      </SectionHeader>

      <PlatformsGrid>
        {filteredPlatforms.map((platform) => {
          return (
            <PlatformCard key={platform.id}>
              <PlatformHeader>
                <PlatformInfo>
                  <PlatformLogo platform={platform} />
                  <PlatformName title={platform.name}>{platform.name}</PlatformName>
                </PlatformInfo>
                <ButtonsWrap>
                  <EditButton type="button" onClick={() => handleEdit(platform)}>
                    <MdEdit />
                  </EditButton>
                  <DeleteButton type="button" onClick={() => handleDelete(platform)}>
                    <MdDelete />
                  </DeleteButton>
                </ButtonsWrap>
              </PlatformHeader>

              <DetailsBlock>
                <FieldBlock>
                  <FieldLabel>{t('credentials.loginUrl')}</FieldLabel>
                  <FieldValue>
                    <UrlLink
                      href={platform.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {platform.loginUrl || '—'}
                    </UrlLink>
                  </FieldValue>
                </FieldBlock>
                <FieldBlock>
                  <FieldLabel>{t('credentials.username')}</FieldLabel>
                  <FieldValue>
                    {platform.username ? platform.username : 'Not set'}
                  </FieldValue>
                </FieldBlock>
                <FieldBlock>
                  <FieldLabel>{t('credentials.password')}</FieldLabel>
                  <FieldValue>
                    {platform.password ? platform.password : 'Not set'}
                  </FieldValue>
                </FieldBlock>
              </DetailsBlock>
            </PlatformCard>
          );
        })}
      </PlatformsGrid>

      {showAddModal && (
        <Modal>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>
                {editingPlatform ? 'Edit platform' : 'Add platform'}
              </ModalTitle>
              <CloseButton type="button" onClick={handleClose}>
                <MdClose />
              </CloseButton>
            </ModalHeader>

            <Form>
              <FormField>
                <FormLabel>{t('credentials.platformName')}</FormLabel>
                <NATextField
                  background="transparent"
                  isDarkMode
                  padding="10px"
                  placeholder={t('credentials.platformNamePlaceholder')}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!!editingPlatform}
                />
              </FormField>

              <FormField>
                <FormLabel>{t('credentials.loginUrl')}</FormLabel>
                <NATextField
                  background="transparent"
                  isDarkMode
                  padding="10px"
                  placeholder="https://…"
                  value={formData.loginUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, loginUrl: e.target.value })
                  }
                />
              </FormField>

              <FormField>
                <FormLabel>{t('credentials.username')}</FormLabel>
                <NATextField
                  background="transparent"
                  isDarkMode
                  padding="10px"
                  placeholder={t('credentials.usernamePlaceholder')}
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
              </FormField>

              <FormField>
                <FormLabel>{t('credentials.password')}</FormLabel>
                <NATextField
                  background="transparent"
                  isDarkMode
                  padding="10px"
                  type="text"
                  placeholder={t('credentials.passwordPlaceholder')}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </FormField>

              <SaveButton type="button" onClick={handleSave}>
                <MdSave style={{ marginRight: 8 }} />
                {t('credentials.savePlatform')}
              </SaveButton>
            </Form>
          </ModalContent>
        </Modal>
      )}
    </AutomationsContainer>
  );
}
