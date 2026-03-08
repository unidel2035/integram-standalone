<template>
    <div class="layout-footer">
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-center">
                <span class="text-sm text-muted-color">&copy; 2026 ФСТ НТИ &middot; DronDoc Platform</span>
            </div>
            <div class="flex flex-wrap gap-4 text-sm justify-center">
                <router-link to="/legal/terms-of-service" class="text-muted-color hover:text-primary transition-colors">Условия использования</router-link>
                <router-link to="/legal/privacy-policy" class="text-muted-color hover:text-primary transition-colors">Политика конфиденциальности</router-link>
                <router-link to="/legal/cookie-policy" class="text-muted-color hover:text-primary transition-colors">Cookies</router-link>
                <router-link to="/legal/refund-policy" class="text-muted-color hover:text-primary transition-colors">Возврат средств</router-link>
                <router-link to="/legal/acceptable-use-policy" class="text-muted-color hover:text-primary transition-colors">Правила использования</router-link>
                <router-link to="/legal/dmca-policy" class="text-muted-color hover:text-primary transition-colors">DMCA</router-link>
            </div>
        </div>
    </div>
</template>
