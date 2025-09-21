import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealTime, ImportProgress } from './useRealTime';

export interface ImportProgressState {
  imports: Map<string, ImportProgress>;
  activeImports: ImportProgress[];
  completedImports: ImportProgress[];
  failedImports: ImportProgress[];
  totalProgress: number;
  hasActiveImports: boolean;
}

export function useImportProgress() {
  const { events, connected, getImportProgress } = useRealTime({
    subscriptions: ['imports', 'notifications']
  });

  const [state, setState] = useState<ImportProgressState>({
    imports: new Map(),
    activeImports: [],
    completedImports: [],
    failedImports: [],
    totalProgress: 0,
    hasActiveImports: false
  });

  // Process import progress events
  useEffect(() => {
    const importEvents = events.filter(event => event.type === 'import_progress');

    if (importEvents.length === 0) return;

    setState(prevState => {
      const newImports = new Map(prevState.imports);
      
      importEvents.forEach(event => {
        const progress = event.data as ImportProgress;
        newImports.set(progress.uploadId, progress);
      });

      const allImports = Array.from(newImports.values());
      
      // Categorize imports
      const activeImports = allImports.filter(imp => 
        imp.status === 'uploading' || imp.status === 'processing'
      );
      
      const completedImports = allImports.filter(imp => 
        imp.status === 'completed'
      );
      
      const failedImports = allImports.filter(imp => 
        imp.status === 'failed'
      );

      // Calculate total progress for active imports
      const totalProgress = activeImports.length > 0
        ? activeImports.reduce((sum, imp) => sum + imp.progress, 0) / activeImports.length
        : 0;

      return {
        imports: newImports,
        activeImports,
        completedImports,
        failedImports,
        totalProgress,
        hasActiveImports: activeImports.length > 0
      };
    });
  }, [events]);

  // Get progress for specific upload
  const getProgressForUpload = useCallback((uploadId: string): ImportProgress | undefined => {
    return state.imports.get(uploadId) || getImportProgress(uploadId);
  }, [state.imports, getImportProgress]);

  // Get most recent import
  const mostRecentImport = useMemo(() => {
    const allImports = Array.from(state.imports.values());
    if (allImports.length === 0) return null;

    return allImports.reduce((most, current) => {
      // For imports without timestamps, treat as newer if they're active
      if (current.status === 'processing' || current.status === 'uploading') {
        return current;
      }
      return most;
    });
  }, [state.imports]);

  // Clear completed imports (keep for UI feedback)
  const clearCompleted = useCallback(() => {
    setState(prevState => {
      const newImports = new Map();
      
      // Keep only active and failed imports
      prevState.imports.forEach((progress, uploadId) => {
        if (progress.status !== 'completed') {
          newImports.set(uploadId, progress);
        }
      });

      const allImports = Array.from(newImports.values());
      
      const activeImports = allImports.filter(imp => 
        imp.status === 'uploading' || imp.status === 'processing'
      );
      
      const completedImports: ImportProgress[] = [];
      
      const failedImports = allImports.filter(imp => 
        imp.status === 'failed'
      );

      const totalProgress = activeImports.length > 0
        ? activeImports.reduce((sum, imp) => sum + imp.progress, 0) / activeImports.length
        : 0;

      return {
        imports: newImports,
        activeImports,
        completedImports,
        failedImports,
        totalProgress,
        hasActiveImports: activeImports.length > 0
      };
    });
  }, []);

  // Clear all imports
  const clearAll = useCallback(() => {
    setState({
      imports: new Map(),
      activeImports: [],
      completedImports: [],
      failedImports: [],
      totalProgress: 0,
      hasActiveImports: false
    });
  }, []);

  // Check if upload is in progress
  const isUploadInProgress = useCallback((uploadId: string): boolean => {
    const progress = getProgressForUpload(uploadId);
    return progress?.status === 'uploading' || progress?.status === 'processing' || false;
  }, [getProgressForUpload]);

  // Check if upload is completed
  const isUploadCompleted = useCallback((uploadId: string): boolean => {
    const progress = getProgressForUpload(uploadId);
    return progress?.status === 'completed' || false;
  }, [getProgressForUpload]);

  // Check if upload failed
  const isUploadFailed = useCallback((uploadId: string): boolean => {
    const progress = getProgressForUpload(uploadId);
    return progress?.status === 'failed' || false;
  }, [getProgressForUpload]);

  // Get summary stats
  const summary = useMemo(() => {
    const total = state.imports.size;
    const active = state.activeImports.length;
    const completed = state.completedImports.length;
    const failed = state.failedImports.length;

    return {
      total,
      active,
      completed,
      failed,
      successRate: total > 0 ? (completed / (completed + failed)) * 100 : 0
    };
  }, [state]);

  return {
    // State
    imports: state.imports,
    activeImports: state.activeImports,
    completedImports: state.completedImports,
    failedImports: state.failedImports,
    totalProgress: state.totalProgress,
    hasActiveImports: state.hasActiveImports,
    
    // Connection state
    connected,
    
    // Computed properties
    mostRecentImport,
    summary,
    
    // Methods
    getProgressForUpload,
    isUploadInProgress,
    isUploadCompleted,
    isUploadFailed,
    clearCompleted,
    clearAll,
    
    // Helper properties
    hasImports: state.imports.size > 0,
    hasCompletedImports: state.completedImports.length > 0,
    hasFailedImports: state.failedImports.length > 0,
  };
}