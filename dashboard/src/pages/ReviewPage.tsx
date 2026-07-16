import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useReviewStore } from '../stores/useReviewStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { CheckSquare, Trash2, RotateCcw, Filter } from 'lucide-react';

export default function ReviewPage() {
  const { authorName, bookName } = useParams<{ authorName: string; bookName: string }>();
  const bookPath = `${authorName}/${bookName}`;

  const {
    entities,
    files,
    filter,
    isLoading,
    error,
    loadFiles,
    loadEntities,
    toggleMark,
    markAll,
    deleteMarked,
    setFilter,
  } = useReviewStore();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadFiles(bookPath);
  }, [bookPath, loadFiles]);

  useEffect(() => {
    if (files.length > 0 && filter.type !== 'all') {
      loadEntities(bookPath, filter.type);
    }
  }, [files, filter.type, bookPath, loadEntities]);

  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      const matchSearch =
        !filter.search ||
        entity.name.includes(filter.search) ||
        entity.summary.includes(filter.search);
      const matchStatus =
        filter.status === 'all' ||
        (filter.status === 'marked' && entity.marked) ||
        (filter.status === 'unmarked' && !entity.marked);
      return matchSearch && matchStatus;
    });
  }, [entities, filter]);

  const markedCount = useMemo(() => entities.filter((e) => e.marked).length, [entities]);

  const handleDelete = async () => {
    await deleteMarked();
    setShowDeleteDialog(false);
  };

  const handleTypeChange = (type: string) => {
    setFilter({ type: type as typeof filter.type });
    if (type !== 'all') {
      loadEntities(bookPath, type);
    }
  };

  return (
    <div>
      <PageHeader
        title="数据审核"
        description={`${authorName} - ${bookName}`}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            共 {entities.length} 条
          </Badge>
          {markedCount > 0 && (
            <Badge variant="destructive">
              已标记 {markedCount} 条
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">类型：</span>
            <Select value={filter.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {files.map((file) => (
                  <SelectItem key={file.type} value={file.type}>
                    {file.type === 'characters' ? '人物' :
                     file.type === 'skills' ? '武功' :
                     file.type === 'items' ? '物品' : file.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">状态：</span>
            <Select
              value={filter.status}
              onValueChange={(status) => setFilter({ status: status as typeof filter.status })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="unmarked">未标记</SelectItem>
                <SelectItem value="marked">已标记</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            placeholder="搜索名称/简介..."
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-64"
          />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll(true)}
              disabled={entities.length === 0}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              全部标记
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll(false)}
              disabled={markedCount === 0}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              取消全部
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={markedCount === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除标记 ({markedCount})
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      )}

      {error && (
        <div className="text-center py-8 text-destructive">{error}</div>
      )}

      {!isLoading && !error && filter.type === 'all' && (
        <div className="text-center py-8 text-muted-foreground">
          请选择要审核的数据类型
        </div>
      )}

      {!isLoading && !error && filter.type !== 'all' && filteredEntities.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {entities.length === 0 ? '暂无数据' : '没有匹配的数据'}
        </div>
      )}

      {!isLoading && !error && filteredEntities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                entity.marked
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => toggleMark(entity.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className={`font-medium ${entity.marked ? 'line-through text-destructive' : ''}`}>
                  {entity.name}
                </h3>
                <Badge variant={entity.marked ? 'destructive' : 'secondary'} className="ml-2 shrink-0">
                  {entity.type === 'character' ? '人物' :
                   entity.type === 'skill' ? '武功' :
                   entity.type === 'item' ? '物品' : entity.type}
                </Badge>
              </div>
              <p className={`text-sm ${entity.marked ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                {entity.summary || '暂无简介'}
              </p>
              {entity.marked && (
                <div className="mt-2 text-xs text-destructive font-medium">
                  标记删除
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除 {markedCount} 条标记的数据吗？此操作不可撤销。
          </p>
          <p className="text-sm text-muted-foreground">
            系统会自动备份原文件。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
