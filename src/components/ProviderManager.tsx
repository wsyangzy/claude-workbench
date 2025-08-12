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
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCurrentConfig, setShowCurrentConfig] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [presetsData, configData] = await Promise.all([
        api.getProviderPresets(),
        api.getCurrentProviderConfig()
      ]);
      setPresets(presetsData);
      setCurrentConfig(configData);
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
    if (!confirm(`确定要删除代理商 "${config.name}" 吗？`)) {
      return;
    }
    
    try {
      setDeleting(config.id);
      await api.deleteProviderConfig(config.id);
      setToastMessage({ message: '代理商删除成功', type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      setToastMessage({ message: '删除代理商失败', type: 'error' });
    } finally {
      setDeleting(null);
    }
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
    if (!currentConfig) return false;
    return currentConfig.anthropic_base_url === config.base_url;
  };

  const maskToken = (token: string): string => {
    if (!token || token.length <= 10) return token;
    const start = token.substring(0, 8);
    const end = token.substring(token.length - 4);
    return `${start}${'*'.repeat(token.length - 12)}${end}`;
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
            variant="default"
            size="sm"
            onClick={handleAddProvider}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加代理商
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCurrentConfig(true)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            查看当前配置
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearProvider}
            disabled={switching === 'clear'}
            className="text-xs"
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
          {presets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">还没有配置任何代理商</p>
                <Button onClick={handleAddProvider} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一个代理商
                </Button>
              </div>
            </div>
          ) : (
            presets.map((config) => (
            <Card key={config.id} className={`p-4 ${isCurrentProvider(config) ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
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
                    {config.auth_token && (
                      <p><span className="font-medium">认证Token：</span>
                        {showTokens ? config.auth_token : maskToken(config.auth_token)}
                      </p>
                    )}
                    {config.api_key && (
                      <p><span className="font-medium">API Key：</span>
                        {showTokens ? config.api_key : maskToken(config.api_key)}
                      </p>
                    )}
                    {config.model && (
                      <p><span className="font-medium">模型：</span>{config.model}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                    className="text-xs text-red-600 hover:text-red-700"
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
                    className="text-xs"
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
              className="text-xs"
            >
              {showTokens ? (
                <EyeOff className="h-3 w-3 mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              {showTokens ? '隐藏' : '显示'}Token
            </Button>
          </div>
          )}
        </div>
      </div>

      {/* Current Config Dialog */}
      <Dialog open={showCurrentConfig} onOpenChange={setShowCurrentConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>当前环境变量配置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {showTokens ? currentConfig.anthropic_auth_token : maskToken(currentConfig.anthropic_auth_token)}
                    </p>
                  </div>
                )}
                {currentConfig.anthropic_api_key && (
                  <div>
                    <p className="font-medium text-sm">ANTHROPIC_API_KEY</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {showTokens ? currentConfig.anthropic_api_key : maskToken(currentConfig.anthropic_api_key)}
                    </p>
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
                
                {/* Show/hide tokens toggle in dialog */}
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTokens(!showTokens)}
                    className="text-xs"
                  >
                    {showTokens ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showTokens ? '隐藏' : '显示'}Token
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">未检测到任何 ANTHROPIC 环境变量</p>
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