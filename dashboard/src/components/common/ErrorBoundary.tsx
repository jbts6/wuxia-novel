import React from 'react';
import { Result } from 'antd';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 重新挂载的依赖键：变化时重置错误状态（如切换详情实体） */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// 局部错误边界：单个卡片渲染异常时只显示提示，避免整页白屏。
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="warning"
          title="内容渲染失败"
          subTitle="该条目的数据格式异常，已跳过渲染。"
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
