import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Settings2, 
  Globe, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  TestTube,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash
} from 'lucide-react';
import { api, type ProviderConfig, type CurrentProviderConfig } from '@/lib/api';
import { Toast } from '@/components/ui/toast';
import ProviderForm from './ProviderForm';

interface ProviderManagerProps {
  onBack: () => void;
}

export default function ProviderManager({ onBack }: ProviderManagerProps) {
  const [presets, setPresets] = useState<ProviderConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<CurrentProviderConfig | null>(null);
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCurrentConfig, setShowCurrentConfig] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<ProviderConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [presetsData, configData, providerIdData] = await Promise.all([
        api.getProviderPresets(),
        api.getCurrentProviderConfig(),
        api.getCurrentProviderId()
      ]);
      setPresets(presetsData);
      setCurrentConfig(configData);
      setCurrentProviderId(providerIdData);
    } catch (error) {
      console.error('Failed to load provider data:', error);
      setToastMessage({ message: '加载代理商配置失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const switchProvider = async (config: ProviderConfig) => {
    try {
      setSwitching(config.id);
      const message = await api.switchProviderConfig(config);
      setToastMessage({ message, type: 'success' });
      await loadData(); // Refresh current config
      
      // 触发 Settings 组件刷新环境变量显示
      window.dispatchEvent(new CustomEvent('provider-config-changed'));
      
    } catch (error) {
      console.error('Failed to switch provider:', error);
      setToastMessage({ message: '切换代理商失败', type: 'error' });
    } finally {
      setSwitching(null);
    }
  };

  const clearProvider = async () => {
    try {
      setSwitching('clear');
      const message = await api.clearProviderConfig();
      setToastMessage({ message, type: 'success' });
      await loadData(); // Refresh current config
      
      // 触发 Settings 组件刷新环境变量显示
      window.dispatchEvent(new CustomEvent('provider-config-changed'));
      
    } catch (error) {
      console.error('Failed to clear provider:', error);
      setToastMessage({ message: '清理配置失败', type: 'error' });
    } finally {
      setSwitching(null);
    }
  };

  const testConnection = async (config: ProviderConfig) => {
    try {
      setTesting(config.id);
      const message = await api.testProviderConnection(config.base_url);
      setToastMessage({ message, type: 'success' });
    } catch (error) {
      console.error('Failed to test connection:', error);
      setToastMessage({ message: '连接测试失败', type: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowForm(true);
  };

  const handleEditProvider = (config: ProviderConfig) => {
    setEditingProvider(config);
    setShowForm(true);
  };

  const handleDeleteProvider = async (config: ProviderConfig) => {
    // 设置要删除的代理商并显示确认对话框
    setProviderToDelete(config);
    setShowDeleteDialog(true);
  };

  const confirmDeleteProvider = async () => {
    if (!providerToDelete) return;
    
    try {
      setDeleting(providerToDelete.id);
      await api.deleteProviderConfig(providerToDelete.id);
      setToastMessage({ message: '代理商删除成功', type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      setToastMessage({ message: '删除代理商失败', type: 'error' });
    } finally {
      setDeleting(null);
      setShowDeleteDialog(false);
      // 延迟清理 providerToDelete，确保对话框完全关闭后再清理
      setTimeout(() => {
        setProviderToDelete(null);
      }, 150);
    }
  };

  const cancelDeleteProvider = () => {
    setShowDeleteDialog(false);
    // 延迟清理 providerToDelete，确保对话框完全关闭后再清理
    setTimeout(() => {
      setProviderToDelete(null);
    }, 150); // 等待Dialog动画完成
  };

  const handleFormSubmit = async (formData: Omit<ProviderConfig, 'id'>) => {
    try {
      if (editingProvider) {
        await api.updateProviderConfig({ ...formData, id: editingProvider.id });
        setToastMessage({ message: '代理商更新成功', type: 'success' });
      } else {
        await api.addProviderConfig(formData);
        setToastMessage({ message: '代理商添加成功', type: 'success' });
      }
      setShowForm(false);
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save provider:', error);
      setToastMessage({ message: editingProvider ? '更新代理商失败' : '添加代理商失败', type: 'error' });
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingProvider(null);
  };

  const isCurrentProvider = (config: ProviderConfig): boolean => {
    return currentProviderId === config.id;
  };

  const maskToken = (token: string): string => {
    if (!token || token.length <= 10) return token;
    // 对于非常长的token，显示更多开头和结尾的字符，并限制中间部分的长度
    if (token.length > 100) {
      const start = token.substring(0, 12);
      const end = token.substring(token.length - 8);
      const maskLength = Math.min(20, token.length - 20);
      return `${start}${'*'.repeat(maskLength)}${end}`;
    } else {
      const start = token.substring(0, 8);
      const end = token.substring(token.length - 4);
      return `${start}${'*'.repeat(token.length - 12)}${end}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">正在加载代理商配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">代理商管理</h1>
            <p className="text-xs text-muted-foreground">
              一键切换不同的 Claude API 代理商
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddProvider}
            className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加代理商
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCurrentConfig(true)}
            className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
          >
            <Eye className="h-3 w-3 mr-1" />
            查看当前配置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearProvider}
            disabled={switching === 'clear'}
            className='hover:bg-red-500/10 hover:text-red-600'
          >
            {switching === 'clear' ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1" />
            )}
            清理配置
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Current Status Display - 只在有代理商时显示 */}
          {presets.length > 0 && (
            <div className="p-4 bg-muted/30 rounded-lg border">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                当前配置状态
              </h3>
              <div className="space-y-2 text-sm">
                {currentProviderId ? (
                  currentProviderId === "custom" ? (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-orange-700">自定义配置 (未在预设列表中)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">
                        正在使用: {presets.find(p => p.id === currentProviderId)?.name || currentProviderId}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">未配置任何代理商</span>
                  </div>
                )}
                
                {currentConfig?.anthropic_base_url && (
                  <p className="text-muted-foreground">
                    API地址: {currentConfig.anthropic_base_url}
                  </p>
                )}
              </div>
            </div>
          )}

          {presets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">还没有配置任何代理商</p>
                <Button
                  onClick={handleAddProvider}
                  size="sm"
                  className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一个代理商
                </Button>
              </div>
            </div>
          ) : (
            presets.map((config) => (
            <Card key={config.id} className={`p-4 overflow-hidden ${isCurrentProvider(config) ? 'ring-2 ring-primary' : ''}`}>
              {/* 上半部分：基本信息和按钮 */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">{/* min-w-0 用于确保flex-shrink正常工作 */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foregrounuud" />
                      <h3 className="font-medium">{config.name}</h3>
                    </div>
                    {isCurrentProvider(config) && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        当前使用
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium">描述：</span>{config.description}</p>
                    <p><span className="font-medium">API地址：</span>{config.base_url}</p>
                    {config.model && (
                      <p><span className="font-medium">模型：</span>{config.model}</p>
                    )}
                    {config.small_fast_model && (
                      <p><span className="font-medium">Haiku 类模型名称：</span>{config.small_fast_model}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">{/* flex-shrink-0 防止按钮被压缩 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(config)}
                    disabled={testing === config.id}
                    className="text-xs"
                  >
                    {testing === config.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProvider(config)}
                    className="text-xs"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProvider(config)}
                    disabled={deleting === config.id}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 hover:text-red-600"
                  >
                    {deleting === config.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash className="h-3 w-3" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => switchProvider(config)}
                    disabled={switching === config.id || isCurrentProvider(config)}
                    className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
                  >
                    {switching === config.id ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {isCurrentProvider(config) ? '已选择' : '切换到此配置'}
                  </Button>
                </div>
              </div>
              
              {/* 下半部分：跨越全宽的Token/API Key显示 */}
              {(config.auth_token || config.api_key) && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="font-medium text-sm text-muted-foreground mb-2">
                    {config.auth_token ? 'Auth Token：' : 'API Key：'}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded break-all overflow-hidden">
                    {showTokens ? 
                      (config.auth_token || config.api_key) : 
                      maskToken(config.auth_token || config.api_key || '')
                    }
                  </div>
                </div>
              )}
            </Card>
            ))
          )}


          {/* Toggle tokens visibility */}
          {presets.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTokens(!showTokens)}
              className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
            >
              {showTokens ? (
                <EyeOff className="h-3 w-3 mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              {showTokens ? '隐藏' : '显示'}密钥
            </Button>
          </div>
          )}
        </div>
      </div>

      {/* Current Config Dialog */}
      <Dialog open={showCurrentConfig} onOpenChange={setShowCurrentConfig}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>当前 settings.json 配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-x-hidden">{/* 确保水平方向不溢出 */}
            {currentConfig ? (
              <div className="space-y-3">
                {currentConfig.anthropic_base_url && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_BASE_URL</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.anthropic_base_url}
                    </p>
                  </div>
                )}
                {currentConfig.anthropic_auth_token && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_AUTH_TOKEN</p>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded break-all overflow-hidden w-full">
                      {showTokens ? currentConfig.anthropic_auth_token : maskToken(currentConfig.anthropic_auth_token)}
                    </div>
                  </div>
                )}
                {currentConfig.anthropic_api_key && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_API_KEY</p>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded break-all overflow-hidden w-full">
                      {showTokens ? currentConfig.anthropic_api_key : maskToken(currentConfig.anthropic_api_key)}
                    </div>
                  </div>
                )}
                {currentConfig.anthropic_model && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_MODEL</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.anthropic_model}
                    </p>
                  </div>
                )}
                {currentConfig.anthropic_small_fast_model && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_SMALL_FAST_MODEL</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.anthropic_small_fast_model}
                    </p>
                  </div>
                )}
                
                {/* Show/hide tokens toggle in dialog */}
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTokens(!showTokens)}
                    className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300"
                  >
                    {showTokens ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showTokens ? '隐藏' : '显示'}密钥
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">未检测到任何 ANTHROPIC 配置</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Provider Form Dialog */}
      <Dialog open={showForm} onOpenChange={handleFormCancel}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProvider ? '编辑代理商' : '添加代理商'}</DialogTitle>
          </DialogHeader>
          <ProviderForm
            initialData={editingProvider || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) {
          cancelDeleteProvider(); // 使用统一的取消逻辑
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>确定要删除代理商 "{providerToDelete?.name}" 吗？</p>
            <p className="text-sm text-muted-foreground mt-2">此操作无法撤销。</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={cancelDeleteProvider}
              disabled={deleting === providerToDelete?.id}
              className="hover:!text-gray-600 dark:hover:!text-gray-300"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProvider}
              disabled={deleting === providerToDelete?.id}
              className="hover:!text-red-600"
            >
              {deleting === providerToDelete?.id ? (
                <div className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </div>
              ) : (
                '确认删除'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}