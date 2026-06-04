import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { useNovelStore } from '../../stores/useNovelStore';

const { Text, Paragraph } = Typography;

interface DialogueCardProps {
  speaker: string;
  speaker_name: string;
  listener: string | null;
  text: string;
  tone: string;
  chapter: number;
  onClick?: () => void;
}

const toneColors: Record<string, string> = {
  '疑问': 'blue',
  '激动': 'red',
  '平静': 'default',
  '愤怒': 'red',
  '犹豫': 'orange',
  '调侃': 'purple',
  '恳求': 'cyan',
  '冷酷': 'volcano',
  '嘲讽': 'magenta',
  '豪迈': 'gold',
  '悲伤': 'geekblue',
  '书生气': 'lime',
};

const DialogueCard: React.FC<DialogueCardProps> = ({
  speaker,
  speaker_name,
  text,
  tone,
  chapter,
  onClick,
}) => {
  const { characters, showDetail } = useNovelStore();

  const speakerChar = characters.find((c) => c.id === speaker);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (speakerChar) {
      showDetail('character', speakerChar.id);
    }
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        cursor: speakerChar ? 'pointer' : 'default',
        borderLeft: `4px solid ${toneColors[tone] ? '#1890ff' : '#d9d9d9'}`,
      }}
      onClick={handleClick}
      hoverable={!!speakerChar}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <CommentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          <Text strong>{speaker_name}</Text>
        </div>
        <div>
          <Tag color={toneColors[tone] || 'default'}>{tone}</Tag>
          <Tag>第{chapter}章</Tag>
        </div>
      </div>
      <Paragraph
        style={{
          margin: 0,
          fontStyle: 'italic',
          paddingLeft: 24,
        }}
        ellipsis={{ rows: 3, expandable: true }}
      >
        "{text}"
      </Paragraph>
    </Card>
  );
};

export default DialogueCard;
