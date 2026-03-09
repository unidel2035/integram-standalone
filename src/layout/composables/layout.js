import { computed, reactive } from 'vue';

// Инициализация темы из localStorage
const getInitialDarkTheme = () => {
  if (typeof window === 'undefined') return true; // Для SSR - темная тема по умолчанию
  const savedTheme = localStorage.getItem('darkTheme');
  return savedTheme ? JSON.parse(savedTheme) : true; // Темная тема по умолчанию
};

const layoutConfig = reactive({
    preset: 'Aura',
    primary: 'cyan',
    surface: 'neutral',
    darkTheme: getInitialDarkTheme(),
    menuMode: 'static'
});

// Инициализация состояния свернутого меню из localStorage
const getInitialSidebarCollapsed = () => {
  if (typeof window === 'undefined') return true; // По умолчанию свернуто
  const savedState = localStorage.getItem('sidebarCollapsed');
  return savedState ? JSON.parse(savedState) : true; // По умолчанию свернуто (только иконки)
};

const layoutState = reactive({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false,
    activeMenuItem: null,
    sidebarCollapsed: getInitialSidebarCollapsed(),
    // Block editor header integration (Issue #6934)
    blockEditorHeaderContent: null // Will hold reactive refs to header-left and header-center content
});

// Обновляет favicon в соответствии с темой приложения
const updateFavicon = (isDark) => {
    if (typeof document === 'undefined') return;
    const svgLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]:not([media])');
    if (svgLink) {
        svgLink.href = isDark ? '/meta/icon2.svg' : '/meta/icon1.svg';
    }
};

// Применяем начальную тему
if (typeof window !== 'undefined') {
  document.documentElement.classList.toggle('app-dark', layoutConfig.darkTheme);
  updateFavicon(layoutConfig.darkTheme);
}

export function useLayout() {
    const setActiveMenuItem = (item) => {
        // Handle null/undefined items safely
        if (item === null || item === undefined) {
            layoutState.activeMenuItem = null;
            return;
        }
        // Handle ref objects (check if item has a value property)
        layoutState.activeMenuItem = (item && typeof item === 'object' && 'value' in item) ? item.value : item;
    };

    const toggleDarkMode = () => {
        if (!document.startViewTransition) {
            executeDarkModeToggle();

            return;
        }

        document.startViewTransition(() => executeDarkModeToggle(event));
    };

   
    const executeDarkModeToggle = () => {
        layoutConfig.darkTheme = !layoutConfig.darkTheme;

        if (typeof window !== 'undefined') {
            localStorage.setItem('darkTheme', JSON.stringify(layoutConfig.darkTheme));
            document.documentElement.classList.toggle('app-dark', layoutConfig.darkTheme);
            updateFavicon(layoutConfig.darkTheme);
        }
    };

    const toggleMenu = () => {
        if (layoutConfig.menuMode === 'overlay') {
            layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
        }

        if (window.innerWidth > 991) {
            layoutState.staticMenuDesktopInactive = !layoutState.staticMenuDesktopInactive;
        } else {
            layoutState.staticMenuMobileActive = !layoutState.staticMenuMobileActive;
        }
    };

    const toggleSidebarCollapse = () => {
        layoutState.sidebarCollapsed = !layoutState.sidebarCollapsed;
        // Async localStorage to prevent UI blocking
        if (typeof window !== 'undefined') {
            const value = layoutState.sidebarCollapsed;
            queueMicrotask(() => {
                localStorage.setItem('sidebarCollapsed', JSON.stringify(value));
            });
        }
    };

    const isSidebarActive = computed(() => layoutState.overlayMenuActive || layoutState.staticMenuMobileActive);

    const isDarkTheme = computed(() => layoutConfig.darkTheme);

    const getPrimary = computed(() => layoutConfig.primary);

    const getSurface = computed(() => layoutConfig.surface);

    // Block editor header integration (Issue #6934)
    const setBlockEditorHeaderContent = (content) => {
        layoutState.blockEditorHeaderContent = content;
    };

    const clearBlockEditorHeaderContent = () => {
        layoutState.blockEditorHeaderContent = null;
    };

    return {
        layoutConfig,
        layoutState,
        toggleMenu,
        toggleSidebarCollapse,
        isSidebarActive,
        isDarkTheme,
        getPrimary,
        getSurface,
        setActiveMenuItem,
        toggleDarkMode,
        setBlockEditorHeaderContent,
        clearBlockEditorHeaderContent
    };
}
