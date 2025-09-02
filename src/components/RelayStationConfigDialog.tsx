import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { 
  Settings, 
  Globe, 
  Key, 
  Plus, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Save,
  X,
  Info,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api, type RelayStation } from '@/lib/api';
//import { useTranslation } from '@/hooks/useTranslation';

// API端点信息接口 (从api_status.har中解析)
interface ApiEndpoint {
  id: number;
  route: string;
  url: string;
  description: string;
  color: string;
}

// 配置数据接口
interface RelayStationConfig {
  stationId: string;
  stationName: string;
  apiEndpoint: string;
  customEndpoint?: string;
  path?: string;
  token: string; // 只读
  model?: string;
  saveToStation: boolean; // 是否按中转站保存配置
}

interface RelayStationConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: RelayStation;
  selectedToken?: any; // 预选择的令牌
  onConfigApplied: () => void;
}

const RelayStationConfigDialog: React.FC<RelayStationConfigDialogProps> = ({
  open,
  onOpenChange,
  station,
  selectedToken: preselectedToken,
  onConfigApplied
}) => {
  //const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [availableTokens, setAvailableTokens] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<RelayStationConfig>({
    stationId: station.id,
    stationName: station.name,
    apiEndpoint: station.api_url,
    customEndpoint: '',
    path: '',
    token: '',
    model: '',
    saveToStation: false
  });

  // 获取当前配置
  useEffect(() => {
    if (open) {
      loadCurrentConfig();
      loadApiEndpoints();
      loadAvailableTokens();
    }
  }, [open, station.id, preselectedToken]);

  // 当预选择的令牌改变时，重置令牌选择
  useEffect(() => {
    if (preselectedToken && availableTokens.length > 0) {
      const foundToken = availableTokens.find(t => t.id === preselectedToken.id);
      if (foundToken) {
        setSelectedToken(foundToken.id);
        setFormData(prev => ({
          ...prev,
          token: `sk-${foundToken.token}`
        }));
      }
    }
  }, [preselectedToken, availableTokens]);

  const loadCurrentConfig = async () => {
    try {
      // 首先尝试加载保存的中转站配置
      const savedConfig = await api.getStationConfig(station.id);
      
      // 然后获取当前系统配置
      const currentConfig = await api.getCurrentProviderConfig();
      
      setFormData(prev => ({
        ...prev,
        // 使用保存的配置或回退到当前系统配置
        apiEndpoint: savedConfig?.api_endpoint || currentConfig.anthropic_base_url || station.api_url,
        customEndpoint: savedConfig?.custom_endpoint || '',
        path: savedConfig?.path || '',
        model: savedConfig?.model || currentConfig.anthropic_model || '',
        // 对于自定义中转站，优先使用station.system_token，否则使用当前配置的token
        token: station.adapter === 'custom' ? station.system_token : (currentConfig.anthropic_auth_token || ''),
        // 如果有保存的配置，默认勾选保存选项
        saveToStation: !!savedConfig
      }));
    } catch (error) {
      console.error('Failed to load current config:', error);
      // 如果加载失败，使用基本的默认值
      setFormData(prev => ({
        ...prev,
        apiEndpoint: station.api_url,
        // 对于自定义中转站，使用system_token
        token: station.adapter === 'custom' ? station.system_token : '',
        model: '',
        saveToStation: false
      }));
    }
  };

  const loadApiEndpoints = async () => {
    setLoadingEndpoints(true);
    try {
      // 从中转站获取API状态信息
      const endpoints = await api.loadStationApiEndpoints(station.id);
      console.debug('Raw API endpoints from backend:', endpoints);
      
      if (!endpoints || endpoints.length === 0) {
        console.warn('No API endpoints returned from backend, using default');
        setApiEndpoints([{
          id: 0,
          route: '默认端点',
          url: station.api_url,
          description: '当前配置的端点',
          color: 'blue'
        }]);
        return;
      }
      
      // 去重处理：基于URL去重，保留第一个出现的端点
      const uniqueEndpoints = endpoints.filter((endpoint, index, self) => 
        index === self.findIndex(e => e.url === endpoint.url)
      );
      
      console.debug('Unique API endpoints after deduplication:', uniqueEndpoints);
      setApiEndpoints(uniqueEndpoints);
    } catch (error) {
      console.error('Failed to load API endpoints:', error);
      // 使用默认端点
      setApiEndpoints([{
        id: 0,
        route: '默认端点',
        url: station.api_url,
        description: '当前配置的端点',
        color: 'blue'
      }]);
    } finally {
      setLoadingEndpoints(false);
    }
  };

  const loadAvailableTokens = async () => {
    try {
      if (station.adapter !== 'custom') {
        const tokenResponse = await api.listStationTokens(station.id, 1, 50);
        setAvailableTokens(tokenResponse.items);
        
        // 如果有预选择的令牌，优先使用它
        if (preselectedToken && tokenResponse.items.length > 0) {
          const foundToken = tokenResponse.items.find(t => t.id === preselectedToken.id);
          if (foundToken) {
            setSelectedToken(foundToken.id);
            setFormData(prev => ({
              ...prev,
              token: `sk-${foundToken.token}`
            }));
            return;
          }
        }
        
        // 如果没有预选择令牌，且当前没有选择令牌，选择第一个启用的令牌
        if (tokenResponse.items.length > 0 && !formData.token) {
          const enabledToken = tokenResponse.items.find(t => t.enabled) || tokenResponse.items[0];
          setSelectedToken(enabledToken.id);
          setFormData(prev => ({
            ...prev,
            token: `sk-${enabledToken.token}`
          }));
        }
      } else {
        // 对于自定义类型的中转站，使用system_token
        setFormData(prev => ({
          ...prev,
          token: station.system_token
        }));
      }
    } catch (error) {
      console.error('Failed to load available tokens:', error);
    }
  };

  const handleEndpointChange = (value: string) => {
    if (value === 'custom') {
      setFormData(prev => ({ ...prev, apiEndpoint: 'custom', customEndpoint: '' }));
    } else {
      //const endpoint = apiEndpoints.find(ep => ep.url === value);
      setFormData(prev => ({ 
        ...prev, 
        apiEndpoint: value,
        customEndpoint: ''
      }));
    }
  };

  const handleTokenChange = (tokenId: string) => {
    const token = availableTokens.find(t => t.id === tokenId);
    if (token) {
      setSelectedToken(tokenId);
      setFormData(prev => ({
        ...prev,
        token: `sk-${token.token}`
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 构建最终的API端点URL
      let finalApiUrl = formData.apiEndpoint;
      if (formData.apiEndpoint === 'custom' && formData.customEndpoint) {
        finalApiUrl = formData.customEndpoint;
      }

      // 添加路径
      if (formData.path) {
        finalApiUrl = finalApiUrl.endsWith('/') 
          ? finalApiUrl + formData.path.replace(/^\//, '')
          : finalApiUrl + '/' + formData.path.replace(/^\//, '');
      }

      // 创建代理商配置
      const providerConfig = {
        id: `relay-${station.id}-${Date.now()}`,
        name: `${station.name} - 配置`,
        description: `从中转站 ${station.name} 应用的配置`,
        base_url: finalApiUrl,
        auth_token: formData.token,
        model: formData.model || undefined
      };

      // 应用配置
      await api.switchProviderConfig(providerConfig);

      // 如果选择保存到中转站，保存配置
      if (formData.saveToStation) {
        const configRequest = {
          station_id: station.id,
          api_endpoint: formData.apiEndpoint === 'custom' ? formData.customEndpoint || '' : formData.apiEndpoint,
          custom_endpoint: formData.apiEndpoint === 'custom' ? formData.customEndpoint : undefined,
          path: formData.path || undefined,
          model: formData.model || undefined
        };
        
        await api.saveStationConfig(configRequest);
      }

      // 记录配置使用状态
      await api.recordConfigUsage(station.id, finalApiUrl, formData.token);

      onConfigApplied();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to apply configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    const hasValidEndpoint = formData.apiEndpoint && 
      (formData.apiEndpoint !== 'custom' || formData.customEndpoint);
    const hasToken = formData.token;
    return hasValidEndpoint && hasToken;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            配置中转站
          </DialogTitle>
          <DialogDescription>
            为 {station.name} 配置详细的连接参数
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>中转站名称</Label>
                  <Input value={formData.stationName} disabled />
                </div>
                <div className="space-y-2">
                  <Label>中转站类型</Label>
                  <div className="flex items-center h-10">
                    <Badge variant="outline">
                      {station.adapter === 'custom' ? '自定义' : station.adapter.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                API配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API端点选择 */}
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API端点</Label>
                <div className="flex gap-2">
                  <Select value={formData.apiEndpoint} onValueChange={handleEndpointChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择API端点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={station.api_url}>
                        默认端点 ({station.api_url})
                      </SelectItem>
                      {apiEndpoints.map((endpoint) => (
                        <SelectItem key={endpoint.url} value={endpoint.url}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full bg-${endpoint.color}-500`} />
                            <span className="font-medium">{endpoint.route}</span>
                            <span className="text-xs text-muted-foreground">
                              ({endpoint.description})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          自定义端点
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={loadApiEndpoints}
                    disabled={loadingEndpoints}
                  >
                    {loadingEndpoints ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 自定义端点输入 */}
              {formData.apiEndpoint === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-endpoint">自定义端点URL</Label>
                  <Input
                    id="custom-endpoint"
                    value={formData.customEndpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="https://your-api-endpoint.com"
                    required
                  />
                </div>
              )}

              {/* 路径 */}
              <div className="space-y-2">
                <Label htmlFor="path">路径 (可选)</Label>
                <Input
                  id="path"
                  value={formData.path}
                  onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                  placeholder="/v1 或自定义路径"
                />
              </div>

              {/* 模型 */}
              <div className="space-y-2">
                <Label htmlFor="model">模型 (可选)</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="claude-3-5-sonnet-20241022"
                />
                <p className="text-xs text-muted-foreground">
                  将设置为 ANTHROPIC_MODEL 环境变量
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 令牌配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                令牌配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {station.adapter !== 'custom' && availableTokens.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="token-select">选择令牌</Label>
                  <Select value={selectedToken} onValueChange={handleTokenChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择一个令牌" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTokens.map((token) => (
                        <SelectItem key={token.id} value={token.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{token.name}</span>
                            {token.group && (
                              <Badge variant="outline" className="text-xs">
                                {token.group}
                              </Badge>
                            )}
                            {!token.enabled && (
                              <Badge variant="destructive" className="text-xs">
                                已禁用
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="token">令牌值 (只读)</Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={formData.token}
                    disabled
                    className="bg-muted/50"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? (
                      <EyeOff className="h-3 w-3 hover:!text-blue-500" />
                    ) : (
                      <Eye className="h-3 w-3 hover:!text-blue-500" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  此令牌将用于API认证
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 保存选项 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 leading-none">
                  <Label htmlFor="save-to-station" className="text-sm font-medium leading-none">
                    保存配置到中转站
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    将此配置保存为该中转站的默认配置，下次应用时自动使用这些设置
                  </p>
                </div>
                <Switch
                  id="save-to-station"
                  checked={formData.saveToStation}
                  onCheckedChange={(checked: boolean) => 
                    setFormData(prev => ({ ...prev, saveToStation: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormValid()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? '应用中...' : '应用配置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RelayStationConfigDialog;