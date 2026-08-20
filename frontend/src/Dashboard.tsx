import { useEffect, useRef, useState, type FormEvent } from "react";
import "./App.css";
import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  FolderClosed,
  Plus,
  Search,
  Moon,
  Sun,
  Trash2,
  LogOut,
} from "lucide-react";
import { useAuth } from "./auth/useAuth";
import { apiFetch } from "./lib/api";

type Project = {
  id: number;
  name: string;
  description: string | null;
};

type Task = {
  id: number;
  title: string;
  completed: boolean;
  projectId: number;
};

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "project-tracking-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme: Theme =
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.style.colorScheme = initialTheme;

  return initialTheme;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [selectedProjectId, setSelectedProjectId] =
    useState<number | null>(null);

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [projectsError, setProjectsError] =
    useState<string | null>(null);

  const [tasksError, setTasksError] =
    useState<string | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] =
    useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] =
    useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] =
    useState("");

  const [isProjectCreating, setIsProjectCreating] =
    useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isTaskCreating, setIsTaskCreating] =
    useState(false);
  const [deletingTaskId, setDeletingTaskId] =
    useState<number | null>(null);
  const [deletingProjectId, setDeletingProjectId] =
    useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);
  const [isProjectsOpen, setIsProjectsOpen] =
    useState(true);
  const [projectSearchQuery, setProjectSearchQuery] =
    useState("");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  const normalizedProjectSearch = projectSearchQuery
    .trim()
    .toLocaleLowerCase("tr-TR");

  const filteredProjects = projects.filter((project) => {
    if (!normalizedProjectSearch) return true;

    return (
      project.name.toLocaleLowerCase("tr-TR").includes(normalizedProjectSearch) ||
      (project.description
        ?.toLocaleLowerCase("tr-TR")
        .includes(normalizedProjectSearch) ?? false)
    );
  });

  const isSelectedProjectCompleted =
    tasks.length > 0 &&
    tasks.every((task) => task.completed);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await apiFetch("/projects");

        if (!response.ok) {
          throw new Error("Projects could not be loaded");
        }

        const data: Project[] = await response.json();

        setProjects(data);

        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (error) {
        setProjectsError(
          error instanceof Error
            ? error.message
            : "Unknown error"
        );
      } finally {
        setProjectsLoading(false);
      }
    }

    fetchProjects();
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        projectSearchInputRef.current?.focus();
      }

      if (
        event.key === "Escape" &&
        document.activeElement === projectSearchInputRef.current
      ) {
        setProjectSearchQuery("");
        projectSearchInputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, []);

  useEffect(() => {
    if (selectedProjectId === null) {
      return;
    }

    async function fetchTasks() {
      try {
        setTasksLoading(true);
        setTasksError(null);

        const response = await apiFetch(
          `/projects/${selectedProjectId}/tasks`
        );

        if (!response.ok) {
          throw new Error("Tasks could not be loaded");
        }

        const data: Task[] = await response.json();

        setTasks(data);
      } catch (error) {
        setTasksError(
          error instanceof Error
            ? error.message
            : "Unknown error"
        );
      } finally {
        setTasksLoading(false);
      }
    }

    fetchTasks();
  }, [selectedProjectId]);

  async function handleTaskCompletedChange(
    taskId: number,
    completed: boolean
  ) {
    if (selectedProjectId === null) return;

    try {
      const response = await apiFetch(
        `/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completed,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Task güncellenemedi");
      }

      const updatedTask: Task = await response.json();

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === updatedTask.id
            ? updatedTask
            : task
        )
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Bilinmeyen bir hata oluştu"
      );
    }
  }

  async function handleDeleteTask(taskId: number) {
    if (selectedProjectId === null) return;

    const task = tasks.find((currentTask) => currentTask.id === taskId);
    const confirmed = window.confirm(
      `"${task?.title ?? "Bu task"}" silinsin mi?`
    );

    if (!confirmed) return;

    try {
      setDeletingTaskId(taskId);

      const response = await apiFetch(
        `/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Task silinemedi");
      }

      setTasks((currentTasks) =>
        currentTasks.filter((currentTask) => currentTask.id !== taskId)
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Bilinmeyen bir hata oluştu"
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  async function handleDeleteProject(projectId: number) {
    const project = projects.find(
      (currentProject) => currentProject.id === projectId
    );
    const confirmed = window.confirm(
      `"${project?.name ?? "Bu proje"}" ve tüm task'leri silinsin mi?`
    );

    if (!confirmed) return;

    try {
      setDeletingProjectId(projectId);

      const response = await apiFetch(
        `/projects/${projectId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Proje silinemedi");
      }

      const remainingProjects = projects.filter(
        (currentProject) => currentProject.id !== projectId
      );

      setProjects(remainingProjects);

      if (selectedProjectId === projectId) {
        setSelectedProjectId(remainingProjects[0]?.id ?? null);
        setTasks([]);
      }
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Bilinmeyen bir hata oluştu"
      );
    } finally {
      setDeletingProjectId(null);
    }
  }

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );

  if (projectsLoading) {
    return <div>Projects loading...</div>;
  }

  if (projectsError) {
    return <div>Error: {projectsError}</div>;
  }

  function handleAddProjectModalOpen() {
    setIsProjectModalOpen(true);
  }

  function handleAddProjectModalClose() {
    setIsProjectModalOpen(false);
    setNewProjectName("");
    setNewProjectDescription("");
  }

  async function handleAddProjectSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!newProjectName.trim()) {
      return;
    }

    try {
      setIsProjectCreating(true);

      const response = await apiFetch(
        "/projects",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newProjectName.trim(),
            description:
              newProjectDescription.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Proje oluşturulamadı");
      }

      const newProject: Project = await response.json();

      setProjects((currentProjects) => [
        ...currentProjects,
        newProject,
      ]);

      setSelectedProjectId(newProject.id);
      setProjectSearchQuery("");
      setIsProjectsOpen(true);
      handleAddProjectModalClose();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Bilinmeyen bir hata oluştu"
      );
    } finally {
      setIsProjectCreating(false);
    }
  }

  function handleAddTaskModalOpen() {
    setIsTaskModalOpen(true);
  }

  function handleAddTaskModalClose() {
    setIsTaskModalOpen(false);
    setNewTaskTitle("");
  }

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleAddTaskSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (selectedProjectId === null || !newTaskTitle.trim()) {
      return;
    }

    try {
      setIsTaskCreating(true);

      const response = await apiFetch(
        `/projects/${selectedProjectId}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: newTaskTitle.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Task oluşturulamadı");
      }

      const newTask: Task = await response.json();

      setTasks((currentTasks) => [
        ...currentTasks,
        newTask,
      ]);
      handleAddTaskModalClose();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Bilinmeyen bir hata oluştu"
      );
    } finally {
      setIsTaskCreating(false);
    }
  }

  return (
    <div className="app">
      <aside className={`sidePanel${isSidebarCollapsed ? " collapsed" : ""}`}>
        <div className="brandContainer">
          <div className="brand">
            Project Tracking App
          </div>
          <button
            type="button"
            className="sidebarToggle"
            aria-label={
              isSidebarCollapsed
                ? "Sidebar'ı genişlet"
                : "Sidebar'ı daralt"
            }
            aria-expanded={!isSidebarCollapsed}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            {isSidebarCollapsed ? (
              <ArrowRightFromLine size={22} />
            ) : (
              <ArrowLeftFromLine size={22} />
            )}
          </button>
        </div>

        {/* <div className="sidebarDivider" aria-hidden="true" /> */}

        <div className="projectsHeader">
          <div className="projectsTitle">
            <FolderClosed size={22} />
            <div className="sidebarLabel">Projects</div>
          </div>

          <div className="projectsActions">
            <button
              type="button"
              className="projectsToggle"
              aria-label={
                isProjectsOpen
                  ? "Projeleri kapat"
                  : "Projeleri aç"
              }
              aria-expanded={isProjectsOpen}
              onClick={() => setIsProjectsOpen((current) => !current)}
            >
              {isProjectsOpen ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>
          </div>
        </div>

        {isProjectsOpen && (
          <div className="projects">
            {filteredProjects.map((project) => (
              <button
                type="button"
                key={project.id}
                className="projectContainer"
                aria-current={selectedProjectId === project.id}
                title={isSidebarCollapsed ? project.name : undefined}
                onClick={() =>
                  setSelectedProjectId(project.id)
                }
              >
                <div className="project-info">
                  <div className="iconAndName">
                    <div className="projectInitial" aria-hidden="true">
                      {project.name
                        .trim()
                        .charAt(0)
                        .toLocaleUpperCase("tr-TR") || "?"}
                    </div>
                    <div className="project-name">
                      {project.name}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {filteredProjects.length === 0 && (
              <p className="projectSearchEmpty">No projects found.</p>
            )}
          </div>
        )}
        {user && (
          <div className="sidebarAccount">
            <div className="sidebarDivider" aria-hidden="true" />
            <div
              className="accountRow"
              title={isSidebarCollapsed ? user.displayName : undefined}
            >
              <div className="accountAvatar" aria-hidden="true">
                {user.displayName
                  .trim()
                  .charAt(0)
                  .toLocaleUpperCase("tr-TR") || "?"}
              </div>
              <div className="accountDetails">
                <span className="accountLabel">Account</span>
                <strong>{user.displayName}</strong>
                <span className="accountEmail">{user.email}</span>
              </div>
              <button
                type="button"
                className="logoutButton"
                aria-label="Sign out"
                title="Sign out"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </aside >

      <main className="content">
        <div className="navbar">
          <div className="searchBar">
            <Search
              className="searchIcon"
              size={24}
              aria-hidden="true"
            />
            <input
              ref={projectSearchInputRef}
              type="text"
              value={projectSearchQuery}
              placeholder="Search projects..."
              aria-label="Search projects"
              onChange={(event) => {
                setProjectSearchQuery(event.target.value);

                if (event.target.value) {
                  setIsProjectsOpen(true);
                }
              }}
            />

            <button
              type="button"
              className="searchShortcut"
              aria-label="Arama alanına odaklan"
              onClick={() => projectSearchInputRef.current?.focus()}
            >
              <span aria-hidden="true">⌘</span>
              <span>K</span>
            </button>
          </div>
          <div className="navbarActions">
            <button
              type="button"
              className="themeToggle"
              aria-label={
                theme === "light"
                  ? "Dark mode'a geç"
                  : "Light mode'a geç"
              }
              title={theme === "light" ? "Dark mode" : "Light mode"}
              onClick={() =>
                setTheme((currentTheme) =>
                  currentTheme === "light" ? "dark" : "light"
                )
              }
            >
              {theme === "light" ? (
                <Moon size={20} aria-hidden="true" />
              ) : (
                <Sun size={20} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className="addProjectButton"
              onClick={handleAddProjectModalOpen}
            ><Plus size={24} />
              <div>
                New Project
              </div>
            </button>
          </div>
        </div>

        {selectedProject ? (
          <div className="projectContent">
            <nav
              className="breadcrumb"
              aria-label="Breadcrumb"
            >
              <button
                type="button"
                className="breadcrumbLink"
                onClick={() => {
                  setIsSidebarCollapsed(false);
                  setIsProjectsOpen(true);
                }}
              >
                Projects
              </button>

              <ChevronRight
                className="breadcrumbSeparator"
                size={16}
                aria-hidden="true"
              />

              <span
                className="breadcrumbCurrent"
                aria-current="page"
              >
                {selectedProject.name}
              </span>
            </nav>
            <div className="projectHeaderContainer">
              <div className="projectInitialInline" aria-hidden="true">
                {selectedProject.name
                  .trim()
                  .charAt(0)
                  .toLocaleUpperCase("tr-TR") || "?"}
              </div>
              <div className="projectHeaderDetails">
                <div className="project-header">
                  <div className="header-left">
                    <div className="project-status">
                      {isSelectedProjectCompleted
                        ? "COMPLETED PROJECT"
                        : "ACTIVE PROJECT"}
                    </div>x
                    <h1 className="projectTitle">{selectedProject.name}</h1>

                    <p className="projectDescription">
                      {selectedProject.description ??
                        "No description"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="separator">
              <span className="separatorLabel">OVERVIEW</span>
            </div>

            <div className="tasksSection">
              <div className="tasksHeader">
                <div className="tasksTitleContainer">
                  <h2 className="tasksTitle">Tasks</h2>
                  <div className="taskCountBadge">
                    {tasks.length} Tasks
                  </div>
                </div>
                <button
                  type="button"
                  className="addTaskButton"
                  onClick={handleAddTaskModalOpen}
                ><Plus size={24} />
                  <div>
                    New Task
                  </div>
                </button>

              </div>

              {tasksLoading && (
                <p className="taskMessage">Tasks loading...</p>
              )}

              {tasksError && (
                <p className="taskMessage">Error: {tasksError}</p>
              )}

              {!tasksLoading &&
                !tasksError &&
                tasks.length === 0 && (
                  <p className="taskMessage">This project has no tasks.</p>
                )}

              {!tasksLoading &&
                !tasksError &&
                tasks.map((task) => (

                  <div
                    className={`taskContainer${task.completed ? " completed" : ""}`}
                    key={task.id}
                  >
                    <button
                      type="button"
                      className="taskToggle"
                      aria-pressed={task.completed}
                      onClick={() =>
                        handleTaskCompletedChange(task.id, !task.completed)
                      }
                    >
                      <div className="task-info">
                        {task.completed ? (
                          <CircleCheck
                            className="task-check-icon"
                            size={22}
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="task-check-icon"
                            size={22}
                            aria-hidden="true"
                          />
                        )}

                        <span className="taskTitle">{task.title}</span>
                      </div>
                      <div className="task-status">
                        <span className="taskStatusText">
                          {task.completed ? "Completed" : "Not Completed"}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="removeButton"
                      aria-label={`${task.title} task'ini sil`}
                      title="Task'i sil"
                      disabled={deletingTaskId === task.id}
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>

                ))}
            </div>

            <button
              type="button"
              className="removeProjectButton"
              onClick={() => handleDeleteProject(selectedProject.id)}
              disabled={deletingProjectId === selectedProject.id}
              aria-label={`${selectedProject.name} projesini sil`}
            ><Trash2 size={24} aria-hidden="true" />
              <div>
                {deletingProjectId === selectedProject.id
                  ? "Deleting..."
                  : "Delete Project"}
              </div>
            </button>
          </div>
        ) : (
          <div className="projectContent projectContentEmpty">
            <p className="emptyState">Please select a project.</p>
          </div>
        )}


      </main>

      {
        isProjectModalOpen && (
          <div
            className="modalOverlay"
            onClick={handleAddProjectModalClose}
          >
            <div
              className="modalContent"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-project-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="modalTitle" id="new-project-title">
                New Project
              </h2>

              <form onSubmit={handleAddProjectSubmit}>
                <label htmlFor="newProjectName">
                  Project Name
                </label>
                <input
                  id="newProjectName"
                  type="text"
                  value={newProjectName}
                  onChange={(event) =>
                    setNewProjectName(event.target.value)
                  }
                  autoFocus
                  required
                />

                <label htmlFor="newProjectDescription">
                  Description
                </label>
                <textarea
                  id="newProjectDescription"
                  value={newProjectDescription}
                  onChange={(event) =>
                    setNewProjectDescription(event.target.value)
                  }
                />

                <div className="modalActions">
                  <button
                    type="button"
                    className="formButton"
                    onClick={handleAddProjectModalClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="formButton"
                    disabled={isProjectCreating}
                  >
                    {isProjectCreating
                      ? "Creating..."
                      : "Create Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        isTaskModalOpen && (
          <div
            className="modalOverlay"
            onClick={handleAddTaskModalClose}
          >
            <div
              className="modalContent"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-task-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="modalTitle" id="new-task-title">
                New Task
              </h2>

              <form onSubmit={handleAddTaskSubmit}>
                <label htmlFor="newTaskTitle">
                  Task Title
                </label>
                <input
                  id="newTaskTitle"
                  type="text"
                  value={newTaskTitle}
                  onChange={(event) =>
                    setNewTaskTitle(event.target.value)
                  }
                  autoFocus
                  required
                />

                <div className="modalActions">
                  <button
                    type="button"
                    className="formButton"
                    onClick={handleAddTaskModalClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="formButton"
                    disabled={isTaskCreating}
                  >
                    {isTaskCreating
                      ? "Creating..."
                      : "Create Task"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default Dashboard;
