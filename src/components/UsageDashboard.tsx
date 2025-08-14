import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type ApiBaseUrlUsage, type ProjectUsage, type UsageStats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Filter,
  Loader2,
  TrendingUp
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

interface TooltipData {
  date: string;
  total_cost: number;
  total_tokens: number;
  models_used: string[];
}

interface TooltipPortalProps {
  data: TooltipData | null;
  position: { x: number; y: number };
  formatCurrency: (amount: number) => string;
  formatTokens: (num: number) => string;
}

// Memoized Portal Tooltip Component - renders outside main component tree
const TooltipPortal = React.memo<TooltipPortalProps>(({ data, position, formatCurrency, formatTokens }) => {
  if (!data) return null;

  const date = new Date(data.date.replace(/-/g, '/'));
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  // Dynamic tooltip dimensions - calculate based on content
  const TOOLTIP_HEIGHT = 120;
  const OFFSET = 15; // Consistent offset for visual separation
  
  // Use a more compact fixed width
  const TOOLTIP_WIDTH = 140;
  
  let x, y;
  
  // Precise horizontal positioning - ensure minimum distance between tooltip edge and cursor
  const spaceOnRight = window.innerWidth - position.x;
  const spaceOnLeft = position.x;
  
  if (spaceOnRight >= TOOLTIP_WIDTH + OFFSET + 30) {
    // Enough space on right - tooltip starts OFFSET pixels to the right of cursor
    x = position.x + OFFSET;
  } else if (spaceOnLeft >= TOOLTIP_WIDTH + OFFSET + 30) {
    // Not enough space on right, use left - tooltip ends OFFSET pixels to the left of cursor  
    x = position.x - OFFSET - TOOLTIP_WIDTH;
  } else {
    // Extreme case - center tooltip
    x = Math.max(10, Math.min(position.x - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 10));
  }
  
  // Vertical positioning - always above cursor
  const spaceAbove = position.y;
  
  if (spaceAbove >= TOOLTIP_HEIGHT + OFFSET + 30) {
    // Display above - tooltip ends OFFSET pixels above cursor
    y = position.y - OFFSET - TOOLTIP_HEIGHT;
  } else {
    // Not enough space above - center tooltip vertically in available space
    y = Math.max(10, Math.min(position.y - TOOLTIP_HEIGHT / 2, window.innerHeight - TOOLTIP_HEIGHT - 10));
  }
  
  // Ensure tooltip stays within viewport bounds
  x = Math.max(10, Math.min(x, window.innerWidth - TOOLTIP_WIDTH - 10));
  y = Math.max(10, Math.min(y, window.innerHeight - TOOLTIP_HEIGHT - 10));

  return createPortal(
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translateZ(0)' // Force GPU layer to avoid reflows
      }}
    >
      <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap" style={{ width: `${TOOLTIP_WIDTH}px` }}>
        <p className="text-sm font-semibold">{formattedDate}</p>
        <p className="text-sm text-muted-foreground mt-1">
          成本： {formatCurrency(data.total_cost)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatTokens(data.total_tokens)} 个令牌
        </p>
        <p className="text-xs text-muted-foreground">
          {data.models_used.length} 个模型
        </p>
      </div>
    </div>,
    document.body // Render directly to body, outside component tree
  );
});

TooltipPortal.displayName = "TooltipPortal";

/**
 * UsageDashboard component - Displays Claude API usage statistics and costs
 * 
 * @example
 * <UsageDashboard onBack={() => setView('welcome')} />
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"all" | "7d" | "30d" | "today">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [apiBaseUrlStats, setApiBaseUrlStats] = useState<ApiBaseUrlUsage[] | null>(null);
  
  // Optimized tooltip state
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    loadUsageStats();
  }, [selectedDateRange]);

  const loadUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);

      let statsData: UsageStats;
      let sessionData: ProjectUsage[];
      let apiBaseUrlData: ApiBaseUrlUsage[];
      
      if (selectedDateRange === "today") {
        statsData = await api.getTodayUsageStats();
        sessionData = await api.getSessionStats();
        apiBaseUrlData = await api.getUsageByApiBaseUrl();
      } else if (selectedDateRange === "all") {
        statsData = await api.getUsageStats();
        sessionData = await api.getSessionStats();
        apiBaseUrlData = await api.getUsageByApiBaseUrl();
      } else {
        const endDate = new Date();
        const startDate = new Date();
        const days = selectedDateRange === "7d" ? 7 : 30;
        startDate.setDate(startDate.getDate() - days);
        
        const formatDateForApi = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        }

        statsData = await api.getUsageByDateRange(
          startDate.toISOString(),
          endDate.toISOString()
        );
        sessionData = await api.getSessionStats(
            formatDateForApi(startDate),
            formatDateForApi(endDate),
            'desc'
        );
        apiBaseUrlData = await api.getUsageByApiBaseUrl();
      }
      
      setStats(statsData);
      setSessionStats(sessionData);
      setApiBaseUrlStats(apiBaseUrlData);
    } catch (err) {
      console.error("Failed to load usage stats:", err);
      setError("加载使用统计数据失败。请重试。");
    } finally {
      setLoading(false);
    }
  };

  // Memoized formatting functions to prevent recreation
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  }, []);

  const formatNumber = useCallback((num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  }, []);

  const formatTokens = useCallback((num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  }, [formatNumber]);

  // Optimized mouse handlers that avoid DOM measurements
  const handleMouseEnter = useCallback((day: any, e: React.MouseEvent) => {
    setTooltipData({
      date: day.date,
      total_cost: day.total_cost,
      total_tokens: day.total_tokens,
      models_used: day.models_used
    });
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  const getModelDisplayName = useCallback((model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-4-opus": "Opus 4",
      "claude-4-sonnet": "Sonnet 4",
      "claude-3.5-sonnet": "Sonnet 3.5",
      "claude-3-opus": "Opus 3",
    };
    return modelMap[model] || model;
  }, []);

  const getModelColor = useCallback((model: string): string => {
    if (model.includes("opus")) return "text-purple-500";
    if (model.includes("sonnet")) return "text-blue-500";
    return "text-gray-500";
  }, []);

  // Memoized chart data to prevent recalculation
  const chartData = useMemo(() => {
    if (!stats?.by_date) return null;
    
    const maxCost = Math.max(...stats.by_date.map(d => d.total_cost), 0);
    const halfMaxCost = maxCost / 2;
    
    return {
      maxCost,
      halfMaxCost,
      dateData: stats.by_date.slice().reverse()
    };
  }, [stats?.by_date]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">使用情况仪表盘</h1>
              <p className="text-xs text-muted-foreground">
                追踪您的 Claude Code 使用情况和成本
              </p>
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(["all", "30d", "7d", "today"] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  className="text-xs"
                >
                  {range === "all" ? "所有时间" : range === "7d" ? "近 7 天" : range === "30d" ? "近 30 天" : "今天"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">正在加载使用统计数据...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={loadUsageStats} size="sm">
                重试
              </Button>
            </div>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Cost Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总成本</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(stats.total_cost)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Sessions Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总会话</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatNumber(stats.total_sessions)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Tokens Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总令牌</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatTokens(stats.total_tokens)}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Cost per Session Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">平均每会话成本</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        stats.total_sessions > 0 
                          ? stats.total_cost / stats.total_sessions 
                          : 0
                      )}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="models">按模型</TabsTrigger>
                <TabsTrigger value="projects">按项目</TabsTrigger>
                <TabsTrigger value="sessions">按会话</TabsTrigger>
                <TabsTrigger value="api-base-url">按API地址</TabsTrigger>
                <TabsTrigger value="timeline">时间线</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">令牌明细</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">输入令牌</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_input_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">输出令牌</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_output_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存写入</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_cache_creation_tokens)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">缓存读取</p>
                      <p className="text-lg font-semibold">{formatTokens(stats.total_cache_read_tokens)}</p>
                    </div>
                  </div>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">最常用模型</h3>
                    <div className="space-y-3">
                      {stats.by_model.slice(0, 3).map((model) => (
                        <div key={model.model} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={cn("text-xs", getModelColor(model.model))}>
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {model.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">热门项目</h3>
                    <div className="space-y-3">
                      {stats.by_project.slice(0, 3).map((project) => (
                        <div key={project.project_path} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium break-words" title={project.project_path}>
                              {project.project_path}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-medium flex-shrink-0">
                            {formatCurrency(project.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按模型使用情况</h3>
                  <div className="space-y-4">
                    {stats.by_model.map((model) => (
                      <div key={model.model} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getModelColor(model.model))}
                            >
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {model.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">输入： </span>
                            <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">输出： </span>
                            <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存写： </span>
                            <span className="font-medium">{formatTokens(model.cache_creation_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存读： </span>
                            <span className="font-medium">{formatTokens(model.cache_read_tokens)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按项目使用情况</h3>
                  <div className="space-y-3">
                    {stats.by_project.map((project) => (
                      <div key={project.project_path} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex flex-col truncate">
                          <span className="text-sm font-medium truncate" title={project.project_path}>
                            {project.project_path}
                          </span>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} 个会话
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTokens(project.total_tokens)} 个令牌
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(project.total_cost)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(project.total_cost / project.session_count)}/会话
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions">
                  <Card className="p-6">
                      <h3 className="text-sm font-semibold mb-4">按会话使用情况</h3>
                      <div className="space-y-3">
                          {sessionStats?.map((session) => (
                              <div key={`${session.project_path}-${session.project_name}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-4">
                                  <div className="flex flex-col min-w-0 flex-1">
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-xs font-mono text-muted-foreground truncate" title={session.project_path}>
                                            {session.project_path.split('/').slice(-2).join('/')}
                                        </span>
                                      </div>
                                      <span className="text-sm font-medium mt-1">
                                          {session.project_name}
                                      </span>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                      <p className="text-sm font-semibold">{formatCurrency(session.total_cost)}</p>
                                      <p className="text-xs text-muted-foreground">
                                          {new Date(session.last_used).toLocaleString('zh-CN', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: false
                                          })}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </Card>
              </TabsContent>

              {/* API Base URL Tab */}
              <TabsContent value="api-base-url">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">按API地址使用情况</h3>
                  <div className="space-y-4">
                    {apiBaseUrlStats?.map((apiUrlStat) => (
                      <div key={apiUrlStat.api_base_url} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs">
                              {apiUrlStat.api_base_url}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {apiUrlStat.session_count} 个会话
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(apiUrlStat.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">输入： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">输出： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存写： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.cache_creation_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">缓存读： </span>
                            <span className="font-medium">{formatTokens(apiUrlStat.cache_read_tokens)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>日常使用情况</span>
                  </h3>
                  {chartData ? (
                    <div className="relative pl-8 pr-4">
                      {/* Y-axis labels - aligned with actual chart area */}
                      <div className="absolute left-0 top-0 h-64 flex flex-col justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(chartData.maxCost)}</span>
                        <span>{formatCurrency(chartData.halfMaxCost)}</span>
                        <span>{formatCurrency(0)}</span>
                      </div>
                      
                      {/* Chart container - Isolated and optimized */}
                      <div 
                        className="flex items-end space-x-2 h-64 border-l border-b border-border pl-4 relative overflow-visible"
                        style={{
                          contain: 'layout style', // Use layout style containment to allow overflow
                          isolation: 'isolate', // Create new stacking context
                          marginBottom: '2rem' // Space for X-axis labels without affecting chart alignment
                        }}
                      >
                        {chartData.dateData.map((day) => {
                          const heightPercent = chartData.maxCost > 0 ? (day.total_cost / chartData.maxCost) * 100 : 0;
                          const date = new Date(day.date.replace(/-/g, '/'));
                          
                          return (
                            <div 
                              key={day.date} 
                              className="flex-1 h-full flex flex-col items-center justify-end relative"
                            >
                              {/* Bar with optimized mouse events */}
                              <div 
                                className="w-full bg-[#d97757] hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                                style={{ 
                                  height: `${heightPercent}%`,
                                  willChange: 'opacity' // Optimize for hover animation
                                }}
                                onMouseEnter={(e) => handleMouseEnter(day, e)}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                              />
                              
                              {/* X-axis label */}
                              <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap pointer-events-none">
                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* X-axis label */}
                      <div className="mt-6 text-center text-xs text-muted-foreground">
                        日常使用情况随时间变化
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      所选时期内无使用数据
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>

      {/* Portal tooltip - rendered outside main tree to avoid layout impact */}
      <TooltipPortal
        data={tooltipData}
        position={tooltipPosition}
        formatCurrency={formatCurrency}
        formatTokens={formatTokens}
      />
    </div>
  );
}; 