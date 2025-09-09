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
import { useTranslation } from "@/hooks/useTranslation";

interface ProviderManagerProps {
  onBack: () => void;
}

export default function ProviderManager({ onBack }: ProviderManagerProps) {
  const { t } = useTranslation();
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
      setToastMessage({ message: t("loadProviderConfigFailed"), type: 'error' });
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
      setToastMessage({ message: t("common.switchProviderFailed"), type: 'error' });
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
      setToastMessage({ message: t("common.clearConfigFailed"), type: 'error' });
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
      setToastMessage({ message: t("common.connectionTestFailed"), type: 'error' });
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
      setToastMessage({ message: t("common.providerDeleteSuccess") , type: 'success' });
      await loadData();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      setToastMessage({ message: t("common.deleteProviderFailed"), type: 'error' });
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
        setToastMessage({ message: t("common.providerUpdateSuccess"), type: 'success' });
      } else {
        await api.addProviderConfig(formData);
        setToastMessage({ message: t("common.providerAddSuccess"), type: 'success' });
      }
      setShowForm(false);
      setEditingProvider(null);
      await loadData();
    } catch (error) {
      console.error('Failed to save provider:', error);
      setToastMessage({ message: editingProvider ? t("common.updateProviderFailed") : t("common.addProviderFailed"), type: 'error' });
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
          <p className="text-sm text-muted-foreground">{t("common.loadingProviderConfig")}</p>
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
            <h1 className="text-lg font-semibold">{t("common.providerManager")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("common.switchClaudeApiProviders")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddProvider}
            className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300 hover:bg-gray-500/10"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("common.addProvider")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCurrentConfig(true)}
            className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300 hover:bg-gray-500/10"
          >
            <Eye className="h-3 w-3 mr-1" />
            {t("common.viewCurrentConfig")}
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
            {t("common.clearConfig")}
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
                {t("common.currentConfigStatus")}
              </h3>
              <div className="space-y-2 text-sm">
                {currentProviderId ? (
                  currentProviderId === "custom" ? (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-orange-700">{ t("common.customConfig") }</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">
                        {t("common.using")} {presets.find(p => p.id === currentProviderId)?.name || currentProviderId}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{t("common.isNoProvidersConfigured")}</span>
                  </div>
                )}
                
                {currentConfig?.anthropic_base_url && (
                  <p className="text-muted-foreground">
                    {t("common.apiAddressLabel")} {currentConfig.anthropic_base_url}
                  </p>
                )}
              </div>
            </div>
          )}

          {presets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{t("common.noProvidersConfigured")}</p>
                <Button
                  onClick={handleAddProvider}
                  size="sm"
                  className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300 hover:bg-gray-500/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("common.addFirstProvider")}
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
                        {t("common.currentlyUsed")}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                      <p><span className="font-medium">{t("common.description")}</span>{config.description}</p>
                    <p><span className="font-medium">{t("common.apiAddressLabel")}</span>{config.base_url}</p>
                    {config.model && (
                      <p><span className="font-medium">{t("common.modelLabel")}</span>{config.model}</p>
                    )}
                    {config.small_fast_model && (
                      <p><span className="font-medium">{t("common.haikuModelLabel")}</span>{config.small_fast_model}</p>
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
                    className="hover:bg-green-500/10 hover:text-green-600"
                  >
                    {switching === config.id ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {isCurrentProvider(config) ? t("common.selected") : t("common.switchToConfig")}
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
              className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300 hover:bg-gray-500/10"
            >
              {showTokens ? (
                <EyeOff className="h-3 w-3 mr-1" />
              ) : (
                <Eye className="h-3 w-3 mr-1" />
              )}
              {showTokens ? t("common.hide") : t("common.show")}{t("common.key")}
            </Button>
          </div>
          )}
        </div>
      </div>

      {/* Current Config Dialog */}
      <Dialog open={showCurrentConfig} onOpenChange={setShowCurrentConfig}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("common.currentSettings")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-x-hidden">{/* 确保水平方向不溢出 */}
            {currentConfig ? (
              <div className="space-y-3">
                {currentConfig.anthropic_base_url && (
                  <div>
                    <p className="font-medium text-sm">{t("common.anthropicBaseUrl")}</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.anthropic_base_url}
                    </p>
                  </div>
                )}
                {currentConfig.anthropic_auth_token && (
                  <div>
                    <p className="font-medium text-sm">{t("common.anthropicAuthToken")}</p>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded break-all overflow-hidden w-full">
                      {showTokens ? currentConfig.anthropic_auth_token : maskToken(currentConfig.anthropic_auth_token)}
                    </div>
                  </div>
                )}
                {currentConfig.anthropic_api_key && (
                  <div>
                    <p className="font-medium text-sm">{t("common.anthropicApiKey")}</p>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded break-all overflow-hidden w-full">
                      {showTokens ? currentConfig.anthropic_api_key : maskToken(currentConfig.anthropic_api_key)}
                    </div>
                  </div>
                )}
                {currentConfig.anthropic_model && (
                  <div>
                    <p className="font-medium text-sm">{t("common.anthropicModel")}</p>
                    <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                      {currentConfig.anthropic_model}
                    </p>
                  </div>
                )}
                {currentConfig.anthropic_small_fast_model && (
                  <div>
                    <p className="font-medium text-sm">{t("common.anthropicSmallFastModel")}</p>
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
                    className="text-xs hover:!text-gray-400 dark:hover:!text-gray-300 hover:bg-gray-500/10"
                  >
                    {showTokens ? (
                      <EyeOff className="h-3 w-3 mr-1" />
                    ) : (
                      <Eye className="h-3 w-3 mr-1" />
                    )}
                    {showTokens ? t("common.hide") : t("common.show")}{t("common.key")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t("common.noAnthropicConfig")}</p>
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
            <DialogTitle>{editingProvider ? t("common.editProviderDialog") : t("common.addProviderDialog")}</DialogTitle>
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
            <DialogTitle>{t("dialogs.confirmDelete")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{t("common.confirmDeleteProvider", { name: providerToDelete?.name })}</p>
            <p className="text-sm text-muted-foreground mt-2">{t("common.thisOperationCannotBeUndone")}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={cancelDeleteProvider}
              disabled={deleting === providerToDelete?.id}
              className="hover:!text-gray-600 dark:hover:!text-gray-300"
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProvider}
              disabled={deleting === providerToDelete?.id}
              className="hover:text-red-700 hover:bg-red-500/10 hover:text-red-600"
            >
              {deleting === providerToDelete?.id ? (
                <div className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.deleting")}
                </div>
              ) : (
                t("dialogs.confirmDelete")
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