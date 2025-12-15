import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { inviteApi } from '../../services/api';
import { generateInviteShareText } from '../../utils/inviteTemplate';
import { XMarkIcon, TicketIcon, DocumentDuplicateIcon, GiftIcon, CheckCircleIcon, ShareIcon, LinkIcon } from '@heroicons/react/24/outline';

interface UserCenterProps {
  onClose: () => void;
  isLightMode?: boolean;
}

interface InviteCode {
  code: string;
  isUsed: boolean;
  usedBy: { id: number; email: string } | null;
  usedAt: string | null;
}

export function UserCenter({ onClose, isLightMode = false }: UserCenterProps) {
  const { user, refreshUser } = useAuth();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedShareText, setCopiedShareText] = useState(false);

  // Fetch invitation codes on mount
  useEffect(() => {
    const fetchCodes = async () => {
      if (!user) return;

      try {
        const codesResponse = await inviteApi.getMyCodes();
        setInviteCodes(codesResponse.codes || []);
      } catch (error) {
        console.error('Failed to fetch codes:', error);
      } finally {
        setIsLoadingCodes(false);
      }
    };

    fetchCodes();
  }, [user]);

  const copyToClipboard = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // 获取所有未使用的邀请码
  const availableCodes = inviteCodes.filter(c => !c.isUsed).map(c => c.code);

  // 生成分享链接 - 使用主页链接
  const getShareLink = () => {
    return 'https://www.abdc.online/';
  };

  // 生成完整的营销话术文案 - 使用共享模板
  const getShareText = (): string => {
    if (availableCodes.length === 0) return '暂无可用邀请码';
    return generateInviteShareText(availableCodes[0]);
  };

  const copyShareLink = async () => {
    const link = getShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 3000);
    } catch (err) {
      // Fallback for mobile
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedShareLink(true);
        setTimeout(() => setCopiedShareLink(false), 3000);
      } catch (e) {
        alert('复制失败，请手动复制链接');
      }
      document.body.removeChild(textArea);
    }
  };

  // 复制完整的营销话术 (with mobile fallback)
  const copyShareWithText = async () => {
    if (availableCodes.length === 0) return;
    const text = getShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShareText(true);
      setTimeout(() => setCopiedShareText(false), 3000);
    } catch (err) {
      // Fallback for mobile browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const success = document.execCommand('copy');
        if (success) {
          setCopiedShareText(true);
          setTimeout(() => setCopiedShareText(false), 3000);
        } else {
          alert('复制失败，请手动复制邀请码：' + availableCodes[0]);
        }
      } catch (e) {
        alert('复制失败，请手动复制邀请码：' + availableCodes[0]);
      }
      document.body.removeChild(textArea);
    }
  };

  const usedCount = inviteCodes.filter(c => c.isUsed).length;
  const unusedCount = inviteCodes.filter(c => !c.isUsed).length;

  // 使用 AuthContext 中的数据
  const points = user?.points || 0;
  const dailyPoints = user?.dailyPoints || 0;
  const totalPoints = user?.totalPoints || 0;

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300 p-4
        ${isLightMode ? 'bg-black/40' : 'bg-black/60'}`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-4xl p-6 md:p-10 flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden overscroll-y-contain shadow-2xl backdrop-blur-xl animate-open-elastic
          ${isLightMode
            ? 'text-zinc-800 bg-white/90 border border-zinc-200/50 shadow-black/5 rounded-lg'
            : 'text-white bg-black/80 border border-white/10 shadow-black/80 rounded-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 md:top-6 md:right-6 p-1.5 border-0 bg-transparent transition-colors
            ${isLightMode ? 'text-zinc-400 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'}`}
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* 标题区 */}
        <div className={`mb-8 pb-6 border-b ${isLightMode ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <h1 className={`text-xl font-bold tracking-[0.15em] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>
            用户中心
          </h1>
          <p className={`text-[10px] mt-1 tracking-widest ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>PERSONAL CENTER</p>
        </div>

        {/* ============ 分享邀请区 - 最醒目 ============ */}
        <div className="mb-8 p-1 relative">

          <div className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-1 ${isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}`}>
                <GiftIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className={`text-base font-bold font-['Noto_Serif_SC_Variable'] tracking-wide ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>
                  邀请好友，双方得积分！
                </h3>
                <p className={`text-xs font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-cyan-600/80' : 'text-[#00ffff]/80'}`}>
                  每成功邀请一人，您获得 <span className={`font-bold ${isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}`}>500</span> 永久积分
                </p>
              </div>
            </div>

            {availableCodes.length > 0 ? (
              <div className="space-y-4">
                {/* 分享链接行 */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 flex items-center gap-2 px-1 py-2.5 overflow-hidden
                    ${isLightMode ? 'border-b border-zinc-200' : 'border-b border-zinc-700'}`}>
                    <LinkIcon className={`w-4 h-4 flex-shrink-0 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
                    <span className={`text-xs font-mono truncate select-all ${isLightMode ? 'text-zinc-600' : 'text-zinc-300'}`}>{getShareLink()}</span>
                  </div>
                  <button
                    onClick={copyShareLink}
                    className={`flex items-center gap-2 px-3 py-2.5 font-['Noto_Serif_SC_Variable'] text-xs tracking-wide transition-all duration-300 flex-shrink-0 border rounded-sm
                      ${copiedShareLink
                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                        : isLightMode
                          ? 'bg-white border border-zinc-200 text-zinc-600 hover:border-cyan-500 hover:text-cyan-600'
                          : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                  >
                    {copiedShareLink ? (
                      <>
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        已复制
                      </>
                    ) : (
                      <>
                        <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        复制链接
                      </>
                    )}
                  </button>
                </div>

                {/* 一键复制话术按钮 - 主推 */}
                <button
                  onClick={copyShareWithText}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-['Noto_Serif_SC_Variable'] text-sm tracking-wide transition-all duration-300 rounded-sm
                    ${copiedShareText
                      ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                      : isLightMode
                        ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm border border-transparent'
                        : 'bg-[#00ffff] text-black hover:bg-[#00ffff]/90 hover:scale-[1.01] shadow-[0_0_20px_rgba(0,255,255,0.2)] border-0'
                    }`}
                >
                  {copiedShareText ? (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      已复制邀请话术，快去分享吧！
                    </>
                  ) : (
                    <>
                      <ShareIcon className="w-4 h-4" />
                      一键复制邀请
                    </>
                  )}
                </button>

                {/* 分享提示 */}
                <p className={`text-[11px] font-['Noto_Serif_SC_Variable'] leading-relaxed ${isLightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  💡 点击上方按钮复制完整邀请话术，分享到微信、朋友圈或社群。好友通过您的邀请码注册后，您将获得 <span className={isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}>500</span> 积分奖励
                </p>
              </div>

            ) : (
              <p className={`text-xs font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>暂无可用邀请码</p>
            )}
          </div>
        </div>

        {/* 主内容区 - 两栏布局 */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-10 relative">

          {/* 分隔线 (桌面端) */}
          <div className={`hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-800'}`}></div>

          {/* 左栏: 账户信息 */}
          <div className="flex flex-col gap-6 pr-0 md:pr-8">

            {/* 账号 */}
            <div className="flex flex-col gap-1.5">
              <span className={`text-[10px] tracking-wider font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>账号</span>
              <span className={`text-sm font-['Noto_Serif_SC_Variable'] tracking-wide ${isLightMode ? 'text-zinc-700' : 'text-zinc-200'}`}>
                {user?.email || '访客'}
              </span>
            </div>

            {/* 积分显示 */}
            <div className="flex flex-col gap-3">
              <span className={`text-[10px] tracking-wider font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>积分余额</span>
              <div className="flex items-end gap-4">
                <div className="flex flex-col">
                  <span className={`text-4xl font-light font-[Cinzel] tracking-wider ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>
                    {totalPoints}
                  </span>
                  <span className={`text-[10px] mt-1 font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>总可用</span>
                </div>
                <div className="flex gap-4 mb-1">
                  <div className={`flex flex-col items-center px-3 py-1.5 rounded-sm ${isLightMode ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                    <span className={`text-lg font-[Cinzel] ${isLightMode ? 'text-zinc-600' : 'text-zinc-300'}`}>{points}</span>
                    <span className={`text-[9px] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>永久</span>
                  </div>
                  <div className={`flex flex-col items-center px-3 py-1.5 rounded-sm ${isLightMode ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                    <span className={`text-lg font-[Cinzel] ${isLightMode ? 'text-zinc-600' : 'text-zinc-300'}`}>{dailyPoints}</span>
                    <span className={`text-[9px] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>每日</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 每日积分说明 */}
            <div className="flex flex-col gap-3">
              <span className={`text-[10px] tracking-wider font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>每日积分</span>
              <div className={`flex items-center gap-3 px-4 py-3 border font-['Noto_Serif_SC_Variable'] text-sm rounded-sm
                ${isLightMode ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-700 bg-zinc-800/30'}`}>
                <CheckCircleIcon className="w-4 h-4 text-green-500/70 flex-shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className={isLightMode ? 'text-zinc-600' : 'text-zinc-300'}>每日 <span className={`font-medium ${isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}`}>500</span> 积分自动发放</span>
                  <span className={`text-[10px] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>每天零点自动刷新，当日有效不累积</span>
                </div>
              </div>
            </div>

            {/* 积分规则 */}
            <div className="flex flex-col gap-3">
              <span className={`text-[10px] tracking-wider font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>消耗规则</span>
              <div className={`space-y-2 font-['Noto_Serif_SC_Variable'] text-xs tracking-wide leading-relaxed ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <p className="flex items-start gap-2">
                  <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${isLightMode ? 'bg-zinc-300' : 'bg-zinc-600'}`}></span>
                  <span>生成图片 <span className={`font-medium ${isLightMode ? 'text-zinc-700' : 'text-zinc-200'}`}>100</span> · 高清放大 <span className={`font-medium ${isLightMode ? 'text-zinc-700' : 'text-zinc-200'}`}>50</span></span>
                </p>
                <p className="flex items-start gap-2">
                  <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${isLightMode ? 'bg-zinc-300' : 'bg-zinc-600'}`}></span>
                  <span>优先消耗每日积分，不足时扣永久积分</span>
                </p>
              </div>
            </div>
          </div>

          {/* 右栏: 邀请码列表 */}
          <div className="flex flex-col gap-4 pl-0 md:pl-8 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TicketIcon className={`w-4 h-4 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
                <span className={`text-[10px] tracking-wider font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>我的邀请码</span>
              </div>
              <div className="flex gap-3 text-[10px] font-['Noto_Serif_SC_Variable']">
                <span className={isLightMode ? 'text-zinc-500' : 'text-zinc-400'}>可用 <span className={isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}>{unusedCount}</span></span>
                <span className={isLightMode ? 'text-zinc-400' : 'text-zinc-600'}>已用 {usedCount}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5 min-h-[300px]">
              {isLoadingCodes ? (
                <div className="flex items-center justify-center py-10">
                  <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${isLightMode ? 'border-zinc-300' : 'border-zinc-600'}`} />
                </div>
              ) : inviteCodes.length > 0 ? (
                inviteCodes.map((invite, index) => (
                  <div
                    key={index}
                    className={`group flex items-center justify-between w-full p-3 border transition-all rounded-md mb-2
                      ${invite.isUsed
                        ? isLightMode
                          ? 'border-transparent bg-zinc-50 opacity-60'
                          : 'border-transparent bg-white/5 opacity-50'
                        : isLightMode
                          ? 'border-zinc-100 hover:border-zinc-300 bg-white hover:shadow-sm'
                          : 'border-white/5 hover:border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                  >
                    {/* 邀请码 */}
                    <span className={`font-mono text-xs tracking-[0.15em] ${invite.isUsed
                      ? isLightMode
                        ? 'text-zinc-300 line-through decoration-zinc-300'
                        : 'text-zinc-700 line-through decoration-zinc-700'
                      : isLightMode
                        ? 'text-zinc-600 group-hover:text-zinc-800'
                        : 'text-zinc-300 group-hover:text-white'
                      }`}>
                      {invite.code}
                    </span>

                    {/* 状态/复制 */}
                    {invite.isUsed ? (
                      <span className={`text-[10px] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-700'}`}>已使用</span>
                    ) : (
                      <button
                        onClick={() => copyToClipboard(invite.code, index)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 transition-all rounded-md text-[10px] border
                          ${isLightMode
                            ? 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-cyan-600'
                            : 'bg-transparent border-white/10 hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white'}`}
                        title="复制邀请码"
                      >
                        {copiedIndex === index ? (
                          <span className={`font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-cyan-600' : 'text-[#00ffff]'}`}>已复制</span>
                        ) : (
                          <>
                            <DocumentDuplicateIcon className="w-3 h-3" />
                            <span className="font-['Noto_Serif_SC_Variable']">复制</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className={`flex flex-col items-center justify-center py-10 border border-dashed rounded-sm
                  ${isLightMode ? 'border-zinc-200' : 'border-zinc-800'}`}>
                  <span className={`text-xs font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>暂无邀请码</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 底部操作 */}
        <div className={`mt-8 pt-6 border-t flex justify-center ${isLightMode ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <LogoutButton onClose={onClose} isLightMode={isLightMode} />
        </div>

      </div>
    </div>
  );
}

// 单独的登出按钮组件
function LogoutButton({ onClose, isLightMode }: { onClose: () => void; isLightMode: boolean }) {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <button
      onClick={handleLogout}
      className={`text-[11px] tracking-wider transition-colors font-['Noto_Serif_SC_Variable'] flex items-center gap-3 px-4 py-2
        ${isLightMode ? 'text-zinc-400 hover:text-red-500' : 'text-zinc-600 hover:text-red-400'}`}
    >
      <span className={`w-4 h-[1px] ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-800'}`}></span>
      退出登录
      <span className={`w-4 h-[1px] ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-800'}`}></span>
    </button>
  );
}
