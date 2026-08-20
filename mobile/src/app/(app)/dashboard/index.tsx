import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions, type StyleProp, type ViewStyle, } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, ChevronRight, Circle, Files, Folder, FolderPlus, LogOut, Menu, Moon, Pin, Plus, RefreshCw, Search, Smartphone, Sun, Trash2, X, User } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { Easing as ReanimatedEasing, clamp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAuth } from '@/features/auth/AuthProvider';
import { createProjectRequest, deleteProjectRequest, getProjectsRequest, updateProjectRequest, } from '@/features/projects/api';
import type { Project } from '@/features/projects/types';
import { createTaskRequest, deleteTaskRequest, getTasksRequest, updateTaskRequest, } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import { themePreferenceStorage, type ThemePreference } from '@/lib/theme-storage';

type ThemeName = 'light' | 'dark';

type Colors = (typeof themeColors)[ThemeName];


const themeColors = {
  light: {
    appBackground: '#E9EBF0',
    drawerBackground: '#F7F7FA',
    surface: '#F7F7FA',
    card: '#FFFFFF',
    cardMuted: '#F1F1F6',
    border: '#E1E1E8',
    text: '#17171F',
    secondaryText: '#64646e',
    primary: '#4F46E5',
    primarySoft: '#EEECFF',
    primaryBorder: '#CFCBFF',
    success: '#2F7D5B',
    successSoft: '#E9F7EF',
    danger: '#C63D4F',
    dangerSoft: '#FFF0F2',
    overlay: 'rgba(15,17,25,0.32)',
  },
  dark: {
    appBackground: '#000000',
    drawerBackground: '#000000',
    surface: '#171717',
    card: '#212121',
    cardMuted: '#2C2C2E',
    border: '#363638',
    text: '#FFFFFF',
    secondaryText: '#A1A1AA',
    primary: '#A970FF',
    primarySoft: 'rgba(169,112,255,0.18)',
    primaryBorder: '#65428F',
    success: '#75D5A6',
    successSoft: '#173426',
    danger: '#FF7B87',
    dangerSoft: '#3A2024',
    overlay: 'rgba(0,0,0,0.72)',
  },
} as const;



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
  return <BlurView experimentalBlurMethod="dimezisBlurView" intensity={72} style={[styles.glassFallback, isDark && styles.glassFallbackDark, style]} tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'}>{children}</BlurView>;
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
const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;

export default function DashboardScreen() {
  const systemColorScheme = useColorScheme();
  const { width: screenWidth } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [isThemePreferenceLoaded, setIsThemePreferenceLoaded] = useState(false);
  const systemTheme: ThemeName = systemColorScheme === 'dark' ? 'dark' : 'light';
  const theme: ThemeName = themePreference === 'system' ? systemTheme : themePreference;
  const colors: Colors = themeColors[theme];

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [areProjectsOpen, setAreProjectsOpen] = useState(true);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isProjectCreating, setIsProjectCreating] = useState(false);
  const [isTaskCreating, setIsTaskCreating] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [updatingPinnedProjectId, setUpdatingPinnedProjectId] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [searchMorph] = useState(() => new Animated.Value(0));
  const projectSearchInputRef = useRef<TextInput>(null);
  const taskRequestId = useRef(0);
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
  const drawerScrollY = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const drawerGesturesEnabled = !isSearchOpen && !isAccountMenuOpen;

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

  const drawerHeaderBlurAnimatedStyle = useAnimatedStyle(() => ({
    opacity: clamp(drawerScrollY.value / 24, 0, 1),
  }));

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
    let isMounted = true;

    async function restoreThemePreference() {
      try {
        const storedPreference = await themePreferenceStorage.get();

        if (!isMounted) return;
        if (storedPreference === 'system' || storedPreference === 'light' || storedPreference === 'dark') {
          setThemePreference(storedPreference);
        }
      } finally {
        if (isMounted) setIsThemePreferenceLoaded(true);
      }
    }

    void restoreThemePreference().catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isThemePreferenceLoaded) return;
    void themePreferenceStorage.set(themePreference).catch(() => undefined);
  }, [isThemePreferenceLoaded, themePreference]);

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
    if (selectedProjectId === null || updatingTaskId !== null) return;
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
    } catch (error) { Alert.alert('Task could not be deleted', errorMessage(error, 'Unknown error.')); }
    finally { setDeletingTaskId(null); }
  }

  function confirmDeleteTask(task: Task) {
    Alert.alert('Delete task?', `“${task.title}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDeleteTask(task.id) },
    ]);
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

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsAccountMenuOpen(false);
    try { setIsLoggingOut(true); await logout(); } finally { setIsLoggingOut(false); }
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
            <SafeAreaView style={styles.safeArea}>
              <View pointerEvents="box-none" style={styles.topBarLayer}>
                <View style={styles.topBarLeft}>
                  <Pressable accessibilityLabel="Open menu" onPress={openMenu} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
                    <LiquidGlassSurface interactive style={styles.roundButtonGlass} theme={theme}><Menu color={colors.text} size={23} /></LiquidGlassSurface>
                  </Pressable>
                  {/* <View style={styles.dashboardTitlePillShadow}> */}
                  {/* <LiquidGlassSurface style={styles.dashboardTitlePill} theme={theme}> */}
                  <Text numberOfLines={1} style={[styles.dashboardTitle, { color: colors.text }]}>Dashboard</Text>
                  {/* </LiquidGlassSurface> */}
                  {/* </View> */}
                </View>
                <Pressable accessibilityLabel="Open account menu" accessibilityState={{ expanded: isAccountMenuOpen }} onPress={() => setIsAccountMenuOpen(true)} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
                  <LiquidGlassSurface interactive style={styles.roundButtonGlass} theme={theme}><User color={colors.text} size={23} /></LiquidGlassSurface>
                </Pressable>
                {/* <Pressable accessibilityLabel="Create project" onPress={() => setIsProjectModalOpen(true)} style={({ pressed }) => [styles.smallRoundButton, pressed && styles.pressed]}>
                <LiquidGlassSurface interactive style={styles.roundButtonGlass} tintColor="rgba(79,70,229,0.32)"><Plus color={colors.primary} size={21} /></LiquidGlassSurface>
              </Pressable> */}
              </View>

              {/* <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search color={colors.secondaryText} size={20} />
              <TextInput ref={projectSearchInputRef} autoCapitalize="none" autoCorrect={false} onChangeText={(value) => { setProjectSearchQuery(value); if (value) setAreProjectsOpen(true); }} placeholder="Search projects..." placeholderTextColor={colors.secondaryText} returnKeyType="search" style={[styles.searchInput, { color: colors.text }]} value={projectSearchQuery} />
              {projectSearchQuery.length > 0 && <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setProjectSearchQuery('')}><X color={colors.secondaryText} size={18} /></Pressable>}
            </View> */}

              <Reanimated.ScrollView
                contentContainerStyle={styles.mainContent}
                directionalLockEnabled
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                scrollsToTop={!isMenuOpen && !isSearchOpen}
                showsVerticalScrollIndicator={false}>
                {projectsLoading ? (
                  <View style={styles.fullState}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.secondaryText }]}>Projects loading...</Text></View>
                ) : projectsError ? (
                  <View style={styles.fullState}>
                    <Text style={[styles.stateText, { color: colors.danger }]}>{projectsError}</Text>
                    <Pressable onPress={() => void loadProjects()} style={({ pressed }) => [styles.retryAction, { backgroundColor: colors.primarySoft }, pressed && styles.pressed]}><RefreshCw color={colors.primary} size={18} /><Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text></Pressable>
                  </View>
                ) : selectedProject ? (
                  <>
                    <View style={styles.breadcrumb}>
                      <Pressable onPress={() => { setAreProjectsOpen(true); openMenu(); }}><Text style={[styles.breadcrumbLink, { color: colors.secondaryText }]}>Projects</Text></Pressable>
                      <ChevronRight color={colors.secondaryText} size={15} />
                      <Text numberOfLines={1} style={[styles.breadcrumbCurrent, { color: colors.text }]}>{selectedProject.name}</Text>
                    </View>
                    <View style={styles.projectHero}>
                      <View style={[styles.projectInitialLarge, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}><Text style={[styles.projectInitialLargeText, { color: colors.primary }]}>{initialFor(selectedProject.name)}</Text></View>
                      <View style={styles.projectHeroDetails}>
                        <Text style={[styles.projectStatus, { color: colors.primary }]}>{isSelectedProjectCompleted ? 'COMPLETED PROJECT' : 'ACTIVE PROJECT'}</Text>
                        <Text style={[styles.projectTitle, { color: colors.text }]}>{selectedProject.name}</Text>
                        <Text style={[styles.projectDescription, { color: colors.secondaryText }]}>{selectedProject.description ?? 'No description'}</Text>
                      </View>
                    </View>

                    <View style={[styles.tasksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.tasksHeader}>
                        <View style={styles.tasksHeadingGroup}><Text style={[styles.tasksTitle, { color: colors.text }]}>Tasks</Text><View style={[styles.countBadge, { backgroundColor: colors.cardMuted }]}><Text style={[styles.countBadgeText, { color: colors.secondaryText }]}>{tasks.length} Tasks</Text></View></View>
                        <Pressable onPress={() => setIsTaskModalOpen(true)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Plus color="#FFF" size={18} /><Text style={styles.primaryButtonText}>New Task</Text></Pressable>
                      </View>
                      {tasksLoading ? (
                        <View style={styles.inlineState}><ActivityIndicator color={colors.primary} size="small" /><Text style={[styles.stateText, { color: colors.secondaryText }]}>Tasks loading...</Text></View>
                      ) : tasksError ? (
                        <View style={styles.inlineState}><Text style={[styles.stateText, { color: colors.danger }]}>{tasksError}</Text><Pressable onPress={() => void loadTasks(selectedProject.id)} style={({ pressed }) => [styles.iconRetry, pressed && styles.pressed]}><RefreshCw color={colors.primary} size={18} /></Pressable></View>
                      ) : tasks.length === 0 ? (
                        <Text style={[styles.emptyTasks, { color: colors.secondaryText }]}>This project has no tasks.</Text>
                      ) : tasks.map((task) => (
                        <View key={task.id} style={[styles.taskRow, { backgroundColor: task.completed ? colors.successSoft : colors.card, borderColor: task.completed ? colors.success : colors.border }]}>
                          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} disabled={updatingTaskId !== null} onPress={() => void handleTaskCompletedChange(task)} style={styles.taskToggle}>
                            {updatingTaskId === task.id ? <ActivityIndicator color={colors.primary} size="small" /> : task.completed ? <CheckCircle2 color={colors.primary} size={22} /> : <Circle color={colors.secondaryText} size={22} />}
                            <View style={styles.taskTextGroup}><Text style={[styles.taskTitle, { color: task.completed ? colors.secondaryText : colors.text }, task.completed && styles.completedTaskTitle]}>{task.title}</Text><Text style={[styles.taskStatus, { color: task.completed ? colors.success : colors.secondaryText }]}>{task.completed ? 'Completed' : 'Not completed'}</Text></View>
                          </Pressable>
                          <Pressable accessibilityLabel={`Delete ${task.title}`} disabled={deletingTaskId !== null} onPress={() => confirmDeleteTask(task)} style={({ pressed }) => [styles.deleteTaskButton, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}>{deletingTaskId === task.id ? <ActivityIndicator color={colors.danger} size="small" /> : <Trash2 color={colors.danger} size={17} />}</Pressable>
                        </View>
                      ))}
                    </View>

                    <Pressable disabled={deletingProjectId !== null} onPress={() => confirmDeleteProject(selectedProject)} style={({ pressed }) => [styles.deleteProjectButton, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }, pressed && styles.pressed]}>
                      {deletingProjectId === selectedProject.id ? <ActivityIndicator color={colors.danger} size="small" /> : <Trash2 color={colors.danger} size={19} />}
                      <Text style={[styles.deleteProjectText, { color: colors.danger }]}>{deletingProjectId === selectedProject.id ? 'Deleting...' : 'Delete Project'}</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.fullState}><Files color={colors.secondaryText} size={38} /><Text style={[styles.stateTitle, { color: colors.text }]}>No project selected</Text><Text style={[styles.stateText, { color: colors.secondaryText }]}>Create a project to get started.</Text><Pressable onPress={() => setIsProjectModalOpen(true)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Plus color="#FFF" size={18} /><Text style={styles.primaryButtonText}>New Project</Text></Pressable></View>
                )}
              </Reanimated.ScrollView>
            </SafeAreaView>
            {isMenuOpen && <Pressable accessibilityLabel="Close menu" onPress={closeMenu} style={styles.mainDismissArea} />}
          </Reanimated.View>
        </Reanimated.View>

        <View
          pointerEvents={isMenuOpen ? 'auto' : 'none'}
          style={[styles.drawerLayer, { backgroundColor: colors.drawerBackground }]}>
          <Reanimated.View style={[styles.drawer, { backgroundColor: colors.drawerBackground, width: panelWidth + 80 }, drawerAnimatedStyle]}>
            <SafeAreaView edges={['top', 'bottom']} style={[styles.drawerSafeArea, { width: panelWidth + 32 }]}>
              <Reanimated.ScrollView
                contentContainerStyle={styles.drawerContent}
                directionalLockEnabled
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                onScroll={drawerScrollHandler}
                scrollEventThrottle={16}
                scrollsToTop={isMenuOpen}
                showsVerticalScrollIndicator={false}
                style={
                  styles.drawerScroll
                }>
                <View style={styles.drawerSection}>
                  <Text style={[styles.drawerSectionTitle, { color: colors.secondaryText }]}>PINNED</Text>
                  {pinnedProjects.length > 0
                    ? pinnedProjects.map(renderDrawerProject)
                    : <Text style={[styles.drawerSectionEmpty, { color: colors.secondaryText }]}>Pin a project for quick access.</Text>}
                </View>
                {recentProjects.length > 0 && (
                  <>
                    <Text style={[styles.drawerSectionTitle, styles.drawerRecentsTitle, { color: colors.secondaryText }]}>RECENTS</Text>
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
                    <>
                      {/* <Text style={[styles.drawerSectionTitle, { color: colors.secondaryText }]}>PINNED</Text>
                      {pinnedProjects.length > 0
                        ? pinnedProjects.map(renderDrawerProject)
                        : <Text style={[styles.drawerSectionEmpty, { color: colors.secondaryText }]}>Pin a project for quick access.</Text>}
                      {recentProjects.length > 0 && (
                        <>
                          <Text style={[styles.drawerSectionTitle, styles.drawerRecentsTitle, { color: colors.secondaryText }]}>RECENTS</Text>
                          {recentProjects.map(renderDrawerProject)}
                        </>
                      )} */}
                    </>
                  )}
                </View>}
              </Reanimated.ScrollView>
              <View pointerEvents="box-none"
                style={[
                  styles.drawerHeaderLayer,
                  {
                    height: safeAreaInsets.top + 126,
                    paddingTop: safeAreaInsets.top + 62,
                    top: -safeAreaInsets.top,
                  },
                ]}>

                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    styles.drawerHeaderMaterial,
                    drawerHeaderBlurAnimatedStyle
                  ]}>
                  <BlurView
                    intensity={25}
                    style={StyleSheet.absoluteFillObject}
                    tint={
                      theme === 'dark'
                        ? 'systemUltraThinMaterialDark'
                        : 'systemUltraThinMaterialLight'
                    }
                  />
                </Reanimated.View>

                <View style={styles.drawerHeaderContent}>
                  <Text
                    // adjustsFontSizeToFit 
                    // minimumFontScale={0.76}
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
                </View>
              </View>
              <Pressable
                accessibilityLabel="Add project"
                onPress={openProjectModalFromDrawer}
                style={({ pressed }) => [styles.drawerAddProjectButton, pressed && styles.drawerAddProjectPressed]}>
                <LiquidGlassSurface interactive style={[styles.drawerAddProjectGlass, { backgroundColor: colors.primary }]} theme={theme} tintColor={colors.primary}>
                  <FolderPlus color="#FFFFFF" size={22} />
                  <Text style={styles.drawerAddProjectText}>Add Project</Text>
                </LiquidGlassSurface>
              </Pressable>
            </SafeAreaView>
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

        <Modal
          animationType="fade"
          onRequestClose={() => setIsAccountMenuOpen(false)}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          transparent
          visible={isAccountMenuOpen}>
          <View style={styles.accountMenuLayer}>
            <Pressable
              accessibilityLabel="Close account menu"
              onPress={() => setIsAccountMenuOpen(false)}
              style={[styles.accountMenuBackdrop, { backgroundColor: colors.overlay }]} />
            <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.accountMenuSafeArea}>
              {user && (
                <View style={[styles.accountMenuCard, { backgroundColor: colors.card, borderColor: colors.border, width: Math.min(screenWidth - 32, 360) }]}>
                  <View style={styles.accountMenuHeader}>
                    <View style={[styles.accountMenuAvatar, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
                      <Text style={[styles.accountMenuAvatarText, { color: colors.primary }]}>{initialFor(user.displayName)}</Text>
                    </View>
                    <View style={styles.accountMenuIdentity}>
                      <Text numberOfLines={1} style={[styles.accountMenuName, { color: colors.text }]}>{user.displayName}</Text>
                      <Text numberOfLines={1} style={[styles.accountMenuEmail, { color: colors.secondaryText }]}>{user.email}</Text>
                    </View>
                    <Pressable accessibilityLabel="Close account menu" onPress={() => setIsAccountMenuOpen(false)} style={({ pressed }) => [styles.accountMenuClose, { backgroundColor: colors.cardMuted }, pressed && styles.pressed]}>
                      <X color={colors.secondaryText} size={19} />
                    </Pressable>
                  </View>

                  <View style={[styles.accountMenuDivider, { backgroundColor: colors.border }]} />

                  <Text style={[styles.accountMenuSectionTitle, { color: colors.secondaryText }]}>APPEARANCE</Text>
                  <View style={[styles.themeSelector, { backgroundColor: colors.cardMuted }]}>
                    {themeOptions.map((option) => {
                      const selected = themePreference === option.value;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={option.value}
                          onPress={() => setThemePreference(option.value)}
                          style={({ pressed }) => [
                            styles.themeOption,
                            selected && { backgroundColor: colors.card, borderColor: colors.primaryBorder },
                            pressed && styles.pressed,
                          ]}>
                          {option.value === 'system' ? <Smartphone color={selected ? colors.primary : colors.secondaryText} size={18} /> : option.value === 'light' ? <Sun color={selected ? colors.primary : colors.secondaryText} size={18} /> : <Moon color={selected ? colors.primary : colors.secondaryText} size={18} />}
                          <Text style={[styles.themeOptionText, { color: selected ? colors.primary : colors.secondaryText }]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    accessibilityLabel="Log out"
                    disabled={isLoggingOut}
                    onPress={() => void handleLogout()}
                    style={({ pressed }) => [styles.accountMenuLogout, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}>
                    {isLoggingOut ? <ActivityIndicator color={colors.danger} size="small" /> : <LogOut color={colors.danger} size={20} />}
                    <Text style={[styles.accountMenuLogoutText, { color: colors.danger }]}>{isLoggingOut ? 'Logging out...' : 'Log Out'}</Text>
                  </Pressable>
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>

        <FormModal canSubmit={newProjectName.trim().length > 0} colors={colors} isSubmitting={isProjectCreating} onClose={closeProjectModal} onSubmit={() => void handleCreateProject()} submitLabel="Create Project" title="New Project" visible={isProjectModalOpen}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Project Name</Text>
          <TextInput autoFocus maxLength={120} onChangeText={setNewProjectName} placeholder="Project name" placeholderTextColor={colors.secondaryText} style={[styles.modalInput, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.text }]} value={newProjectName} />
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
  safeArea: {
    flex: 1
  },
  topBar: {
    minHeight: 62,
  },
  topBarLayer: {
    position: 'absolute',
    top: 62,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between'
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
    overflow: 'hidden'
  },
  dashboardTitle: {
    minWidth: 0,
    maxWidth: '100%',
    fontSize: 25,
    fontWeight: '800',
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
    elevation: 8
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
    overflow: 'hidden'
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
    fontWeight: '500'
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
    fontWeight: '400'
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
    fontWeight: '500',
    letterSpacing: -0.25
  },
  searchResultDescription: {
    fontSize: 12,
    fontWeight: '400'
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
    fontWeight: '700'
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
    paddingTop: 92,
    paddingBottom: 42
  },
  fullState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 26
  },
  inlineState: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stateTitle: {
    fontSize: 21,
    fontWeight: '700'
  },
  stateText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'center'
  },
  retryAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 14
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700'
  },
  iconRetry: {
    padding: 8
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  breadcrumbLink: {
    fontSize: 13,
    fontWeight: '500'
  },
  breadcrumbCurrent: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    fontWeight: '600'
  },
  projectHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15
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
    fontWeight: '700',
    lineHeight: 48
  },
  projectHeroDetails: {
    minWidth: 0,
    flex: 1,
    gap: 5
  }, projectStatus: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9
  },
  projectTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 35
  },
  projectDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20
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
    fontWeight: '700',
    letterSpacing: 0.8
  },
  tasksCard: {
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderRadius: 20
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
  tasksTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  primaryButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 13
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  },
  emptyTasks: {
    paddingVertical: 20,
    fontSize: 14,
    fontWeight: '500'
  },
  taskRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 13,
    paddingRight: 9
  },
  taskToggle: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12
  },
  taskTextGroup: {
    minWidth: 0,
    flex: 1,
    gap: 3
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  completedTaskTitle: {
    textDecorationLine: 'line-through'
  },
  taskStatus: {
    fontSize: 11,
    fontWeight: '600'
  },
  deleteTaskButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12
  },
  deleteProjectButton: {
    minHeight: 48,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14
  },
  deleteProjectText: {
    fontSize: 14,
    fontWeight: '700'
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
  drawerHeaderLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 50,
  },
  drawerHeaderMaterial: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
    fontWeight: '600',
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
    paddingTop: 76,
    paddingBottom: 104,
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
    fontWeight: '600'
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
    fontWeight: '700',
    letterSpacing: 0.9
  },
  drawerRecentsTitle: {
    marginTop: 20
  },
  drawerSectionEmpty: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '500'
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
    fontWeight: '500',
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
    fontWeight: '700'
  },
  drawerProjectName: {
    minWidth: 0,
    flex: 1,
    fontSize: 15,
    fontWeight: '600'
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
    overflow: 'hidden'
  },
  drawerAddProjectText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25
  },
  accountMenuLayer: {
    flex: 1
  },
  accountMenuBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  accountMenuSafeArea: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 16
  },
  accountMenuCard: {
    gap: 16,
    marginTop: 8,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 18
  },
  accountMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  accountMenuAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16
  },
  accountMenuAvatarText: {
    fontSize: 20,
    fontWeight: '800'
  },
  accountMenuIdentity: {
    minWidth: 0,
    flex: 1,
    gap: 3
  },
  accountMenuName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  accountMenuEmail: {
    fontSize: 13,
    fontWeight: '500'
  },
  accountMenuClose: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12
  },
  accountMenuDivider: {
    height: StyleSheet.hairlineWidth
  },
  accountMenuSectionTitle: {
    marginBottom: -7,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 5,
    padding: 5,
    borderRadius: 16
  },
  themeOption: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700'
  },
  accountMenuLogout: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 15
  },
  accountMenuLogoutText: {
    fontSize: 15,
    fontWeight: '800'
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
    fontWeight: '800'
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
    fontWeight: '700'
  },
  modalInput: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 15,
    fontWeight: '500'
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
    fontWeight: '700'
  },
  modalSubmitText: {
    color: '#FFF'
  },
});
