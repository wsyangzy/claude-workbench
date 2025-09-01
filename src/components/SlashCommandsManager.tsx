import React, { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Trash2, 
  Edit,
  Save,
  Command,
  Globe,
  FolderOpen,
  Terminal,
  FileCode,
  Zap,
  Code,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api, type SlashCommand } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { COMMON_TOOL_MATCHERS } from "@/types/hooks";

interface SlashCommandsManagerProps {
  projectPath?: string;
  className?: string;
  scopeFilter?: 'project' | 'user' | 'all';
}

interface CommandForm {
  name: string;
  namespace: string;
  content: string;
  description: string;
  allowedTools: string[];
  scope: 'project' | 'user';
}

const EXAMPLE_COMMANDS = [
  {
    name: "review",
    description: "Review code for best practices",
    content: "Review the following code for best practices, potential issues, and improvements:\n\n@$ARGUMENTS",
    allowedTools: ["Read", "Grep"]
  },
  {
    name: "explain",
    description: "Explain how something works",
    content: "Explain how $ARGUMENTS works in detail, including its purpose, implementation, and usage examples.",
    allowedTools: ["Read", "Grep", "WebSearch"]
  },
  {
    name: "fix-issue",
    description: "Fix a specific issue",
    content: "Fix issue #$ARGUMENTS following our coding standards and best practices.",
    allowedTools: ["Read", "Edit", "MultiEdit", "Write"]
  },
  {
    name: "test",
    description: "Write tests for code",
    content: "Write comprehensive tests for:\n\n@$ARGUMENTS\n\nInclude unit tests, edge cases, and integration tests where appropriate.",
    allowedTools: ["Read", "Write", "Edit"]
  }
];

// Get icon for command based on its properties
const getCommandIcon = (command: SlashCommand) => {
  if (command.has_bash_commands) return Terminal;
  if (command.has_file_references) return FileCode;
  if (command.accepts_arguments) return Zap;
  if (command.scope === "project") return FolderOpen;
  if (command.scope === "user") return Globe;
  return Command;
};

/**
 * SlashCommandsManager component for managing custom slash commands
 * Provides a no-code interface for creating, editing, and deleting commands
 */
export const SlashCommandsManager: React.FC<SlashCommandsManagerProps> = ({
  projectPath,
  className,
  scopeFilter = 'all',
}) => {
  const { t } = useTranslation();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScope, setSelectedScope] = useState<'all' | 'project' | 'user'>(scopeFilter === 'all' ? 'all' : scopeFilter as 'project' | 'user');
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SlashCommand | null>(null);
  const [commandForm, setCommandForm] = useState<CommandForm>({
    name: "",
    namespace: "",
    content: "",
    description: "",
    allowedTools: [],
    scope: 'user'
  });

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commandToDelete, setCommandToDelete] = useState<SlashCommand | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load commands on mount
  useEffect(() => {
    loadCommands();
  }, [projectPath]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedCommands = await api.slashCommandsList(projectPath);
      setCommands(loadedCommands);
    } catch (err) {
      console.error("Failed to load slash commands:", err);
      setError(t('common.loadCommandsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingCommand(null);
    setCommandForm({
      name: "",
      namespace: "",
      content: "",
      description: "",
      allowedTools: [],
      scope: scopeFilter !== 'all' ? scopeFilter : (projectPath ? 'project' : 'user')
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (command: SlashCommand) => {
    setEditingCommand(command);
    setCommandForm({
      name: command.name,
      namespace: command.namespace || "",
      content: command.content,
      description: command.description || "",
      allowedTools: command.allowed_tools,
      scope: command.scope as 'project' | 'user'
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await api.slashCommandSave(
        commandForm.scope,
        commandForm.name,
        commandForm.namespace || undefined,
        commandForm.content,
        commandForm.description || undefined,
        commandForm.allowedTools,
        commandForm.scope === 'project' ? projectPath : undefined
      );

      setEditDialogOpen(false);
      await loadCommands();
    } catch (err) {
      console.error("Failed to save command:", err);
      setError(err instanceof Error ? err.message : t('common.saveCommandFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (command: SlashCommand) => {
    setCommandToDelete(command);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!commandToDelete) return;

    try {
      setDeleting(true);
      setError(null);
      await api.slashCommandDelete(commandToDelete.id, projectPath);
      setDeleteDialogOpen(false);
      setCommandToDelete(null);
      await loadCommands();
    } catch (err) {
      console.error("Failed to delete command:", err);
      const errorMessage = err instanceof Error ? err.message : t('common.deleteCommandFailed');
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setCommandToDelete(null);
  };

  const toggleExpanded = (commandId: string) => {
    setExpandedCommands(prev => {
      const next = new Set(prev);
      if (next.has(commandId)) {
        next.delete(commandId);
      } else {
        next.add(commandId);
      }
      return next;
    });
  };

  // 强制重新渲染的状态
  const [forceRender, setForceRender] = useState(0);

  const handleToolToggle = useCallback((tool: string) => {
    setCommandForm(prev => ({
      ...prev,
      allowedTools: prev.allowedTools.includes(tool)
        ? prev.allowedTools.filter(t => t !== tool)
        : [...prev.allowedTools, tool]
    }));
    
    // 强制立即重新渲染
    setForceRender(prev => prev + 1);
  }, []);

  const applyExample = (example: typeof EXAMPLE_COMMANDS[0]) => {
    setCommandForm(prev => ({
      ...prev,
      name: example.name,
      description: example.description,
      content: example.content,
      allowedTools: example.allowedTools
    }));
  };

  // Filter commands
  const filteredCommands = commands.filter(cmd => {
    // Hide default commands
    if (cmd.scope === 'default') {
      return false;
    }

    // Apply scopeFilter if set to specific scope
    if (scopeFilter !== 'all' && cmd.scope !== scopeFilter) {
      return false;
    }

    // Scope filter
    if (selectedScope !== 'all' && cmd.scope !== selectedScope) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cmd.name.toLowerCase().includes(query) ||
        cmd.full_command.toLowerCase().includes(query) ||
        (cmd.description && cmd.description.toLowerCase().includes(query)) ||
        (cmd.namespace && cmd.namespace.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // Group commands by namespace and scope
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const key = cmd.namespace 
      ? `${cmd.namespace} (${cmd.scope})` 
      : `${cmd.scope === 'project' ? t('common.projectCommands') : t('common.userCommands')}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cmd);
    return acc;
  }, {} as Record<string, SlashCommand[]>);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {scopeFilter === 'project' ? t('common.projectSlashCommands') : t('common.slashCommands')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {scopeFilter === 'project' 
              ? t('common.createCustomCommandsForProject')
              : t('common.createCustomCommandsWorkflow')}
          </p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="gap-2 hover:!text-gray-400 dark:hover:!text-gray-300">
          <Plus className="h-4 w-4" />
          {t('common.newCommand')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('common.searchCommands')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {scopeFilter === 'all' && (
          <Select value={selectedScope} onValueChange={(value: any) => setSelectedScope(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allCommands')}</SelectItem>
              <SelectItem value="project">{t('common.project')}</SelectItem>
              <SelectItem value="user">{t('common.user')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Commands List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCommands.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Command className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? t('common.commandsNotFound')
                : scopeFilter === 'project' 
                  ? t('common.noProjectCommandsYet')
                  : t('common.noCommandsYet')}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateNew} variant="outline" size="sm" className="mt-4">
                {scopeFilter === 'project' 
                  ? t('common.createFirstProjectCommand')
                  : t('common.createFirstCommand')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedCommands).map(([groupKey, groupCommands]) => (
            <Card key={groupKey} className="overflow-hidden">
              <div className="p-4 bg-muted/50 border-b">
                <h4 className="text-sm font-medium">
                  {groupKey}
                </h4>
              </div>
              
              <div className="divide-y">
                {groupCommands.map((command) => {
                  const Icon = getCommandIcon(command);
                  const isExpanded = expandedCommands.has(command.id);
                  
                  return (
                    <div key={command.id}>
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono text-primary">
                                {command.full_command}
                              </code>
                              {command.accepts_arguments && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('common.arguments')}
                                </Badge>
                              )}
                            </div>
                            
                            {command.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {command.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs">
                              {command.allowed_tools.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {t('common.toolsCount', { count: command.allowed_tools.length })}
                                  </span>
                              )}
                              
                              {command.has_bash_commands && (
                                <Badge variant="outline" className="text-xs">
                                  {t('common.file')}
                                </Badge>
                              )}
                              
                              {command.has_file_references && (
                                <Badge variant="outline" className="text-xs">
                                  {t('common.file')}
                                </Badge>
                              )}
                              
                              <button
                                onClick={() => toggleExpanded(command.id)}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {t('common.hideContent')}
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-3 w-3" />
                                    {t('common.showContent')}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(command)}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(command)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 hover:!text-red-600" />
                            </Button>
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                  {command.content}
                                </pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? t('common.editCommand') : t('common.createNewCommand')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {/* Scope */}
            <div className="space-y-2">
              <Label>{t('common.scope')}</Label>
              <Select 
                value={commandForm.scope} 
                onValueChange={(value: 'project' | 'user') => setCommandForm(prev => ({ ...prev, scope: value }))}
                disabled={scopeFilter !== 'all' || (!projectPath && commandForm.scope === 'project')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(scopeFilter === 'all' || scopeFilter === 'user') && (
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        {t('common.userGlobal')}
                      </div>
                    </SelectItem>
                  )}
                  {(scopeFilter === 'all' || scopeFilter === 'project') && (
                    <SelectItem value="project" disabled={!projectPath}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {t('common.project')}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {commandForm.scope === 'user' 
                  ? t('common.availableInAllProjects')
                  : t('common.availableOnlyInThisProject')}
              </p>
            </div>

            {/* Name and Namespace */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('common.commandNameRequired')}</Label>
                <Input
                  placeholder={t('common.commandName')}
                  value={commandForm.name}
                  onChange={(e) => setCommandForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('common.commandNamespace')}</Label>
                <Input
                  placeholder={t('common.commandCategory')}
                  value={commandForm.namespace}
                  onChange={(e) => setCommandForm(prev => ({ ...prev, namespace: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t('common.descriptionOptional')}</Label>
              <Input
                placeholder={t('common.commandDescription')}
                value={commandForm.description}
                onChange={(e) => setCommandForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>{t('common.commandContentRequired')}</Label>
              <Textarea
                placeholder={t('common.commandPrompt')}
                value={commandForm.content}
                onChange={(e) => setCommandForm(prev => ({ ...prev, content: e.target.value }))}
                className="min-h-[150px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{
                __html: t('common.argumentsUsage')
              }} />
            </div>

            {/* Allowed Tools */}
            <div className="space-y-2">
              <Label>{t('common.allowedTools')}</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TOOL_MATCHERS.map((tool) => (
                  <Button
                    key={`${tool}-${forceRender}`}
                    variant={commandForm.allowedTools.includes(tool) ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => handleToolToggle(tool)}
                    type="button"
                    className="transition-none"
                  >
                    {tool}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('common.selectToolsForClaude')}
              </p>
            </div>

            {/* Examples */}
            {!editingCommand && (
              <div className="space-y-2">
                <Label>{t('common.examples')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXAMPLE_COMMANDS.map((example) => (
                    <Button
                      key={example.name}
                      variant="outline"
                      size="sm"
                      onClick={() => applyExample(example)}
                      className="justify-start"
                    >
                      <Code className="h-4 w-4 mr-2" />
                      {example.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {commandForm.name && (
              <div className="space-y-2">
                <Label>{t('common.preview')}</Label>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">
                    /
                    {commandForm.namespace && `${commandForm.namespace}:`}
                    {commandForm.name}
                    {commandForm.content.includes('$ARGUMENTS') && ` ${t('common.argumentsPlaceholder')}`}
                  </code>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="hover:!text-red-600"
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!commandForm.name || !commandForm.content || saving}
              className="hover:!text-gray-400 dark:hover:!text-gray-300"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('buttons.save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.deleteCommand')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p>{t('common.confirmDeleteCommand')}</p>
            {commandToDelete && (
              <div className="p-3 bg-muted rounded-md">
                <code className="text-sm font-mono">{commandToDelete.full_command}</code>
                {commandToDelete.description && (
                  <p className="text-sm text-muted-foreground mt-1">{commandToDelete.description}</p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('common.actionCannotBeUndone')}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={deleting}>
              {t('buttons.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2 hover:!text-red-600" />
                  {t('buttons.delete')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 
