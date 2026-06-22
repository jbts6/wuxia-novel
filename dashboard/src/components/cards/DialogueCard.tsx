import React from 'react';
import { useNovelStore } from '../../stores/useNovelStore';

interface DialogueCardProps {
  speaker: string;
  speaker_name: string;
  text: string;
  tone: string;
  isSelf: boolean;
  /** 是否是同一说话者连续气泡组的首条：首条显示头像与名字，后续合并隐藏 */
  showHeader: boolean;
  avatarColor: string;
}

const DialogueCard: React.FC<DialogueCardProps> = ({
  speaker,
  speaker_name,
  text,
  tone,
  isSelf,
  showHeader,
  avatarColor,
}) => {
  const characters = useNovelStore((s) => s.characters);
  const showDetail = useNovelStore((s) => s.showDetail);

  const speakerChar = characters.find((c) => c.id === speaker);
  const openDetail = () => {
    if (speakerChar) showDetail('character', speakerChar.id);
  };

  return (
    <div className={`chat-row${isSelf ? ' self' : ''}${showHeader ? '' : ' grouped'}`}>
      <span
        className="chat-avatar"
        style={{
          background: avatarColor,
          visibility: showHeader ? 'visible' : 'hidden',
          cursor: speakerChar ? 'pointer' : 'default',
        }}
        onClick={openDetail}
      >
        {speaker_name.charAt(0)}
      </span>
      <div className="chat-col">
        {showHeader && (
          <div className="chat-name">
            <span
              className="chat-name-text"
              onClick={openDetail}
              style={{ cursor: speakerChar ? 'pointer' : 'default' }}
            >
              {speaker_name}
            </span>
            {tone && <span className="chat-tone">{tone}</span>}
          </div>
        )}
        <div className="chat-bubble">{text}</div>
      </div>
    </div>
  );
};

export default DialogueCard;
