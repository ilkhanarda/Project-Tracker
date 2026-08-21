import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions, type StyleProp, type ViewStyle, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CheckCircle2, ChevronRight, Circle, Files, Folder, FolderPlus, GripVertical, Menu, Pencil, Pin, Plus, RefreshCw, Search, Trash2, X, User } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { Easing as ReanimatedEasing, LinearTransition, clamp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

import { useAuth } from '@/features/auth/AuthProvider';
import { useAppTheme } from '@/features/theme/ThemeProvider';
import { createProjectRequest, deleteProjectRequest, getProjectsRequest, updateProjectRequest, } from '@/features/projects/api';
import type { Project } from '@/features/projects/types';
import { createTaskRequest, deleteTaskRequest, getTasksRequest, reorderTasksRequest, updateTaskRequest, } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import type { Colors, ThemeName } from '@/lib/theme-colors';



const canRenderLiquidGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

type LiquidGlassSurfaceProps = {
  children: ReactNode;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  theme?: ThemeName;
  tintColor?: string;
};

function LiquidGlassSurface({ children, interactive = false, style, theme, tintColor }: LiquidGlassSurfaceProps) {
  const systemColorScheme = useColorScheme();
  const isDark = theme ? theme === 'dark' : systemColorScheme === 'dark';
  const resolvedTintColor = tintColor ?? (isDark ? 'rgba(30,30,30,0.78)' : 'rgba(255,255,255,0.18)');

  if (canRenderLiquidGlass) {
    return <GlassView glassEffectStyle="regular" isInteractive={interactive} style={style} tintColor={resolvedTintColor}>{children}</GlassView>;
  }
  return <BlurView experimentalBlurMethod="dimezisBlurView" intensity={15} style={[styles.glassFallback, isDark && styles.glassFallbackDark, style]} tint={isDark ? 'prominent' : 'prominent'}>{children}</BlurView>;
}

type FloatingMaskedHeaderProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollY: SharedValue<number>;
  theme: ThemeName;
};

function FloatingMaskedHeader({ children, contentStyle, scrollY, theme }: FloatingMaskedHeaderProps) {
  const blurAnimatedStyle = useAnimatedStyle(() => ({
    opacity: clamp(scrollY.value / 24, 0, 1),
  }));

  return (
    <View pointerEvents="box-none" style={styles.floatingHeaderLayer}>
      <Reanimated.View
        pointerEvents="none"
        style={[styles.floatingHeaderMaterial, blurAnimatedStyle]}>
        <MaskedView
          style={StyleSheet.absoluteFillObject}
          maskElement={
            <LinearGradient
              colors={['#000000', '#000000', 'rgba(0,0,0,0)']}
              locations={[0, 0.40, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          }>
          <BlurView
            intensity={15}
            style={StyleSheet.absoluteFillObject}
            tint={theme === 'dark' ? 'prominent' : 'prominent'}
          />
        </MaskedView>
      </Reanimated.View>

      <View style={[styles.floatingHeaderContent, contentStyle]}>{children}</View>
    </View>
  );
}

type FormModalProps = {
  canSubmit: boolean;
  children: ReactNode;
  colors: Colors;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  title: string;
  visible: boolean;
};

function FormModal({ canSubmit, children, colors, isSubmitting, onClose, onSubmit, submitLabel, title, visible }: FormModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalLayer}>
        <Pressable
          accessibilityLabel="Close dialog"
          onPress={onClose}
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} />
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable accessibilityLabel="Close dialog" onPress={onClose} style={({ pressed }) => [styles.modalClose, { backgroundColor: colors.cardMuted }, pressed && styles.pressed]}>
              <X color={colors.secondaryText} size={20} />
            </Pressable>
          </View>
          {children}
          <View style={styles.modalActions}>
            <Pressable disabled={isSubmitting} onPress={onClose} style={({ pressed }) => [styles.modalButton, { backgroundColor: colors.cardMuted }, pressed && styles.pressed]}>
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={!canSubmit || isSubmitting} onPress={onSubmit} style={({ pressed }) => [styles.modalButton, styles.modalSubmit, { backgroundColor: colors.primary }, (!canSubmit || isSubmitting) && styles.disabled, pressed && styles.pressed]}>
              {isSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={[styles.modalButtonText, styles.modalSubmitText]}>{submitLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const initialFor = (value: string) => value.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const TASK_ROW_STRIDE = 62;
const TASK_LAYOUT_TRANSITION = LinearTransition.springify().damping(20).stiffness(220);

type DraggableTaskRowProps = {
  colors: Colors;
  disabled: boolean;
  draftTitle: string;
  editMode: boolean;
  index: number;
  isDeleting: boolean;
  isUpdating: boolean;
  onChangeTitle: (taskId: number, title: string) => void;
  onDelete: (task: Task) => void;
  onDrop: () => void;
  onMovePreview: (taskId: number, targetIndex: number) => void;
  onToggle: (task: Task) => void;
  task: Task;
  taskCount: number;
  theme: ThemeName;
};

function DraggableTaskRow({ colors, disabled, draftTitle, editMode, index, isDeleting, isUpdating, onChangeTitle, onDelete, onDrop, onMovePreview, onToggle, task, taskCount, theme }: DraggableTaskRowProps) {
  const translateY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const currentIndex = useSharedValue(index);
  const lastTargetIndex = useSharedValue(index);
  const startAbsoluteY = useSharedValue(index * TASK_ROW_STRIDE);
  const didMove = useSharedValue(false);

  useEffect(() => {
    currentIndex.value = index;
  }, [currentIndex, index]);

  const dragGesture = Gesture.Pan()
    .enabled(editMode && !disabled)
    .activateAfterLongPress(90)
    .activeOffsetY([-3, 3])
    .onStart(() => {
      isDragging.value = true;
      currentIndex.value = index;
      lastTargetIndex.value = index;
      startAbsoluteY.value = index * TASK_ROW_STRIDE;
      didMove.value = false;
      dragScale.value = withTiming(1.025, { duration: 120 });
    })
    .onUpdate((event) => {
      const absoluteY = startAbsoluteY.value + event.translationY;
      const targetIndex = clamp(
        Math.round(absoluteY / TASK_ROW_STRIDE),
        0,
        taskCount - 1,
      );
      translateY.value = absoluteY - currentIndex.value * TASK_ROW_STRIDE;

      if (targetIndex !== lastTargetIndex.value) {
        lastTargetIndex.value = targetIndex;
        didMove.value = true;
        scheduleOnRN(onMovePreview, task.id, targetIndex);
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      translateY.value = withSpring(0, { damping: 20, stiffness: 240 });
      dragScale.value = withTiming(1, { duration: 150 });
      if (didMove.value) scheduleOnRN(onDrop);
    });
  const animatedStyle = useAnimatedStyle(() => ({
    zIndex: isDragging.value ? 30 : 0,
    transform: [
      { translateY: translateY.value },
      { scale: dragScale.value },
    ],
  }));

  return (
    <Reanimated.View layout={TASK_LAYOUT_TRANSITION} style={[styles.taskRowMotion, animatedStyle]}>
      <LiquidGlassSurface
        style={[styles.taskRow, { borderColor: task.completed ? colors.success : colors.border }]}
        theme={theme}
        tintColor={task.completed ? colors.successSoft : undefined}>
        {editMode ? (
          <>
            <Pressable
              accessibilityLabel={`Delete ${task.title}`}
              disabled={disabled}
              onPress={() => onDelete(task)}
              style={({ pressed }) => [styles.taskDeleteAction, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}>
              {isDeleting ? <ActivityIndicator color={colors.danger} size="small" /> : <Trash2 color={colors.danger} size={15} />}
              <Text style={[styles.taskDeleteActionText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
            <TextInput
              editable={!disabled}
              maxLength={300}
              onChangeText={(title) => onChangeTitle(task.id, title)}
              selectTextOnFocus
              style={[styles.taskEditInput, { color: colors.text }]}
              value={draftTitle}
            />
            <GestureDetector gesture={dragGesture}>
              <View
                accessibilityHint="Hold and drag to reorder"
                accessibilityLabel={`Reorder ${task.title}`}
                style={styles.taskDragHandle}>
                <GripVertical color={colors.secondaryText} size={20} />
              </View>
            </GestureDetector>
          </>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            disabled={disabled}
            onPress={() => onToggle(task)}
            style={styles.taskToggle}>
            {isUpdating
              ? <ActivityIndicator color={colors.primary} size="small" />
              : task.completed
                ? <CheckCircle2 color={colors.primary} size={21} />
                : <Circle color={colors.secondaryText} size={21} />}
            <Text
              numberOfLines={1}
              style={[
                styles.taskTitle,
                { color: task.completed ? colors.secondaryText : colors.text },
                task.completed && styles.completedTaskTitle,
              ]}>
              {task.title}
            </Text>
          </Pressable>
        )}
      </LiquidGlassSurface>
    </Reanimated.View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, theme } = useAppTheme();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [areProjectsOpen, setAreProjectsOpen] = useState(true);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isProjectEditing, setIsProjectEditing] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [isProjectCreating, setIsProjectCreating] = useState(false);
  const [isProjectUpdating, setIsProjectUpdating] = useState(false);
  const [isTaskCreating, setIsTaskCreating] = useState(false);
  const [isTaskReordering, setIsTaskReordering] = useState(false);
  const [isTaskEditMode, setIsTaskEditMode] = useState(false);
  const [isTaskEditSaving, setIsTaskEditSaving] = useState(false);
  const [taskTitleDrafts, setTaskTitleDrafts] = useState<Record<number, string>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [updatingPinnedProjectId, setUpdatingPinnedProjectId] = useState<number | null>(null);

  const [searchMorph] = useState(() => new Animated.Value(0));
  const projectSearchInputRef = useRef<TextInput>(null);
  const taskRequestId = useRef(0);
  const tasksRef = useRef<Task[]>([]);
  const taskOrderBeforeDragRef = useRef<Task[] | null>(null);
  const panelWidth = Math.min(screenWidth * 0.78, 360);
  const searchStartLeft = Math.max(16, panelWidth - 66);
  const searchTargetWidth = Math.max(180, screenWidth - 92);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const normalizedSearch = projectSearchQuery.trim().toLocaleLowerCase('tr-TR');
  const filteredProjects = useMemo(() => !normalizedSearch ? projects : projects.filter((project) => project.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch) || (project.description?.toLocaleLowerCase('tr-TR').includes(normalizedSearch) ?? false)), [normalizedSearch, projects]);
  const pinnedProjects = useMemo(() => filteredProjects.filter((project) => project.pinned), [filteredProjects]);
  const recentProjects = useMemo(() => filteredProjects.filter((project) => !project.pinned), [filteredProjects]);
  const isSelectedProjectCompleted = tasks.length > 0 && tasks.every((task) => task.completed);

  const drawerX = useSharedValue(0);
  const mainScrollY = useSharedValue(0);
  const drawerScrollY = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const drawerGesturesEnabled = !isSearchOpen;

  const openDrawerGesture = Gesture.Pan()
    .enabled(drawerGesturesEnabled && !isMenuOpen)
    .hitSlop({ left: 0, width: 24 })
    .activeOffsetX(16)
    .failOffsetY([-12, 12])
    .averageTouches(true)
    .enableTrackpadTwoFingerGesture(true)
    .onStart(() => {
      gestureStartX.value = drawerX.value;
    })
    .onUpdate((event) => {
      drawerX.value = clamp(
        gestureStartX.value + Math.max(0, event.translationX),
        0,
        panelWidth,
      );
    })
    .onEnd((event) => {
      const projectedX = drawerX.value + event.velocityX * 0.12;
      const shouldOpen = event.velocityX > 650 || projectedX > panelWidth * 0.42;

      drawerX.value = withSpring(
        shouldOpen ? panelWidth : 0,
        {
          damping: 24,
          stiffness: 220,
          overshootClamping: true,
        },
        (finished) => {
          if (finished && shouldOpen) scheduleOnRN(setIsMenuOpen, true);
        },
      );
    });

  const closeDrawerGesture = Gesture.Pan()
    .enabled(drawerGesturesEnabled && isMenuOpen)
    .activeOffsetX(-16)
    .failOffsetY([-14, 14])
    .averageTouches(true)
    .enableTrackpadTwoFingerGesture(true)
    .onStart(() => {
      gestureStartX.value = drawerX.value;
    })
    .onUpdate((event) => {
      drawerX.value = clamp(
        gestureStartX.value + Math.min(0, event.translationX),
        0,
        panelWidth,
      );
    })
    .onEnd((event) => {
      const projectedX = drawerX.value + event.velocityX * 0.12;
      const shouldStayOpen = event.velocityX >= -650 && projectedX >= panelWidth * 0.58;

      drawerX.value = withSpring(
        shouldStayOpen ? panelWidth : 0,
        {
          damping: 24,
          stiffness: 220,
          overshootClamping: true,
        },
        (finished) => {
          if (finished && !shouldStayOpen) scheduleOnRN(setIsMenuOpen, false);
        },
      );
    });

  const drawerGesture = isMenuOpen ? closeDrawerGesture : openDrawerGesture;

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await getProjectsRequest();
      setProjects(response);
      setSelectedProjectId((current) => current !== null && response.some((project) => project.id === current) ? current : (response[0]?.id ?? null));
    } catch (error) {
      setProjectsError(errorMessage(error, 'Projects could not be loaded.'));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async (projectId: number) => {
    const requestId = ++taskRequestId.current;
    setTasksLoading(true);
    setTasksError(null);
    try {
      const response = await getTasksRequest(projectId);
      if (taskRequestId.current === requestId) setTasks(response);
    } catch (error) {
      if (taskRequestId.current === requestId) setTasksError(errorMessage(error, 'Tasks could not be loaded.'));
    } finally {
      if (taskRequestId.current === requestId) setTasksLoading(false);
    }
  }, []);

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    borderRadius: drawerX.value > 0 ? 55 : 0,
    transform: [
      {
        translateX: drawerX.value,
      },
    ],
  }));

  const mainSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    borderRadius: drawerX.value > 0 ? 55 : 0,
  }));

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(drawerX.value, [0, panelWidth], [0.95, 1]),
      },
    ],
  }));

  const drawerScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      drawerScrollY.value = event.contentOffset.y;
    },
  });

  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      mainScrollY.value = event.contentOffset.y;
    },
  });

  // useEffect(() => {
  //   console.log('Liquid Glass check:', {
  //     platform: Platform.OS,
  //     version: Platform.Version,
  //     apiAvailable: isGlassEffectAPIAvailable(),
  //     liquidGlassAvailable: isLiquidGlassAvailable(),
  //     canRenderLiquidGlass,
  //   });
  // }, []);

  useEffect(() => {
    setIsProjectEditing(false);
    setEditProjectName('');
    setEditProjectDescription('');
    setIsTaskEditMode(false);
    setTaskTitleDrafts({});
  }, [selectedProjectId]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const focusTimer = setTimeout(() => projectSearchInputRef.current?.focus(), 240);
    return () => clearTimeout(focusTimer);
  }, [isSearchOpen]);

  useEffect(() => { if (user) void loadProjects(); }, [loadProjects, user]);
  useEffect(() => {
    if (selectedProjectId === null) {
      taskRequestId.current += 1;
      setTasks([]);
      setTasksLoading(false);
      setTasksError(null);
    } else {
      void loadTasks(selectedProjectId);
    }
  }, [loadTasks, selectedProjectId]);

  function openMenu() {
    setIsMenuOpen(true);
    drawerX.value = withTiming(panelWidth, {
      duration: 200,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }

  function closeMenu() {
    drawerX.value = withTiming(0, {
      duration: 200,
      easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic),
    }, (finished) => {
      if (finished) scheduleOnRN(setIsMenuOpen, false);
    });
  }

  function openProjectSearch() {
    searchMorph.stopAnimation();
    searchMorph.setValue(0);
    setIsSearchOpen(true);
    closeMenu();
    requestAnimationFrame(() => {
      Animated.timing(searchMorph, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }

  function closeProjectSearch(returnToMenu: boolean) {
    Keyboard.dismiss();
    searchMorph.stopAnimation();
    if (returnToMenu) openMenu();
    Animated.timing(searchMorph, {
      toValue: 0,
      duration: 340,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setIsSearchOpen(false);
      setProjectSearchQuery('');
    });
  }

  function selectSearchProject(projectId: number) {
    setSelectedProjectId(projectId);
    closeProjectSearch(false);
  }

  function selectProject(projectId: number) { setSelectedProjectId(projectId); closeMenu(); }
  function openProjectModalFromDrawer() { closeMenu(); setIsProjectModalOpen(true); }
  function closeProjectModal() { if (!isProjectCreating) { setIsProjectModalOpen(false); setNewProjectName(''); setNewProjectDescription(''); } }
  function closeTaskModal() { if (!isTaskCreating) { setIsTaskModalOpen(false); setNewTaskTitle(''); } }

  async function handleCreateProject() {
    const name = newProjectName.trim();
    const description = newProjectDescription.trim();
    if (!name || isProjectCreating) return;
    try {
      setIsProjectCreating(true);
      const project = await createProjectRequest({ name, description: description || undefined });
      setProjects((current) => [...current, project]);
      setSelectedProjectId(project.id);
      setProjectSearchQuery('');
      setAreProjectsOpen(true);
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
    } catch (error) { Alert.alert('Project could not be created', errorMessage(error, 'Unknown error.')); }
    finally { setIsProjectCreating(false); }
  }

  async function handleProjectPinnedChange(project: Project) {
    if (updatingPinnedProjectId !== null) return;
    try {
      setUpdatingPinnedProjectId(project.id);
      const updatedProject = await updateProjectRequest(project.id, { pinned: !project.pinned });
      setProjects((current) => current.map((item) => item.id === updatedProject.id ? updatedProject : item));
    } catch (error) {
      Alert.alert('Project could not be updated', errorMessage(error, 'Unknown error.'));
    } finally {
      setUpdatingPinnedProjectId(null);
    }
  }

  function startProjectEditing() {
    if (!selectedProject || isProjectUpdating) return;
    setEditProjectName(selectedProject.name);
    setEditProjectDescription(selectedProject.description ?? '');
    setIsProjectEditing(true);
  }

  function cancelProjectEditing() {
    if (isProjectUpdating) return;
    setIsProjectEditing(false);
    setEditProjectName('');
    setEditProjectDescription('');
  }

  async function handleSaveProject() {
    const name = editProjectName.trim();
    const description = editProjectDescription.trim();
    if (!selectedProject || !name || isProjectUpdating) return;

    try {
      setIsProjectUpdating(true);
      const updatedProject = await updateProjectRequest(selectedProject.id, {
        name,
        description,
      });
      setProjects((current) => current.map((project) => project.id === updatedProject.id ? updatedProject : project));
      setIsProjectEditing(false);
      setEditProjectName('');
      setEditProjectDescription('');
    } catch (error) {
      Alert.alert('Project could not be updated', errorMessage(error, 'Unknown error.'));
    } finally {
      setIsProjectUpdating(false);
    }
  }

  async function handleCreateTask() {
    const title = newTaskTitle.trim();
    if (!title || selectedProjectId === null || isTaskCreating) return;
    try {
      setIsTaskCreating(true);
      const task = await createTaskRequest(selectedProjectId, title);
      setTasks((current) => [...current, task]);
      setIsTaskModalOpen(false);
      setNewTaskTitle('');
    } catch (error) { Alert.alert('Task could not be created', errorMessage(error, 'Unknown error.')); }
    finally { setIsTaskCreating(false); }
  }

  async function handleTaskCompletedChange(task: Task) {
    if (selectedProjectId === null || updatingTaskId !== null || isTaskReordering) return;
    try {
      setUpdatingTaskId(task.id);
      const updatedTask = await updateTaskRequest(selectedProjectId, task.id, { completed: !task.completed });
      setTasks((current) => current.map((item) => item.id === updatedTask.id ? updatedTask : item));
    } catch (error) { Alert.alert('Task could not be updated', errorMessage(error, 'Unknown error.')); }
    finally { setUpdatingTaskId(null); }
  }

  async function performDeleteTask(taskId: number) {
    if (selectedProjectId === null) return;
    try {
      setDeletingTaskId(taskId);
      await deleteTaskRequest(selectedProjectId, taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setTaskTitleDrafts((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
    } catch (error) { Alert.alert('Task could not be deleted', errorMessage(error, 'Unknown error.')); }
    finally { setDeletingTaskId(null); }
  }

  function confirmDeleteTask(task: Task) {
    Alert.alert('Delete task?', `“${task.title}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDeleteTask(task.id) },
    ]);
  }

  function startTaskEditMode() {
    setTaskTitleDrafts(Object.fromEntries(tasks.map((task) => [task.id, task.title])));
    setIsTaskEditMode(true);
  }

  function handleTaskDraftChange(taskId: number, title: string) {
    setTaskTitleDrafts((current) => ({ ...current, [taskId]: title }));
  }

  async function finishTaskEditMode() {
    if (selectedProjectId === null || isTaskEditSaving || isTaskReordering) return;
    const normalizedDrafts = new Map(
      tasks.map((task) => [task.id, (taskTitleDrafts[task.id] ?? task.title).trim()]),
    );
    if ([...normalizedDrafts.values()].some((title) => title.length === 0)) {
      Alert.alert('Task title is required', 'Every task needs a title before editing can be completed.');
      return;
    }

    const changedTasks = tasks.filter((task) => normalizedDrafts.get(task.id) !== task.title);
    if (changedTasks.length === 0) {
      setIsTaskEditMode(false);
      setTaskTitleDrafts({});
      return;
    }

    try {
      setIsTaskEditSaving(true);
      const updatedTasks = await Promise.all(
        changedTasks.map((task) =>
          updateTaskRequest(selectedProjectId, task.id, {
            title: normalizedDrafts.get(task.id) ?? task.title,
          }),
        ),
      );
      const updatesById = new Map(updatedTasks.map((task) => [task.id, task]));
      setTasks((current) => current.map((task) => updatesById.get(task.id) ?? task));
      setIsTaskEditMode(false);
      setTaskTitleDrafts({});
    } catch (error) {
      Alert.alert('Tasks could not be updated', errorMessage(error, 'Unknown error.'));
    } finally {
      setIsTaskEditSaving(false);
    }
  }

  function handlePreviewTaskMove(taskId: number, targetIndex: number) {
    if (isTaskReordering) return;
    setTasks((current) => {
      const fromIndex = current.findIndex((task) => task.id === taskId);
      if (fromIndex < 0 || fromIndex === targetIndex) return current;
      if (!taskOrderBeforeDragRef.current) taskOrderBeforeDragRef.current = current;
      const reordered = [...current];
      const [movedTask] = reordered.splice(fromIndex, 1);
      if (!movedTask) return current;
      reordered.splice(targetIndex, 0, movedTask);
      const positioned = reordered.map((task, position) => ({ ...task, position }));
      tasksRef.current = positioned;
      return positioned;
    });
  }

  async function handleTaskDrop() {
    if (selectedProjectId === null || isTaskReordering) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (!taskOrderBeforeDragRef.current) return;
    const previousTasks = taskOrderBeforeDragRef.current;
    const reorderedTasks = tasksRef.current.map((task, position) => ({ ...task, position }));
    taskOrderBeforeDragRef.current = null;

    setIsTaskReordering(true);
    try {
      const persistedTasks = await reorderTasksRequest(
        selectedProjectId,
        reorderedTasks.map((task) => task.id),
      );
      tasksRef.current = persistedTasks;
      setTasks(persistedTasks);
    } catch (error) {
      tasksRef.current = previousTasks;
      setTasks(previousTasks);
      Alert.alert('Task order could not be saved', errorMessage(error, 'Unknown error.'));
    } finally {
      setIsTaskReordering(false);
    }
  }

  async function performDeleteProject(projectId: number) {
    try {
      setDeletingProjectId(projectId);
      await deleteProjectRequest(projectId);
      const remaining = projects.filter((project) => project.id !== projectId);
      setProjects(remaining);
      if (selectedProjectId === projectId) { setSelectedProjectId(remaining[0]?.id ?? null); setTasks([]); }
    } catch (error) { Alert.alert('Project could not be deleted', errorMessage(error, 'Unknown error.')); }
    finally { setDeletingProjectId(null); }
  }

  function confirmDeleteProject(project: Project) {
    Alert.alert('Delete project?', `“${project.name}” and all of its tasks will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDeleteProject(project.id) },
    ]);
  }

  function renderDrawerProject(project: Project) {
    const selected = project.id === selectedProjectId;
    const pinUpdating = updatingPinnedProjectId === project.id;

    return (
      <View key={project.id} style={[styles.drawerProjectRow, selected && { backgroundColor: colors.primarySoft }]}>
        <Pressable
          accessibilityState={{ selected }}
          onPress={() => selectProject(project.id)}
          style={({ pressed }) => [styles.drawerProjectSelect, pressed && styles.pressed]}>
          <View style={[styles.drawerProjectInitial, { backgroundColor: selected ? colors.primarySoft : colors.cardMuted, borderColor: selected ? colors.primaryBorder : colors.border }]}>
            <Text style={[styles.drawerProjectInitialText, { color: selected ? colors.primary : colors.secondaryText }]}>{initialFor(project.name)}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.drawerProjectName, { color: selected ? colors.primary : colors.text }]}>{project.name}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={project.pinned ? `Unpin ${project.name}` : `Pin ${project.name}`}
          disabled={updatingPinnedProjectId !== null}
          hitSlop={6}
          onPress={() => void handleProjectPinnedChange(project)}
          style={({ pressed }) => [styles.drawerPinButton, pressed && styles.pressed]}>
          {pinUpdating
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Pin color={project.pinned ? colors.primary : colors.secondaryText} fill={project.pinned ? colors.primary : 'transparent'} size={17} />}
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={drawerGesture}>
      <View style={[styles.screen, { backgroundColor: colors.appBackground }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Reanimated.View
          style={[
            styles.mainMotion,
            mainAnimatedStyle,
          ]}>
          <Reanimated.View style={[styles.mainSurface, { backgroundColor: colors.surface }, mainSurfaceAnimatedStyle]}>
            <View style={styles.fullScreen}>
              <FloatingMaskedHeader
                contentStyle={styles.dashboardHeaderContent}
                scrollY={mainScrollY}
                theme={theme}>
                <View style={styles.topBarLeft}>
                  <Pressable accessibilityLabel={isMenuOpen ? 'Close menu' : 'Open menu'} accessibilityState={{ expanded: isMenuOpen }} onPress={isMenuOpen ? closeMenu : openMenu} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
                    <LiquidGlassSurface interactive style={styles.roundButtonGlass} theme={theme}>{isMenuOpen ? <X color={colors.text} size={23} /> : <Menu color={colors.text} size={23} />}</LiquidGlassSurface>
                  </Pressable>
                  <Text numberOfLines={1} style={[styles.dashboardTitle, { color: colors.text }]}>Dashboard</Text>
                </View>
                <Pressable accessibilityLabel="Open account sheet" onPress={() => router.push('/dashboard/account')} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
                  <LiquidGlassSurface interactive style={styles.roundButtonGlass} theme={theme}><User color={colors.text} size={23} /></LiquidGlassSurface>
                </Pressable>
              </FloatingMaskedHeader>

              <Reanimated.ScrollView
                contentContainerStyle={[
                  styles.mainContent,
                  {
                    paddingTop: safeAreaInsets.top + 76,
                    paddingBottom: safeAreaInsets.bottom + 42,
                  },
                ]}
                directionalLockEnabled
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                onScroll={mainScrollHandler}
                scrollEventThrottle={16}
                scrollsToTop={!isMenuOpen && !isSearchOpen}
                showsVerticalScrollIndicator={false}>
                {projectsLoading ? (
                  <LiquidGlassSurface style={styles.fullState} theme={theme}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.secondaryText }]}>Projects loading...</Text></LiquidGlassSurface>
                ) : projectsError ? (
                  <LiquidGlassSurface style={styles.fullState} theme={theme}>
                    <Text style={[styles.stateText, { color: colors.danger }]}>{projectsError}</Text>
                    <Pressable onPress={() => void loadProjects()} style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}>
                      <LiquidGlassSurface interactive style={styles.retryActionGlass} theme={theme} tintColor={colors.primarySoft}>
                        <RefreshCw color={colors.primary} size={18} />
                        <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
                      </LiquidGlassSurface>
                    </Pressable>
                  </LiquidGlassSurface>
                ) : selectedProject ? (
                  <>
                    <View style={styles.breadcrumb}>
                      {/* <LiquidGlassSurface style={styles.breadcrumb} theme={theme}> */}
                      <Pressable onPress={() => { setAreProjectsOpen(true); openMenu(); }}><Text style={[styles.breadcrumbLink, { color: colors.secondaryText }]}>Projects</Text></Pressable>
                      <ChevronRight color={colors.secondaryText} size={15} />
                      <Text numberOfLines={1} style={[styles.breadcrumbCurrent, { color: colors.text }]}>{selectedProject.name}</Text>
                      {/* </LiquidGlassSurface> */}
                    </View>
                    <LiquidGlassSurface style={styles.projectHero} theme={theme}>
                      <View style={styles.projectHeroTop}>
                        <LiquidGlassSurface
                          style={[styles.projectInitialLarge, { borderColor: colors.primaryBorder }]}
                          theme={theme}
                          tintColor={colors.primarySoft}>
                          <Text style={[styles.projectInitialLargeText, { color: colors.primary }]}>{initialFor(isProjectEditing ? editProjectName : selectedProject.name)}</Text>
                        </LiquidGlassSurface>
                        <View style={styles.projectHeroDetails}>
                          <View style={styles.projectHeroHeading}>
                            <Text style={[styles.projectStatus, { color: colors.primary }]}>{isSelectedProjectCompleted ? 'COMPLETED PROJECT' : 'ACTIVE PROJECT'}</Text>
                            <Pressable
                              accessibilityLabel={isProjectEditing ? 'Cancel project editing' : 'Edit project'}
                              disabled={isProjectUpdating}
                              onPress={isProjectEditing ? cancelProjectEditing : startProjectEditing}
                              style={({ pressed }) => [styles.projectEditButton, pressed && styles.pressed]}>
                              <LiquidGlassSurface interactive style={styles.projectEditButtonGlass} theme={theme} tintColor={colors.cardMuted}>
                                {isProjectEditing ? <X color={colors.secondaryText} size={17} /> : <Pencil color={colors.text} size={16} />}
                              </LiquidGlassSurface>
                            </Pressable>
                          </View>
                          {!isProjectEditing && (
                            <>
                              <Text style={[styles.projectTitle, { color: colors.text }]}>{selectedProject.name}</Text>
                              <Text style={[styles.projectDescription, { color: colors.secondaryText }]}>{selectedProject.description?.trim() || 'No description'}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      {isProjectEditing && (
                        <View style={styles.projectEditForm}>
                          <Text style={[styles.projectEditLabel, { color: colors.secondaryText }]}>PROJECT NAME</Text>
                          <LiquidGlassSurface style={styles.projectEditField} theme={theme} tintColor={colors.cardMuted}>
                            <TextInput
                              autoFocus
                              editable={!isProjectUpdating}
                              maxLength={120}
                              onChangeText={setEditProjectName}
                              placeholder="Project name"
                              placeholderTextColor={colors.secondaryText}
                              returnKeyType="next"
                              style={[styles.projectEditInput, { color: colors.text }]}
                              value={editProjectName}
                            />
                          </LiquidGlassSurface>
                          <Text style={[styles.projectEditLabel, { color: colors.secondaryText }]}>DESCRIPTION</Text>
                          <LiquidGlassSurface style={[styles.projectEditField, styles.projectEditDescriptionField]} theme={theme} tintColor={colors.cardMuted}>
                            <TextInput
                              editable={!isProjectUpdating}
                              maxLength={2000}
                              multiline
                              onChangeText={setEditProjectDescription}
                              placeholder="Optional description"
                              placeholderTextColor={colors.secondaryText}
                              style={[styles.projectEditInput, styles.projectEditDescriptionInput, { color: colors.text }]}
                              textAlignVertical="top"
                              value={editProjectDescription}
                            />
                          </LiquidGlassSurface>
                          <View style={styles.projectEditActions}>
                            <Pressable disabled={isProjectUpdating} onPress={cancelProjectEditing} style={({ pressed }) => [styles.projectEditAction, pressed && styles.pressed]}>
                              <LiquidGlassSurface interactive style={styles.projectEditActionGlass} theme={theme} tintColor={colors.cardMuted}>
                                <Text style={[styles.projectEditActionText, { color: colors.secondaryText }]}>Cancel</Text>
                              </LiquidGlassSurface>
                            </Pressable>
                            <Pressable disabled={!editProjectName.trim() || isProjectUpdating} onPress={() => void handleSaveProject()} style={({ pressed }) => [styles.projectEditAction, (!editProjectName.trim() || isProjectUpdating) && styles.disabled, pressed && styles.pressed]}>
                              <LiquidGlassSurface interactive style={styles.projectEditActionGlass} theme={theme} tintColor={colors.primary}>
                                {isProjectUpdating ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Check color="#FFFFFF" size={17} />}
                                <Text style={[styles.projectEditActionText, styles.projectEditSaveText]}>Save</Text>
                              </LiquidGlassSurface>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </LiquidGlassSurface>

                    <LiquidGlassSurface style={styles.tasksCard} theme={theme}>
                      <View style={styles.tasksHeader}>
                        <View style={styles.tasksHeadingGroup}>
                          <Text style={[styles.tasksTitle, { color: colors.text }]}>Tasks</Text>
                          <LiquidGlassSurface style={styles.countBadge} theme={theme} tintColor={colors.cardMuted}>
                            <Text style={[styles.countBadgeText, { color: colors.secondaryText }]}>{tasks.length} Tasks</Text>
                          </LiquidGlassSurface>
                        </View>
                        <View style={styles.tasksHeaderActions}>
                          <Pressable
                            accessibilityLabel={isTaskEditMode ? 'Save task changes' : 'Edit tasks'}
                            disabled={tasks.length === 0 || isTaskEditSaving || isTaskReordering}
                            onPress={() => isTaskEditMode ? void finishTaskEditMode() : startTaskEditMode()}
                            style={({ pressed }) => [styles.taskEditModeButton, (tasks.length === 0 || isTaskEditSaving || isTaskReordering) && styles.disabled, pressed && styles.pressed]}>
                            <LiquidGlassSurface interactive style={styles.taskEditModeButtonGlass} theme={theme} tintColor={isTaskEditMode ? colors.primarySoft : colors.cardMuted}>
                              {isTaskEditSaving ? <ActivityIndicator color={colors.primary} size="small" /> : isTaskEditMode ? <Check color={colors.primary} size={18} /> : <Pencil color={colors.text} size={16} />}
                            </LiquidGlassSurface>
                          </Pressable>
                          {!isTaskEditMode && (
                            <Pressable onPress={() => setIsTaskModalOpen(true)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                              <LiquidGlassSurface interactive style={styles.primaryButtonGlass} theme={theme} tintColor={colors.primary}>
                                <Plus color="#FFF" size={18} />
                                <Text style={styles.primaryButtonText}>New Task</Text>
                              </LiquidGlassSurface>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      {isTaskEditMode && !tasksLoading && !tasksError && tasks.length > 0 && (
                        <Text style={[styles.taskReorderHint, { color: colors.secondaryText }]}>Edit titles, delete clearly, or drag the handle to reorder</Text>
                      )}
                      {tasksLoading ? (
                        <View style={styles.inlineState}><ActivityIndicator color={colors.primary} size="small" /><Text style={[styles.stateText, { color: colors.secondaryText }]}>Tasks loading...</Text></View>
                      ) : tasksError ? (
                        <View style={styles.inlineState}><Text style={[styles.stateText, { color: colors.danger }]}>{tasksError}</Text><Pressable onPress={() => void loadTasks(selectedProject.id)} style={({ pressed }) => [styles.iconRetry, pressed && styles.pressed]}><LiquidGlassSurface interactive style={styles.iconRetryGlass} theme={theme} tintColor={colors.primarySoft}><RefreshCw color={colors.primary} size={18} /></LiquidGlassSurface></Pressable></View>
                      ) : tasks.length === 0 ? (
                        <Text style={[styles.emptyTasks, { color: colors.secondaryText }]}>This project has no tasks.</Text>
                      ) : tasks.map((task, index) => (
                        <DraggableTaskRow
                          colors={colors}
                          disabled={updatingTaskId !== null || deletingTaskId !== null || isTaskReordering || isTaskEditSaving}
                          draftTitle={taskTitleDrafts[task.id] ?? task.title}
                          editMode={isTaskEditMode}
                          index={index}
                          isDeleting={deletingTaskId === task.id}
                          isUpdating={updatingTaskId === task.id}
                          key={task.id}
                          onChangeTitle={handleTaskDraftChange}
                          onDelete={confirmDeleteTask}
                          onDrop={() => void handleTaskDrop()}
                          onMovePreview={handlePreviewTaskMove}
                          onToggle={(selectedTask) => void handleTaskCompletedChange(selectedTask)}
                          task={task}
                          taskCount={tasks.length}
                          theme={theme}
                        />
                      ))}
                    </LiquidGlassSurface>

                    <Pressable disabled={deletingProjectId !== null} onPress={() => confirmDeleteProject(selectedProject)} style={({ pressed }) => [styles.deleteProjectButton, pressed && styles.pressed]}>
                      <LiquidGlassSurface interactive style={styles.deleteProjectButtonGlass} theme={theme} tintColor={colors.dangerSoft}>
                        {deletingProjectId === selectedProject.id ? <ActivityIndicator color={colors.danger} size="small" /> : <Trash2 color={colors.danger} size={19} />}
                        <Text style={[styles.deleteProjectText, { color: colors.danger }]}>{deletingProjectId === selectedProject.id ? 'Deleting...' : 'Delete Project'}</Text>
                      </LiquidGlassSurface>
                    </Pressable>
                  </>
                ) : (
                  <LiquidGlassSurface style={styles.fullState} theme={theme}><Files color={colors.secondaryText} size={38} /><Text style={[styles.stateTitle, { color: colors.text }]}>No project selected</Text><Text style={[styles.stateText, { color: colors.secondaryText }]}>Create a project to get started.</Text><Pressable onPress={() => setIsProjectModalOpen(true)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><LiquidGlassSurface interactive style={styles.primaryButtonGlass} theme={theme} tintColor={colors.primary}><Plus color="#FFF" size={18} /><Text style={styles.primaryButtonText}>New Project</Text></LiquidGlassSurface></Pressable></LiquidGlassSurface>
                )}
              </Reanimated.ScrollView>
            </View>
            {isMenuOpen && <Pressable accessibilityLabel="Close menu" onPress={closeMenu} style={styles.mainDismissArea} />}
          </Reanimated.View>
        </Reanimated.View>

        <View
          pointerEvents={isMenuOpen ? 'auto' : 'none'}
          style={[styles.drawerLayer, { backgroundColor: colors.drawerBackground }]}>
          <Reanimated.View style={[styles.drawer, { backgroundColor: colors.drawerBackground, width: panelWidth + 80 }, drawerAnimatedStyle]}>
            <View style={[
              styles.drawerSafeArea,
              { width: panelWidth + 32 }
            ]}>

              <Reanimated.ScrollView
                contentContainerStyle={[
                  styles.drawerContent,
                  {
                    paddingTop: safeAreaInsets.top + 76,
                    paddingBottom: safeAreaInsets.bottom + 104,
                  }
                ]}
                directionalLockEnabled
                keyboardDismissMode={
                  Platform.OS === 'ios' ? 'interactive' : 'on-drag'

                }
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                onScroll={drawerScrollHandler}
                scrollEventThrottle={16}
                scrollsToTop={isMenuOpen}
                showsVerticalScrollIndicator={false}
                style={styles.drawerScroll}>

                <View style={styles.drawerSection}>
                  <Text style={[styles.drawerSectionTitle, { color: colors.secondaryText }]}>Pinned</Text>
                  {pinnedProjects.length > 0
                    ? pinnedProjects.map(renderDrawerProject)
                    : <Text style={[styles.drawerSectionEmpty, { color: colors.secondaryText }]}>Pin a project for quick access.</Text>}
                </View>
                {recentProjects.length > 0 && (
                  <>
                    <Text style={[styles.drawerSectionTitle, styles.drawerRecentsTitle, { color: colors.secondaryText }]}>Recents</Text>
                    {recentProjects.map(renderDrawerProject)}
                  </>
                )}
                {/* <Pressable accessibilityState={{ expanded: areProjectsOpen }} onPress={() => setAreProjectsOpen((current) => !current)} style={({ pressed }) => [styles.drawerItem, pressed && styles.drawerItemPressed]}>
                  <View style={styles.drawerItemLabel}><Files color={colors.text} size={25} /><Text style={[styles.drawerItemText, { color: colors.text }]}>Projects</Text></View>
                  <ChevronDown color={colors.secondaryText} size={20} style={areProjectsOpen ? styles.chevronOpen : undefined} />
                </Pressable> */}
                {areProjectsOpen && <View style={styles.drawerProjects}>
                  {projectsLoading ? (
                    <View style={styles.drawerStatus}><ActivityIndicator color={colors.primary} size="small" /><Text style={[styles.drawerStatusText, { color: colors.secondaryText }]}>Loading...</Text></View>
                  ) : filteredProjects.length === 0 ? (
                    <Text style={[styles.drawerStatusText, { color: colors.secondaryText }]}>No projects found.</Text>
                  ) : (
                    <></>
                  )}
                </View>}
              </Reanimated.ScrollView>
              <FloatingMaskedHeader
                contentStyle={styles.drawerHeaderContent}
                scrollY={drawerScrollY}
                theme={theme}>
                <Text
                  numberOfLines={1}
                  style={[styles.drawerTitle, { color: colors.text }]}>
                  Project Tracking
                </Text>

                <Pressable
                  accessibilityLabel="Search projects"
                  onPress={openProjectSearch}
                  style={({ pressed }) => [
                    styles.roundButton, pressed && styles.pressed
                  ]}>
                  <LiquidGlassSurface
                    interactive
                    style={styles.roundButtonGlass}
                    theme={theme}>
                    <Search color={colors.text} size={23} />
                  </LiquidGlassSurface>
                </Pressable>
              </FloatingMaskedHeader>
              <Pressable
                accessibilityLabel="Add project"
                onPress={openProjectModalFromDrawer}
                style={({ pressed }) => [
                  styles.drawerAddProjectButton, pressed && styles.drawerAddProjectPressed
                ]}>
                <LiquidGlassSurface
                  interactive
                  style={[styles.drawerAddProjectGlass,]}
                  theme={theme}
                  tintColor={colors.primary}>
                  <FolderPlus color="#FFFFFF" size={22} />
                  <Text style={styles.drawerAddProjectText}>Add Project</Text>
                </LiquidGlassSurface>
              </Pressable>
            </View>
          </Reanimated.View>
        </View>

        {
          isSearchOpen && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.searchOverlay}>
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.appBackground, opacity: searchMorph }]}
              />

              <Animated.View
                style={[
                  styles.morphSearchBar,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [24, 28] }),
                    height: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [48, 56] }),
                    left: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [searchStartLeft, 16] }),
                    top: safeAreaInsets.top + 7,
                    width: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [48, searchTargetWidth] }),
                  },
                ]}>
                <Search color={colors.text} size={24} />
                <Animated.View style={[styles.morphSearchInputWrap, { opacity: searchMorph.interpolate({ inputRange: [0, 0.48, 1], outputRange: [0, 0, 1] }) }]}>
                  <TextInput
                    ref={projectSearchInputRef}
                    accessibilityLabel="Search projects"
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onChangeText={setProjectSearchQuery}
                    placeholder="Search"
                    placeholderTextColor={colors.secondaryText}
                    returnKeyType="search"
                    selectionColor={colors.primary}
                    style={[styles.morphSearchInput, { color: colors.text }]}
                    value={projectSearchQuery}
                  />
                </Animated.View>
              </Animated.View>

              <Animated.View
                style={[
                  styles.searchCloseWrap,
                  {
                    opacity: searchMorph.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] }),
                    top: safeAreaInsets.top + 7,
                    transform: [{ scale: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
                  },
                ]}>
                <Pressable accessibilityLabel="Close search" onPress={() => closeProjectSearch(true)} style={({ pressed }) => [styles.searchCloseButton, pressed && styles.pressed]}>
                  <LiquidGlassSurface interactive style={styles.roundButtonGlass} theme={theme}><X color={colors.text} size={29} /></LiquidGlassSurface>
                </Pressable>
              </Animated.View>

              <Animated.View
                style={[
                  styles.searchResults,
                  {
                    opacity: searchMorph.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] }),
                    paddingTop: safeAreaInsets.top + 84,
                    transform: [{ translateY: searchMorph.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
                  },
                ]}>
                <ScrollView
                  directionalLockEnabled
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  scrollsToTop
                  showsVerticalScrollIndicator={false}>
                  {projectsLoading ? (
                    <View style={styles.searchState}><ActivityIndicator color={colors.primary} /></View>
                  ) : filteredProjects.length === 0 ? (
                    <View style={styles.searchState}>
                      <Search color={colors.secondaryText} size={30} />
                      <Text style={[styles.searchEmptyTitle, { color: colors.text }]}>No projects found</Text>
                      <Text style={[styles.searchEmptyText, { color: colors.secondaryText }]}>Try searching with another project name.</Text>
                    </View>
                  ) : filteredProjects.map((project) => {
                    const selected = project.id === selectedProjectId;
                    return (
                      <Pressable
                        accessibilityState={{ selected }}
                        key={project.id}
                        onPress={() => selectSearchProject(project.id)}
                        style={({ pressed }) => [styles.searchResultRow, pressed && styles.searchResultPressed]}>
                        {selected ? <Files color={colors.primary} size={25} /> : <Folder color={colors.text} size={25} />}
                        <View style={styles.searchResultCopy}>
                          <Text numberOfLines={1} style={[styles.searchResultName, { color: colors.text }]}>{project.name}</Text>
                          {!!project.description && <Text numberOfLines={1} style={[styles.searchResultDescription, { color: colors.secondaryText }]}>{project.description}</Text>}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            </KeyboardAvoidingView>
          )
        }

        <FormModal
          canSubmit={newProjectName.trim().length > 0}
          colors={colors}
          isSubmitting={isProjectCreating}
          onClose={closeProjectModal}
          onSubmit={() => void handleCreateProject()}
          submitLabel="Create Project"
          title="New Project"
          visible={isProjectModalOpen}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Project Name</Text>
          <TextInput
            autoFocus maxLength={120}
            onChangeText={setNewProjectName}
            placeholder="Project name"
            placeholderTextColor={colors.secondaryText}
            style={[styles.modalInput, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.text }]}
            value={newProjectName} />
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
          <TextInput maxLength={2000} multiline onChangeText={setNewProjectDescription} placeholder="Optional description" placeholderTextColor={colors.secondaryText} style={[styles.modalInput, styles.modalTextarea, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.text }]} textAlignVertical="top" value={newProjectDescription} />
        </FormModal>
        <FormModal canSubmit={newTaskTitle.trim().length > 0 && selectedProjectId !== null} colors={colors} isSubmitting={isTaskCreating} onClose={closeTaskModal} onSubmit={() => void handleCreateTask()} submitLabel="Create Task" title="New Task" visible={isTaskModalOpen}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Task Title</Text>
          <TextInput autoFocus maxLength={300} onChangeText={setNewTaskTitle} onSubmitEditing={() => void handleCreateTask()} placeholder="Task title" placeholderTextColor={colors.secondaryText} returnKeyType="done" style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={newTaskTitle} />
        </FormModal>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fullScreen: {
    flex: 1
  },
  mainMotion: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    borderRadius: 55,
    shadowColor: '#0F172A',
    shadowOffset: { width: -18, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 36,
    elevation: 16,
  },
  mainSurface: {
    flex: 1,
    borderRadius: 55,
    overflow: 'hidden'
  },
  mainDismissArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,17,25,0.035)'
  },
  floatingHeaderLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 200,
    zIndex: 20,
  },
  floatingHeaderMaterial: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -50,
  },
  floatingHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  dashboardHeaderContent: {
    paddingHorizontal: 16,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dashboardTitlePillShadow: {
    minWidth: 0,
    height: 48,
    flex: 1,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8
  },
  dashboardTitlePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  dashboardTitle: {
    minWidth: 0,
    maxWidth: '100%',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center'
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  smallRoundButton: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  roundButtonGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  glassFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(248,249,252,0.76)'
  },
  glassFallbackDark: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(32,32,32,0.82)'
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }]
  },
  disabled: {
    opacity: 0.48
  },
  searchBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontWeight: '400'
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40
  },
  morphSearchBar: {
    position: 'absolute',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8
  },
  morphSearchInputWrap: {
    minWidth: 0,
    flex: 1,
    height: '100%'
  },
  morphSearchInput: {
    flex: 1,
    padding: 0,
    fontSize: 20,
    fontWeight: '300'
  },
  searchCloseWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 3,
    width: 56,
    height: 56,
    borderRadius: 28
  },
  searchCloseButton: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  searchResults: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 20
  },
  searchResultRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 4,
    borderRadius: 16
  },
  searchResultPressed: {
    backgroundColor: 'rgba(120,120,128,0.10)'
  },
  searchResultCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2
  },
  searchResultName: {
    fontSize: 19,
    fontWeight: '400',
    letterSpacing: -0.25
  },
  searchResultDescription: {
    fontSize: 12,
    fontWeight: '300'
  },
  searchState: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 28
  },
  searchEmptyTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  searchEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  mainContent: {
    flexGrow: 1,
    gap: 18,
    paddingHorizontal: 20,
  },
  fullState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 26,
    paddingVertical: 32,
    borderRadius: 28,
  },
  inlineState: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stateTitle: {
    fontSize: 21,
    fontWeight: '600'
  },
  stateText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center'
  },
  retryAction: {
    borderRadius: 21,
  },
  retryActionGlass: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 21,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600'
  },
  iconRetry: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  iconRetryGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  breadcrumb: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  breadcrumbLink: {
    fontSize: 13,
    fontWeight: '400'
  },
  breadcrumbCurrent: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    fontWeight: '500'
  },
  projectHero: {
    gap: 14,
    padding: 16,
    borderRadius: 28,
  },
  projectHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  projectInitialLarge: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 22
  },
  projectInitialLargeText: {
    fontSize: 43,
    fontWeight: '600',
    lineHeight: 48
  },
  projectHeroDetails: {
    minWidth: 0,
    flex: 1,
    gap: 5
  },
  projectHeroHeading: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  projectStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9
  },
  projectEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  projectEditButtonGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  projectTitle: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 35
  },
  projectDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  projectEditForm: {
    gap: 8,
    paddingTop: 2,
  },
  projectEditLabel: {
    marginTop: 3,
    paddingHorizontal: 4,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  projectEditField: {
    minHeight: 48,
    borderRadius: 16,
  },
  projectEditDescriptionField: {
    minHeight: 96,
  },
  projectEditInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '400',
  },
  projectEditDescriptionInput: {
    minHeight: 96,
    paddingTop: 13,
    paddingBottom: 13,
  },
  projectEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  projectEditAction: {
    minWidth: 96,
    borderRadius: 20,
  },
  projectEditActionGlass: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  projectEditActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  projectEditSaveText: {
    color: '#FFFFFF',
  },
  separator: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  separatorLineShort: {
    width: 28,
    height: StyleSheet.hairlineWidth
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  separatorText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8
  },
  tasksCard: {
    gap: 8,
    padding: 15,
    borderRadius: 28,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  tasksHeadingGroup: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tasksHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: '600'
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '500'
  },
  taskReorderHint: {
    paddingHorizontal: 2,
    fontSize: 11,
    fontWeight: '400',
  },
  taskEditModeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  taskEditModeButtonGlass: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  primaryButton: {
    borderRadius: 21,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  primaryButtonGlass: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 21,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600'
  },
  emptyTasks: {
    paddingVertical: 20,
    fontSize: 14,
    fontWeight: '400'
  },
  taskRowMotion: {
    height: 54,
    borderRadius: 20,
  },
  taskRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 7,
  },
  taskToggle: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    alignSelf: 'stretch',
  },
  taskTitle: {
    minWidth: 0,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20
  },
  completedTaskTitle: {
    textDecorationLine: 'line-through'
  },
  taskDeleteAction: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 15,
  },
  taskDeleteActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskEditInput: {
    minWidth: 0,
    height: 40,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 13,
    backgroundColor: 'rgba(120,120,128,0.10)',
    fontSize: 14,
    fontWeight: '500',
  },
  taskDragHandle: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  deleteProjectButton: {
    alignSelf: 'flex-end',
    borderRadius: 24,
  },
  deleteProjectButtonGlass: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  deleteProjectText: {
    fontSize: 14,
    fontWeight: '600'
  },
  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0
  },
  drawerGlass: {
    flex: 1
  },
  drawerSafeArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingRight: 50,
  },
  drawerHeaderContent: {
    paddingLeft: 18,
    paddingRight: 50,
  },
  drawerTitlePillShadow: {
    minWidth: 0,
    flex: 1,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8
  },
  drawerTitlePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 24,
    overflow: 'hidden'
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '500',
    letterSpacing: -0.45,
    textAlign: 'center'
  },
  drawerActions: {
    flexDirection: 'row',
    gap: 8
  },
  drawerRoundAction: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  drawerScroll: {
    flex: 1,
  },
  drawerContent: {
  },
  drawerSection: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 8
  },
  drawerItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    borderRadius: 16
  },
  drawerItemPressed: {
    backgroundColor: 'rgba(120,120,128,0.10)'
  },
  drawerItemLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  drawerItemText: {
    fontSize: 19,
    fontWeight: '500'
  },
  chevronOpen: {
    transform: [{
      rotate: '180deg'
    }]
  },
  drawerProjects: {
    gap: 5,
    paddingTop: 4,
    paddingLeft: 10,
    paddingRight: 24
  },
  drawerSectionTitle: {
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.9
  },
  drawerRecentsTitle: {
    marginTop: 20
  },
  drawerSectionEmpty: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '400'
  },
  drawerStatus: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 10
  },
  drawerStatusText: {
    fontSize: 14,
    fontWeight: '400',
    paddingLeft: 10
  },
  drawerProjectRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 2,
    borderRadius: 14
  },
  drawerProjectSelect: {
    minWidth: 0,
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  drawerPinButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12
  },
  drawerProjectInitial: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  drawerProjectInitialText: {
    fontSize: 14,
    fontWeight: '600'
  },
  drawerProjectName: {
    minWidth: 0,
    flex: 1,
    fontSize: 15,
    fontWeight: '500'
  },
  drawerAddProjectButton: {
    position: 'absolute',
    left: 26,
    bottom: 18,
    zIndex: 20,
    width: 174,
    height: 56,
    borderRadius: 28,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10
  },
  drawerAddProjectPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }]
  },
  drawerAddProjectGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 28,
  },
  drawerAddProjectText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.25
  },
  modalLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    gap: 10,
    padding: 20,
    borderRadius: 24,
    elevation: 24
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: '700'
  },
  modalClose: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12
  },
  fieldLabel: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600'
  },
  modalInput: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 15,
    fontWeight: '400'
  },
  modalTextarea: {
    minHeight: 100,
    paddingTop: 13
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10
  },
  modalButton: {
    minWidth: 100,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 13
  },
  modalSubmit: {
    minWidth: 132
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  modalSubmitText: {
    color: '#FFF'
  },
});
