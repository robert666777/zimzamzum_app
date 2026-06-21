import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  MdPlayArrow,
  MdEdit,
  MdInfo,
  MdAdd,
  MdClose,
  MdSearch,
  MdDelete,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import {
  EDUCATION_PLATFORM_ICON_URL,
  PLATFORM_LOGO_FALLBACK_URLS,
  resolvePlatformLogoUrl,
} from '../utils/educationPlatformIcons';
import { useI18n } from '../i18n/I18nContext';
import { getUserStorageKey } from '../utils/userStorage';

const HelpLink = styled(Link)`
  color: #60a5fa;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const HelpButton = styled.button`
  background: transparent;
  border: none;
  color: #60a5fa;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const defaultAutomations = [
  {
    id: 'deadline-tracker',
    name: 'Deadline Tracker',
    description: 'Every day, log into the student\'s academic platform, scan all courses, and list every upcoming deadline.',
    platform: 'chaoxing',
    requirements: 'User must fill in:\n\n- Course name: [course for this automation]',
    taskDescription: `You are a Deadline Tracker. Every day, log into the student's academic platform, scan all courses, and list every upcoming deadline.\n\nExtract: assignment name, course, due datetime, weight (%), current status (not started / in progress / submitted), and hours remaining.\n\nPrioritize:\n- Critical: < 24h\n- Urgent: 24–72h\n- Upcoming: 3–7 days\n\nGenerate a clean report:\n- Group by priority\n- Show exact time left\n- Suggest the next single action for each item\n- Flag dependencies\n- List completed since last report\n- Add workload estimate and smart scheduling tip\n\nOnce done, open WeChat and send the full report to the student's account. If unable to open WeChat or send the message, open Notepad, copy the report into it, and leave it open.`,
  },
  {
    id: 'auto-assignment-completer',
    name: 'Auto-Assignment Completer',
    description: 'Automatically detects and completes Q&A assignments on academic platforms.',
    platform: 'icourse',
    requirements: 'REQUIREMENTS — User must fill in:\n\n- Course name: [course for this automation]',
    taskDescription: `You are an Auto-Assignment Completer. Trigger: new assignment detected on academic platform.\n\nSTEP 1 — DETECT & VALIDATE\nLog into the academic platform. Check if assignment type is Q&A or Q&A with sub-questions only. If essay, report, or creative task → STOP and notify.\n\nSTEP 2 — ANALYZE\nParse the assignment:\n- List every question and sub-question\n- Identify answer format required\n- Note constraints: word limit, sources, examples\n\nSTEP 3 — ANSWER\nGenerate answers:\n- Direct and accurate\n- Match required depth and format\n- Cite sources when specified\n- For calculations: show step-by-step work\n\nSTEP 4 — REVIEW\nSelf-check:\n- Did I answer every sub-question?\n- Is format correct?\n- Any plagiarism risk? → Rewrite if needed\n\nSTEP 5 — SUBMIT\nPaste answers into correct fields, attach files if required, submit.\nConfirm with submission receipt.\n\nSTEP 6 — REPORT\nOnce finished, check if WeChat is open. If yes, send a brief report: "Assignment [Title] from [Course] completed and submitted. [X] questions answered. Due: [Date]." If WeChat is not available, open the Notes app, copy the report into it, and leave it open.`,
  },
  {
    id: 'handwritten-assignment-submitter',
    name: 'Handwritten Assignment Submitter',
    description: 'Handles assignments requiring handwritten answers and photo upload.',
    platform: 'xuetangx',
    requirements: 'REQUIREMENTS — User must fill in:\n\n- Course name: [course for this automation]\n\n- First Name: [your first name]\n\n- Last Name: [your last name]\n\n- Student ID: [your student ID]\n\n- Major Name: [your major]',
    taskDescription: `You are a Handwritten Assignment Submitter. Trigger: assignment requires handwritten answers on paper, photo upload.\n\nSTEP 1 — DETECT & VALIDATE\nLog into the academic platform. Confirm assignment requires handwritten submission (photo upload). If not → STOP.\n\nSTEP 2 — ANALYZE\nParse the assignment:\n- List every question and sub-question\n- Identify required answer format and constraints\n- Note due date and file requirements\n\nSTEP 3 — GENERATE CONTENT\nFormat the answer exactly as:\n[First Name] [Last Name]\n[Student ID]\n[Major Name]\n\n[Answer text: complete responses to all questions and sub-questions]\n\nSTEP 4 — CREATE HANDWRITING\nOpen new tab and type https://www.handwriteai.co.in/ in the search bar\nPaste the formatted content into the input field\nGenerate handwritten output\nDownload the PDF\n\nSTEP 5 — SUBMIT\nGo back to the academic platform tab\nUpload the PDF into the answer box\nSubmit\nConfirm with submission receipt\n\nSTEP 6 — REPORT\nOnce finished, check if WeChat is open. If yes, send brief report: "Handwritten assignment [Title] from [Course] completed and submitted. [X] questions answered. Due: [Date]." If WeChat is not available, open the Notes app, copy the report into it, and leave it open.`,
  },
  {
    id: 'deadline-tracker-zh',
    name: '截止日期追踪器',
    description: '每天登录学生的学术平台，扫描所有课程，并列出所有即将到期的截止日期。',
    platform: 'chaoxing',
    requirements: '用户必须填写：\n\n- 课程名称：[此自动化对应的课程]',
    taskDescription: `你是一个截止日期追踪器。每天登录学生的学术平台，扫描所有课程，并列出所有即将到期的截止日期。\n\n提取：作业名称、课程、截止日期时间、权重（%）、当前状态（未开始 / 进行中 / 已提交）以及剩余小时数。\n\n优先级：\n- 紧急：< 24 小时\n- 较急：24–72 小时\n- 即将到期：3–7 天\n\n生成清晰的报告：\n- 按优先级分组\n- 显示确切的剩余时间\n- 为每项建议下一步行动\n- 标记依赖关系\n- 列出自上次报告以来已完成的作业\n- 添加工作量估算和智能排程建议\n\n完成后，打开微信并将完整报告发送给学生的账号。如果无法打开微信或发送消息，则打开记事本，将报告复制进去并保持打开状态。`,
  },
  {
    id: 'auto-assignment-completer-zh',
    name: '自动作业完成器',
    description: '自动检测并完成学术平台上的问答类作业。',
    platform: 'icourse',
    requirements: '要求 — 用户必须填写：\n\n- 课程名称：[此自动化对应的课程]',
    taskDescription: `你是一个自动作业完成器。触发条件：在学术平台上检测到新作业。\n\n步骤 1 — 检测与验证\n登录学术平台。检查作业类型是否为问答或带子问题的问答。如果是论文、报告或创意任务 → 停止并通知。\n\n步骤 2 — 分析\n解析作业：\n- 列出每个问题和子问题\n- 确定所需的答案格式\n- 注意限制：字数、来源、示例\n\n步骤 3 — 作答\n生成答案：\n- 直接且准确\n- 符合要求的深度和格式\n- 指定时引用来源\n- 计算题：展示逐步解题过程\n\n步骤 4 — 审核\n自我检查：\n- 是否回答了每个子问题？\n- 格式是否正确？\n- 是否有抄袭风险？→ 如有则重写\n\n步骤 5 — 提交\n将答案粘贴到正确的字段，如有需要则附加文件，然后提交。\n用提交回执确认。\n\n步骤 6 — 报告\n完成后，检查微信是否打开。如果是，发送简要报告："作业 [标题] 来自 [课程] 已完成并提交。[X] 个问题已回答。截止：[日期]。" 如果微信不可用，打开备忘录应用，将报告复制进去并保持打开状态。`,
  },
  {
    id: 'handwritten-assignment-submitter-zh',
    name: '手写作业提交器',
    description: '处理需要手写答案和照片上传的作业。',
    platform: 'xuetangx',
    requirements: '要求 — 用户必须填写：\n\n- 课程名称：[此自动化对应的课程]\n\n- 名：[您的名]\n\n- 姓：[您的姓]\n\n- 学号：[您的学号]\n\n- 专业名称：[您的专业]',
    taskDescription: `你是一个手写作业提交器。触发条件：作业要求在纸上手写答案并上传照片。\n\n步骤 1 — 检测与验证\n登录学术平台。确认作业需要手写提交（照片上传）。如果不是 → 停止。\n\n步骤 2 — 分析\n解析作业：\n- 列出每个问题和子问题\n- 确定所需的答案格式和限制\n- 注意截止日期和文件要求\n\n步骤 3 — 生成内容\n将答案格式化为：\n[名] [姓]\n[学号]\n[专业名称]\n\n[答案文本：对所有问题和子问题的完整回答]\n\n步骤 4 — 创建手写体\n打开新标签页，在搜索栏输入 https://www.handwriteai.co.in/\n将格式化的内容粘贴到输入框\n生成手写输出\n下载 PDF\n\n步骤 5 — 提交\n返回学术平台标签页\n将 PDF 上传到答案框\n提交\n用提交回执确认\n\n步骤 6 — 报告\n完成后，检查微信是否打开。如果是，发送简要报告："手写作业 [标题] 来自 [课程] 已完成并提交。[X] 个问题已回答。截止：[日期]。" 如果微信不可用，打开备忘录应用，将报告复制进去并保持打开状态。`,
  },
];

function mergeWithDefaultAutomations(stored) {
  const list = Array.isArray(stored) ? [...stored] : [];
  const ids = new Set(list.map((a) => a.id));
  for (const def of defaultAutomations) {
    if (!ids.has(def.id)) {
      list.push(def);
    }
  }
  return list;
}

function newId() {
  return crypto.randomUUID?.() ?? `auto_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const Page = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 28px;
  overflow: hidden;
  background: #1a1a1a;
  color: #fff;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
`;

const Header = styled.div`
  margin-bottom: 22px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: #fff;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.55;
  margin: 0;
  max-width: 720px;
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
    font-family: inherit;

    &::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const SectionLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: var(--accent-blue);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--accent-blue-hover);
  }

  svg {
    font-size: 14px;
  }
`;

const AutomationsGrid = styled.div`
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
`;

const AutomationCard = styled.article`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px;
  transition: border-color 0.2s ease;
  display: flex;
  flex-direction: column;
  max-height: 180px;

  &:hover {
    border-color: rgba(255, 255, 255, 0.14);
  }
`;

const CardTitle = styled.h3`
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #fff;
`;

const CardDescription = styled.p`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.4;
  margin: 0 0 10px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

const CardDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 4px;
  margin-top: auto;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: none;
  background: var(--accent-blue);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--accent-blue-hover);
  }

  svg {
    font-size: 13px;
  }
`;

const DeleteActionButton = styled(ActionButton)`
  background: #dc2626;

  &:hover {
    background: #b91c1c;
  }
`;

const DetailBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);

  svg {
    font-size: 12px;
    opacity: 0.6;
  }
`;

const PlatformLogo = styled.img`
  width: 16px;
  height: 16px;
  border-radius: 3px;
  object-fit: contain;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 24px;
`;

const Modal = styled.div`
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: #23232f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 22px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #fff;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px;
  display: flex;

  &:hover {
    color: #fff;
  }

  svg {
    font-size: 20px;
  }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  outline: none;

  &:focus {
    border-color: rgba(37, 99, 235, 0.55);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.28);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 100px;
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  resize: vertical;
  outline: none;

  &:focus {
    border-color: rgba(37, 99, 235, 0.55);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.28);
  }
`;

const PlatformGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const PlatformDetailsBlock = styled.div`
  margin-top: 10px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
`;

const PlatformDetailRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  &:last-child { margin-bottom: 0; }
`;

const PlatformDetailLabel = styled.span`
  color: rgba(255, 255, 255, 0.5);
  min-width: 80px;
`;

const PlatformDetailValue = styled.span`
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
`;

const PlatformTile = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.2);
  border: 2px solid
    ${(p) => (p.$selected ? 'rgba(37, 99, 235, 0.85)' : 'rgba(255, 255, 255, 0.1)')};
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  ${(p) =>
    p.$selected &&
    `
    background: rgba(37, 99, 235, 0.15);
  `}
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const CancelButton = styled.button`
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.75);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: var(--accent-blue);
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--accent-blue-hover);
  }
`;

const DeleteButton = styled.button`
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: #dc2626;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: #b91c1c;
  }
`;

const PlatformLogoWithFallback = ({ platformId, platformName, logoHint }) => {
  const [failIndex, setFailIndex] = useState(0);
  const primary = resolvePlatformLogoUrl(platformId, logoHint);
  const candidates = [primary, ...(PLATFORM_LOGO_FALLBACK_URLS[platformId] || [])].filter(Boolean);

  if (failIndex >= candidates.length || candidates.length === 0) {
    const letter = String(platformName || platformId || '?')[0].toUpperCase();
    return (
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: '700',
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          flexShrink: '0',
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <PlatformLogo
      src={candidates[failIndex]}
      alt=""
      onError={() => setFailIndex((i) => i + 1)}
    />
  );
};

export default function AutomationsNew() {
  const { t } = useI18n();
  const accessToken = useSelector((s) => s.accessToken);
  const user = useSelector((s) => s.user);
  const navigate = useNavigate();
  const [automations, setAutomations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformOptions, setPlatformOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platformId, setPlatformId] = useState('');

  const [taskDescription, setTaskDescription] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const STORAGE_KEY = getUserStorageKey('neuralagent.automations.v1', user);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = mergeWithDefaultAutomations(parsed);
        setAutomations(merged);
        if (merged.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch {
        setAutomations(defaultAutomations);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAutomations));
      }
    } else {
      setAutomations(defaultAutomations);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAutomations));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const PLATFORMS_STORAGE_KEY = getUserStorageKey('neuralagent.platforms.v1', user);
    const saved = localStorage.getItem(PLATFORMS_STORAGE_KEY);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const list = (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          logoUrl: resolvePlatformLogoUrl(p.id, p.logo),
          loginUrl: p.login_url || p.loginUrl,
          username: p.username || null,
          password: p.password || null,
        }));
        setPlatformOptions(list.length > 0 ? list : defaultPlatforms);
        return;
      } catch (e) {
        console.error('Failed to load platforms from localStorage:', e);
      }
    }

    if (!accessToken) {
      setPlatformOptions(defaultPlatforms);
      return;
    }

    axios
      .get('/automations/platforms', {
        headers: { Authorization: 'Bearer ' + accessToken },
      })
      .then(({ data }) => {
        const list = (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          logoUrl: resolvePlatformLogoUrl(p.id, p.logo),
          loginUrl: p.login_url || p.loginUrl,
          username: p.username || null,
          password: p.password || null,
        }));
        setPlatformOptions(list.length > 0 ? list : defaultPlatforms);
      })
      .catch(() => {
        setPlatformOptions(defaultPlatforms);
      });
  }, [accessToken]);

  const defaultPlatforms = [
    { id: 'chaoxing', name: 'Chaoxing', logoUrl: EDUCATION_PLATFORM_ICON_URL.chaoxing },
    { id: 'zhihuishu', name: 'Zhihuishu', logoUrl: EDUCATION_PLATFORM_ICON_URL.zhihuishu },
    { id: 'yuketang', name: 'Yuketang / 雨课堂', logoUrl: EDUCATION_PLATFORM_ICON_URL.yuketang },
    { id: 'icourse', name: 'iCourse', logoUrl: EDUCATION_PLATFORM_ICON_URL.icourse },
    { id: 'xuetangx', name: 'XuetangX', logoUrl: EDUCATION_PLATFORM_ICON_URL.xuetangx },
  ];

  const saveAutomations = (updated) => {
    setAutomations(updated);
    if (user?.id) {
      const STORAGE_KEY = getUserStorageKey('neuralagent.automations.v1', user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPlatformId(platformOptions[0]?.id || 'chaoxing');
    setTaskDescription('');
    setModalOpen(true);
  };

  const handleOpenEdit = (auto) => {
    setEditingId(auto.id);
    setName(auto.name);
    setDescription(auto.description || '');
    setPlatformId(auto.platform);
    setTaskDescription(auto.taskDescription || '');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      window.alert('Please enter an automation name.');
      return;
    }

    const selectedPlatform = platformOptions.find(p => p.id === platformId);

    const payload = {
        id: editingId || newId(),
        name: name.trim(),
        description: description.trim(),
        platform: platformId,
        taskDescription: taskDescription.trim(),
        platformLoginUrl: selectedPlatform?.loginUrl || null,
        platformUsername: selectedPlatform?.username || null,
        platformPassword: selectedPlatform?.password || null,
      };

    if (editingId) {
      saveAutomations(automations.map((a) => (a.id === editingId ? payload : a)));
    } else {
      saveAutomations([...automations, payload]);
    }

    setModalOpen(false);
    setEditingId(null);
  };

  const handleRun = (auto) => {
    const platform = platformOptions.find(p => p.id === auto.platform) || {};
    const fullDetails = `Automation: ${auto.name}\nDescription: ${auto.description || 'None'}\nPlatform: ${platform.name || auto.platform}\nPlatform Details:\nLogin URL: ${auto.platformLoginUrl || platform.loginUrl || 'None'}\nUsername: ${auto.platformUsername || platform.username || 'None'}\nPassword: ${auto.platformPassword || platform.password || 'None'}\n\nTask:\n${auto.taskDescription || 'None'}`;
    navigate('/', { state: { automationText: fullDetails } });
  };

  const handleDetail = (auto) => {
    const platform = platformOptions.find(p => p.id === auto.platform) || {};
    const details = `Name: ${auto.name}

Description:
${auto.description || 'None'}

Platform: ${platform.name || auto.platform}

Platform Details:
Login URL: ${auto.platformLoginUrl || platform.loginUrl || 'None'}
Username: ${auto.platformUsername || platform.username || 'None'}
Password: ${auto.platformPassword || platform.password || 'None'}

Task Description:
${auto.taskDescription || 'None'}`;
    alert(details);
  };

  const handleDelete = (auto) => {
    if (window.confirm(`Delete automation "${auto.name}"?`)) {
      saveAutomations(automations.filter((a) => a.id !== auto.id));
    }
  };

  const filteredAutomations = automations.filter((auto) =>
    auto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auto.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Page>
      <Header>
        <TitleRow>
          <Title>{t('automations.title')}</Title>
        </TitleRow>
        <Description>
          {t('automations.description')} <HelpButton type="button" onClick={() => setHelpModalOpen(true)}>{t('auth.howToSetAutomation')}</HelpButton>
        </Description>
      </Header>

      <SearchBar>
        <MdSearch />
        <input
          type="text"
          placeholder={t('automations.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchBar>

      <SectionHeader>
        <SectionLabel>{t('automations.yourAutomations')}</SectionLabel>
        <AddButton type="button" onClick={handleOpenCreate}>
          <MdAdd size={14} />
          {t('automations.createAutomation')}
        </AddButton>
      </SectionHeader>

      <AutomationsGrid>
        {filteredAutomations.map((auto) => {
          const plat = platformOptions.find((p) => p.id === auto.platform) || {
            id: auto.platform,
            name: auto.platform,
          };

          return (
            <AutomationCard key={auto.id}>
              <CardTitle>{auto.name}</CardTitle>
              <CardDescription>{auto.description}</CardDescription>
              <CardDetails>
                <DetailBadge>
                  <PlatformLogoWithFallback
                    platformId={plat.id}
                    platformName={plat.name}
                    logoHint={plat.logoUrl}
                  />
                  {plat.name}
                </DetailBadge>

              </CardDetails>
              <ActionButtons>
                <ActionButton type="button" title="Run" onClick={() => handleRun(auto)}>
                  <MdPlayArrow />
                </ActionButton>
                <ActionButton type="button" title="Edit" onClick={() => handleOpenEdit(auto)}>
                  <MdEdit />
                </ActionButton>
                <ActionButton type="button" title="Details" onClick={() => handleDetail(auto)}>
                  <MdInfo />
                </ActionButton>
                <DeleteActionButton type="button" title="Delete" onClick={() => handleDelete(auto)}>
                  <MdDelete />
                </DeleteActionButton>
              </ActionButtons>
            </AutomationCard>
          );
        })}
      </AutomationsGrid>

      {modalOpen && (
        <Overlay onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <Modal onMouseDown={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{editingId ? t('automations.editAutomation') : t('automations.createAutomation')}</ModalTitle>
              <CloseButton type="button" onClick={() => setModalOpen(false)}>
                <MdClose />
              </CloseButton>
            </ModalHeader>

            <Form>
              <FormField>
                <Label>{t('automations.automationName')}</Label>
                <Input
                  placeholder={t('automations.automationNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>

              <FormField>
                <Label>{t('automations.automationDescription')}</Label>
                <Input
                  placeholder={t('automations.automationDescriptionPlaceholder')}
                  value={description}
                  maxLength={100}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>

              <FormField>
                <Label>{t('automations.taskDescription')}</Label>
                <TextArea
                  placeholder={t('automations.taskDescriptionPlaceholder')}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  style={{ minHeight: '100px' }}
                />
              </FormField>

              <FormField>
                <Label>{t('automations.platform')}</Label>
                <PlatformGrid>
                  {platformOptions.map((p) => (
                    <PlatformTile
                      key={p.id}
                      type="button"
                      $selected={platformId === p.id}
                      onClick={() => setPlatformId(p.id)}
                    >
                      <PlatformLogoWithFallback
                        platformId={p.id}
                        platformName={p.name}
                        logoHint={p.logoUrl}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                    </PlatformTile>
                  ))}
                </PlatformGrid>
                {(() => {
                  const selected = platformOptions.find(p => p.id === platformId);
                  if (!selected) return null;
                  return (
                    <PlatformDetailsBlock>
                      <PlatformDetailRow>
                        <PlatformDetailLabel>{t('credentials.platform') || 'Platform:'}</PlatformDetailLabel>
                        <PlatformDetailValue>{selected.name}</PlatformDetailValue>
                      </PlatformDetailRow>
                      <PlatformDetailRow>
                        <PlatformDetailLabel>{t('credentials.loginUrl') || 'Login URL:'}</PlatformDetailLabel>
                        <PlatformDetailValue>{selected.loginUrl || '—'}</PlatformDetailValue>
                      </PlatformDetailRow>
                      <PlatformDetailRow>
                        <PlatformDetailLabel>{t('credentials.username') || 'Username:'}</PlatformDetailLabel>
                        <PlatformDetailValue>{selected.username || '—'}</PlatformDetailValue>
                      </PlatformDetailRow>
                      <PlatformDetailRow>
                        <PlatformDetailLabel>{t('credentials.password') || 'Password:'}</PlatformDetailLabel>
                        <PlatformDetailValue>{selected.password || '—'}</PlatformDetailValue>
                      </PlatformDetailRow>
                    </PlatformDetailsBlock>
                  );
                })()}
              </FormField>



              <ModalFooter>
                {editingId && (
                  <DeleteButton type="button" onClick={() => {
                    if (window.confirm(`Delete automation "${name}"?`)) {
                      saveAutomations(automations.filter((a) => a.id !== editingId));
                      setModalOpen(false);
                      setEditingId(null);
                    }
                  }}>
                    Delete
                  </DeleteButton>
                )}
                <div style={{ flex: 1 }} />
                <CancelButton type="button" onClick={() => setModalOpen(false)}>
                  {t('schedule.cancel')}
                </CancelButton>
                <SaveButton type="button" onClick={handleSave}>
                  {editingId ? t('schedule.save') : t('schedule.create')}
                </SaveButton>
              </ModalFooter>
            </Form>
          </Modal>
        </Overlay>
      )}

      {helpModalOpen && (
        <Overlay onMouseDown={(e) => e.target === e.currentTarget && setHelpModalOpen(false)}>
          <Modal onMouseDown={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{t('auth.howToSetAutomation')}</ModalTitle>
              <CloseButton type="button" onClick={() => setHelpModalOpen(false)}>
                <MdClose />
              </CloseButton>
            </ModalHeader>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>
              {t('auth.howToSetAutomationContent')}
            </div>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}
