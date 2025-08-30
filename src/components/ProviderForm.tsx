import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  X, 
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { type ProviderConfig } from '@/lib/api';
import { Toast } from '@/components/ui/toast';

interface ProviderFormProps {
  initialData?: ProviderConfig;
  onSubmit: (formData: Omit<ProviderConfig, 'id'>) => Promise<void>;
  onCancel: () => void;
}

export default function ProviderForm({ 
  initialData, 
  onSubmit, 
  onCancel 
}: ProviderFormProps) {
  // 确定初始的认证类型
  const getInitialAuthType = () => {
    if (initialData?.auth_token) return 'auth_token';
    if (initialData?.api_key) return 'api_key';
    return 'auth_token'; // 默认为auth_token
  };

  const [authType, setAuthType] = useState<'auth_token' | 'api_key'>(getInitialAuthType());
  const [formData, setFormData] = useState<Omit<ProviderConfig, 'id'>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    base_url: initialData?.base_url || '',
    auth_token: initialData?.auth_token || '',
    api_key: initialData?.api_key || '',
    model: initialData?.model || '',
    small_fast_model: initialData?.small_fast_model || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isEditing = !!initialData;

  const handleInputChange = (field: keyof Omit<ProviderConfig, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || undefined // 将空字符串转换为 undefined
    }));
  };

  // 处理认证类型切换
  const handleAuthTypeChange = (newType: 'auth_token' | 'api_key') => {
    setAuthType(newType);
    // 清空另一种认证方式的值
    if (newType === 'auth_token') {
      handleInputChange('api_key', '');
    } else {
      handleInputChange('auth_token', '');
    }
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return '请输入代理商名称';
    }
    if (!formData.base_url.trim()) {
      return '请输入API地址';
    }
    if (!formData.base_url.startsWith('http://') && !formData.base_url.startsWith('https://')) {
      return 'API地址必须以 http:// 或 https:// 开头';
    }
    
    // 验证认证信息：必须且只能选择一个
    const hasAuthToken = formData.auth_token?.trim();
    const hasApiKey = formData.api_key?.trim();
    
    if (!hasAuthToken && !hasApiKey) {
      return '请填写认证Token或API Key（二选一）';
    }
    
    if (hasAuthToken && hasApiKey) {
      return '认证Token和API Key只能填写一个，不能同时填写';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateForm();
    if (error) {
      setToastMessage({ message: error, type: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      const submitData: Omit<ProviderConfig, 'id'> = {
        ...formData,
        // 清理空值
        auth_token: formData.auth_token?.trim() || undefined,
        api_key: formData.api_key?.trim() || undefined,
        model: formData.model?.trim() || undefined,
        small_fast_model: formData.small_fast_model?.trim() || undefined,
      };

      await onSubmit(submitData);
      
    } catch (error) {
      console.error('Failed to save provider config:', error);
      setToastMessage({ 
        message: `${isEditing ? '更新' : '添加'}代理商配置失败: ${error}`, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-4 space-y-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                基本信息
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">代理商名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="例如：OpenAI 官方"
                    disabled={loading}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="例如：OpenAI 官方 API"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_url">API 地址 *</Label>
                <Input
                  id="base_url"
                  value={formData.base_url}
                  onChange={(e) => handleInputChange('base_url', e.target.value)}
                  placeholder="https://api.anthropic.com"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* 认证信息 */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                认证信息
                <span className="text-xs text-muted-foreground ml-2">
                  (选择一种认证方式)
                </span>
              </h3>
              
              <Tabs value={authType} onValueChange={(value) => handleAuthTypeChange(value as 'auth_token' | 'api_key')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auth_token">Auth Token</TabsTrigger>
                  <TabsTrigger value="api_key">API Key</TabsTrigger>
                </TabsList>
                
                <TabsContent value="auth_token" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="auth_token">Auth Token *</Label>
                    <div className="relative">
                      <Input
                        id="auth_token"
                        type={showTokens ? "text" : "password"}
                        value={formData.auth_token || ''}
                        onChange={(e) => handleInputChange('auth_token', e.target.value)}
                        placeholder="sk-ant-..."
                        disabled={loading}
                        className="pr-12 [&::-webkit-credentials-auto-fill-button]:!hidden [&::-ms-reveal]:!hidden"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-8 w-10 p-0 bg-transparent hover:bg-muted/20"
                        onClick={() => setShowTokens(!showTokens)}
                      >
                        {showTokens ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      对应 ANTHROPIC_AUTH_TOKEN 环境变量
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="api_key" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api_key">API Key *</Label>
                    <div className="relative">
                      <Input
                        id="api_key"
                        type={showTokens ? "text" : "password"}
                        value={formData.api_key || ''}
                        onChange={(e) => handleInputChange('api_key', e.target.value)}
                        placeholder="sk-ant-..."
                        disabled={loading}
                        className="pr-12 [&::-webkit-credentials-auto-fill-button]:!hidden [&::-ms-reveal]:!hidden"
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-8 w-10 p-0 bg-transparent hover:bg-muted/20"
                        onClick={() => setShowTokens(!showTokens)}
                      >
                        {showTokens ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      对应 ANTHROPIC_API_KEY 环境变量
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="model">模型名称</Label>
                <Input
                  id="model"
                  value={formData.model || ''}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  placeholder="claude-3-5-sonnet-20241022 (可选)"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  部分代理商需要指定特定的模型名称
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="small_fast_model">Haiku 类模型名称</Label>
                <Input
                  id="small_fast_model"
                  value={formData.small_fast_model || ''}
                  onChange={(e) => handleInputChange('small_fast_model', e.target.value)}
                  placeholder="claude-3-5-haiku-20241022 (可选)"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  对应 ANTHROPIC_SMALL_FAST_MODEL 环境变量
                </p>
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? '更新中...' : '添加中...'}
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? '更新配置' : '添加配置'}
                </>
              )}
            </Button>
          </div>
        
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
      </form>
  );
}