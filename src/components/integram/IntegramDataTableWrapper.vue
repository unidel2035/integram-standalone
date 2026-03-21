<template>
  <div class="integram-datatable-wrapper" :class="[`row-density-${rowDensity}`, { 'embedded-mode': embedded }]">
    <!-- Main Card -->
    <Card>
      <template #title>
        <div class="table-header-row">
          <!-- Left: Title + Badge -->
          <div class="flex align-items-start gap-2">
            <span class="table-title">{{ typeData?.val || 'Таблица' }}</span>
            <Badge
              :value="totalCount || filteredRows.length"
              class="records-badge"
              v-tooltip.bottom="totalCount ? `Всего записей в таблице: ${totalCount.toLocaleString()}` : ''"
            />
          </div>

          <!-- Right: Toolbar buttons + Search -->
          <div class="table-header-toolbar">
            <!-- Toolbar buttons -->
            <div class="flex gap-1">
              <Button
                icon="pi pi-refresh"
                size="small"
                text
                rounded
                @click="() => loadData(1)"
                v-tooltip.bottom="'Обновить'"
                :loading="loading"
              />
              <Button
                icon="pi pi-pencil"
                size="small"
                text
                rounded
                @click="toggleEditMode"
                :class="{ 'p-button-primary': editMode === 'single-click' }"
                v-tooltip.bottom="editMode === 'single-click' ? 'Режим редактирования' : 'Включить редактирование'"
              />
              <Button
                :icon="hasActiveFilters ? 'pi pi-filter-fill' : 'pi pi-filter'"
                size="small"
                text
                rounded
                @click="showFilterDialog"
                v-tooltip.bottom="'Фильтры'"
              />
              <Button
                icon="pi pi-check-square"
                size="small"
                text
                rounded
                :class="{ 'p-button-primary': isSelectionModeActive }"
                @click="toggleSelectionMode"
                v-tooltip.bottom="'Выделение строк'"
              />
              <Button
                icon="pi pi-calculator"
                size="small"
                text
                rounded
                :class="{ 'p-button-primary': isFooterActive }"
                @click="toggleFooter"
                v-tooltip.bottom="'Футер с агрегациями'"
              />
              <Button
                icon="pi pi-eye-slash"
                size="small"
                text
                rounded
                @click="showColumnSelector = true"
                v-tooltip.bottom="'Колонки'"
              />
              <Button
                icon="pi pi-print"
                size="small"
                text
                rounded
                @click="printTable"
                v-tooltip.bottom="'Печать'"
              />
              <Button
                icon="pi pi-file-excel"
                size="small"
                text
                rounded
                @click="exportToExcel"
                v-tooltip.bottom="'Excel'"
              />
              <Button
                icon="pi pi-file-pdf"
                size="small"
                text
                rounded
                @click="exportToPDF"
                v-tooltip.bottom="'PDF'"
              />
              <Button
                :icon="getRowDensityIcon()"
                size="small"
                text
                rounded
                @click="cycleRowDensity"
                v-tooltip.bottom="`Плотность строк: ${getRowDensityLabel()}`"
              />
              <Button
                :icon="textWrapEnabled ? 'pi pi-align-justify' : 'pi pi-minus'"
                size="small"
                text
                rounded
                :class="{ 'p-button-primary': textWrapEnabled }"
                @click="toggleTextWrap"
                v-tooltip.bottom="textWrapEnabled ? 'Перенос текста включён' : 'Перенос текста выключен'"
              />
              <Button
                icon="pi pi-cog"
                size="small"
                text
                rounded
                @click="showSettingsDialog = true"
                v-tooltip.bottom="'Настройки'"
              />
              <Button
                icon="pi pi-question-circle"
                size="small"
                text
                rounded
                @click="showHelpDialog = true"
                v-tooltip.bottom="'Справка'"
              />
              <span class="toolbar-separator"></span>
              <Button
                icon="pi pi-upload"
                size="small"
                text
                rounded
                @click="showImportDialog = true"
                v-tooltip.bottom="'Импорт данных (CSV/JSON/Excel)'"
              />
              <Button
                icon="pi pi-plus"
                size="small"
                text
                rounded
                @click="handleAddRow"
                v-tooltip.bottom="'Новая строка'"
                :loading="isAddingRow"
              />
              <Button
                icon="pi pi-plus-circle"
                size="small"
                text
                rounded
                @click="handleAddColumn"
                v-tooltip.bottom="'Новая колонка'"
                :loading="isAddingColumn"
              />
            </div>

            <!-- Search field with navigation (Phase 2) -->
            <div class="search-with-navigation">
              <IconField iconPosition="left" class="header-search">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model="searchQuery"
                  placeholder="Поиск..."
                  @input="onSearchInput"
                />
              </IconField>
              <div v-if="searchMatches.length > 0" class="search-navigation-controls">
                <span class="search-counter">
                  {{ currentMatchIndex + 1 }} / {{ searchMatches.length }}
                </span>
                <Button
                  icon="pi pi-chevron-up"
                  size="small"
                  text
                  rounded
                  @click="prevSearchMatch"
                  v-tooltip.bottom="'Предыдущий (Shift+F3)'"
                />
                <Button
                  icon="pi pi-chevron-down"
                  size="small"
                  text
                  rounded
                  @click="nextSearchMatch"
                  v-tooltip.bottom="'Следующий (F3)'"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #content>
        <!-- Loading state - hide entire table during initial loading -->
        <div v-if="loading" class="text-center py-5">
          <ProgressSpinner />
          <p class="mt-2 text-color-secondary">Загрузка данных...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="text-center py-5">
          <Message severity="error" :closable="false">{{ error }}</Message>
          <Button label="Повторить" icon="pi pi-refresh" @click="() => loadData(1)" class="mt-3" />
        </div>

        <!-- Issue #6856: Auto-selector active banner — shown when auto-detected selector
             filter is in effect and produces 0 rows so user understands why table is empty -->
        <div
          v-if="!loading && !error && filteredRows.length === 0 && activeAutoSelectorValue"
          class="mb-3"
        >
          <Message severity="info" :closable="false">
            <template #default>
              <div class="flex align-items-center justify-content-between gap-3">
                <span>
                  Таблица отфильтрована по селектору <strong>{{ autoSelectorName }}</strong>:
                  нет строк, соответствующих текущему выбору.
                </span>
                <Button
                  label="Сбросить фильтр"
                  icon="pi pi-times"
                  size="small"
                  outlined
                  severity="secondary"
                  @click="() => { setGlobalSelector(autoSelectorName, null); loadData(1) }"
                />
              </div>
            </template>
          </Message>
        </div>

        <!-- Partial data warning -->
        <div v-if="showPartialDataWarning" class="mb-3">
          <Message severity="warn" :closable="false">
            <template #default>
              <div class="flex align-items-center justify-content-between">
                <span>
                  Фильтрация работает только на загруженных {{ rows.length }} записях.
                  <template v-if="!settings.autoLoadAll">
                    Включите автозагрузку в настройках для поиска по всем данным.
                  </template>
                </span>
              </div>
            </template>
          </Message>
        </div>

        <!-- DataTable -->
        <DataTable
          ref="dataTableRef"
          v-if="!loading && !error"
          :headers="displayHeaders"
          :rows="paginatedRows"
          :disableEditing="false"
          :disableTypeEditing="false"
          :disableRowEditDialog="!settings.showSavePopup"
          :editMode="editMode"
          :isLoading="loading"
          :isLoadingMore="loadingMore"
          :isAddingRow="isAddingRow"
          :isAddingColumn="isAddingColumn"
          :allDataLoaded="allDataLoaded"
          :dateStyle="settings.dateStyle"
          :serverUrl="apiServerUrl"
          :autoLoadDirs="settings.autoLoadDirs"
          :database="database"
          :textWrapEnabled="textWrapEnabled"
          @cell-update="handleCellUpdate"
          @row-update="handleRowUpdate"
          @cell-multi-update="handleCellMultiUpdate"
          @load-directory-list="handleLoadDirectoryList"
          @load-dir-row="handleLoadDirRow"
          @load-nested-preview="handleLoadNestedPreview"
          @load-more="handleLoadMore"
          @add-row="handleAddRow"
          @add-column="handleAddColumn"
          @row-delete="handleRowDelete"
          @row-restore="handleRowRestore"
          @bulk-delete="handleBulkDelete"
          @row-move-up="handleRowMoveUp"
          @row-duplicate="handleRowDuplicate"
          @row-expand="handleRowExpand"
          @add-row-after="handleAddRowAfter"
          @open-nested="handleOpenNested"
          @row-change-parent="handleRowChangeParent"
          @open-directory="handleOpenDirectory"
          @button-action-change="handleButtonActionChange"
          @button-click="handleButtonClick"
          @ai-button-click="handleAIButtonClick"
          @ai-agent-execute="handleAIAgentExecute"
          @ai-agent-save-config="handleAIAgentSaveConfig"
          @vote-update="handleVoteUpdate"
          @vote-save-config="handleVoteSaveConfig"
          @select-column-save-config="handleSelectColumnSaveConfig"
          @load-directory-metadata="handleLoadDirectoryMetadata"
          @upload-file="handleUploadFile"
          @header-action="handleHeaderAction"
          @column-convert-to-ref="openConvertToRefDialog"
          @column-convert-to-text="openConvertToTextDialog"
          @open-add-lookup-column="handleOpenAddLookupColumn"
          @update:table-config="handleTableConfigUpdate"
          @create-ref-value="handleCreateRefValue"
          @row-version-history="handleRowVersionHistory"
        />

        <!-- Embedded pagination -->
        <div v-if="embedded && needsPagination" class="embedded-paginator">
          <button
            class="embedded-paginator-btn"
            :disabled="embeddedPage <= 1"
            @click="embeddedPage--"
          ><i class="pi pi-chevron-left"></i></button>
          <span class="embedded-paginator-info">{{ embeddedPage }} / {{ totalEmbeddedPages }}</span>
          <button
            class="embedded-paginator-btn"
            :disabled="embeddedPage >= totalEmbeddedPages"
            @click="embeddedPage++"
          ><i class="pi pi-chevron-right"></i></button>
          <span class="embedded-paginator-total">{{ filteredRows.length }} строк</span>
        </div>
      </template>
    </Card>

    <!-- Background loading indicator - fixed at bottom of screen -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="isBackgroundLoading" class="bg-loading-overlay">
          <div class="bg-loading-indicator">
            <div class="flex align-items-center gap-3">
              <i class="pi pi-spin pi-spinner"></i>
              <div class="flex-1">
                <div class="flex justify-content-between align-items-center mb-1">
                  <span class="font-medium">Загрузка всех данных</span>
                  <span class="text-sm">{{ loadedCount }} / {{ totalCount }}</span>
                </div>
                <ProgressBar :value="backgroundProgress" :showValue="false" style="height: 6px;" />
              </div>
              <Button
                icon="pi pi-times"
                text
                rounded
                size="small"
                severity="secondary"
                @click="cancelBackgroundLoading"
                v-tooltip.left="'Отменить'"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Create Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      modal
      :header="'Создать: ' + (typeData?.val || 'Запись')"
      :style="{ width: '40rem' }"
      :breakpoints="{ '960px': '75vw', '640px': '95vw' }"
    >
      <div class="flex flex-column gap-3">
        <div class="field">
          <label for="newObjectValue" class="font-bold">Значение *</label>
          <InputText
            id="newObjectValue"
            v-model="createForm.value"
            placeholder="Введите значение"
            class="w-full"
            @keydown.enter="handleCreate"
          />
        </div>

        <!-- Requisite fields -->
        <div v-for="req in editableRequisites" :key="req.id" class="field">
          <label :for="'req_' + req.id">{{ req.alias }}</label>

          <!-- Reference field (справочник) -->
          <ReferenceField
            v-if="req.refType"
            v-model="createForm.requisites[req.id]"
            :reqId="req.id"
            :refTypeId="req.refType"
            :database="database"
            :objectId="0"
            :multi="req.isMulti"
            :allowCreate="true"
          />

          <!-- Regular field -->
          <component
            v-else
            :is="getRequisiteInputComponent(req.base)"
            :id="'req_' + req.id"
            v-model="createForm.requisites[req.id]"
            :placeholder="'Введите ' + req.alias"
            class="w-full"
            v-bind="getRequisiteInputProps(req.base)"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" text @click="showCreateDialog = false" />
        <Button
          label="Создать"
          icon="pi pi-check"
          :loading="creating"
          :disabled="!createForm.value"
          @click="handleCreate"
        />
      </template>
    </Dialog>

    <!-- Add Column Dialog -->
    <Dialog
      v-model:visible="showAddColumnDialog"
      modal
      :header="newColumnType === 'lookup' ? 'Добавить колонки из связанной таблицы' : 'Добавить колонку'"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div class="flex flex-column gap-3">
        <!-- Column name (hidden for Relation type) -->
        <div v-if="newColumnType !== 'lookup'" class="field">
          <label for="newColumnAlias" class="font-bold block mb-2">Название колонки *</label>
          <InputText
            id="newColumnAlias"
            v-model="newColumnAlias"
            placeholder="Например: Статус"
            class="w-full"
            autofocus
          />
        </div>

        <!-- Vertical type picker -->
        <div class="field">
          <label class="font-bold block mb-2">Тип данных</label>
          <div class="add-column-type-list">
            <div
              v-for="opt in columnTypeOptions"
              :key="String(opt.value)"
              class="add-column-type-item"
              :class="{ 'selected': !isReferenceColumn && newColumnType === opt.value }"
              @click="isReferenceColumn = false; newColumnType = opt.value; handleColumnTypeChange()"
            >
              <span class="add-column-type-icon">{{ opt.icon || '▪' }}</span>
              <span class="add-column-type-label">{{ opt.label }}</span>
            </div>
            <!-- Reference type as a separate item -->
            <div
              class="add-column-type-item"
              :class="{ 'selected': isReferenceColumn }"
              @click="isReferenceColumn = true; newColumnType = 3"
            >
              <span class="add-column-type-icon">🔗</span>
              <span class="add-column-type-label">Справочник (ссылка на таблицу)</span>
            </div>
          </div>
        </div>

        <!-- Reference table selector -->
        <div v-if="isReferenceColumn" class="field">
          <label for="referenceTableSelect" class="font-bold block mb-2">Целевая таблица *</label>
          <Dropdown
            id="referenceTableSelect"
            v-model="referenceTableId"
            :options="referenceTableOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите таблицу..."
            :loading="loadingReferenceTables"
            :filter="true"
            filterPlaceholder="Поиск таблицы..."
            class="w-full"
            emptyFilterMessage="Таблицы не найдены"
            emptyMessage="Нет доступных таблиц"
          />
        </div>

        <!-- Lookup (Relation) configuration -->
        <template v-if="!isReferenceColumn && newColumnType === 'lookup'">
          <div class="field">
            <label for="lookupSourceReq" class="font-bold block mb-2">
              {{ lookupSourceOptions.length > 1 ? 'Таблица (выберите связь) *' : lookupSourceOptions.length === 1 ? 'Таблица' : 'Связь через *' }}
            </label>
            <div v-if="lookupSourceOptions.length > 0" class="add-column-type-list">
              <div
                v-for="opt in lookupSourceOptions"
                :key="opt.value"
                class="add-column-type-item"
                :class="{ 'selected': lookupSourceReqId === opt.value }"
                @click="lookupSourceReqId = opt.value; handleLookupSourceChange()"
              >
                <span class="add-column-type-icon">🔗</span>
                <span class="add-column-type-label">{{ opt.label }}</span>
              </div>
            </div>
            <div v-else class="add-column-type-empty p-3 surface-ground border-round text-center">
              <i class="pi pi-info-circle text-xl mb-2"></i>
              <p class="m-0">Нет справочных колонок в этой таблице</p>
              <p class="text-sm text-color-secondary m-0 mt-2">
                Сначала создайте колонку типа "Справочник (ссылка на таблицу)"
              </p>
            </div>
          </div>

          <div v-if="lookupSourceReqId" class="field">
            <label for="lookupTargetReq" class="font-bold block mb-2">Колонки (выберите нужные) *</label>
            <div v-if="loadingLookupTargetFields" class="text-center py-2">
              <i class="pi pi-spin pi-spinner"></i> Загрузка полей...
            </div>
            <div v-else class="add-column-type-list max-h-20rem overflow-y-auto">
              <div
                v-for="opt in lookupTargetOptions"
                :key="opt.value"
                class="add-column-type-item-checkbox flex align-items-center p-2 surface-hover border-round"
                @click="toggleLookupTargetSelection(opt.value)"
              >
                <Checkbox
                  :modelValue="lookupSelectedTargetIds.includes(opt.value)"
                  :binary="true"
                  class="mr-2"
                  @click.stop="toggleLookupTargetSelection(opt.value)"
                />
                <span class="add-column-type-label flex-grow-1">{{ opt.label }}</span>
              </div>
              <div v-if="lookupTargetOptions.length === 0" class="add-column-type-empty">
                Нет доступных полей
              </div>
            </div>
          </div>
        </template>
      </div>

      <template #footer>
        <Button
          label="Отмена"
          text
          @click="showAddColumnDialog = false"
        />
        <Button
          :label="newColumnType === 'lookup' && lookupSelectedTargetIds.length > 0 ? `Добавить (${lookupSelectedTargetIds.length})` : 'Добавить'"
          icon="pi pi-plus"
          :loading="isAddingColumn"
          :disabled="(newColumnType === 'lookup' && lookupSelectedTargetIds.length === 0) || (newColumnType !== 'lookup' && !newColumnAlias.trim()) || (isReferenceColumn && !referenceTableId) || (!isReferenceColumn && newColumnType === 'lookup' && !lookupSourceReqId)"
          @click="createColumn"
        />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog />

    <!-- Column Selector Dialog -->
    <Dialog
      v-model:visible="showColumnSelector"
      header="Управление колонками"
      :modal="true"
      :style="{ width: '450px' }"
      :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
    >
      <div class="flex justify-content-between mb-4">
        <Button label="Показать все" @click="selectAllColumns(true)" size="small" icon="pi pi-eye" outlined />
        <Button label="Скрыть все" @click="selectAllColumns(false)" size="small" icon="pi pi-eye-slash" outlined severity="secondary" />
      </div>
      <div class="flex flex-column gap-3 mb-4 max-h-20rem overflow-y-auto">
        <div v-for="column in columnOptions" :key="column.id" class="flex align-items-center p-2 surface-hover border-round">
          <Checkbox v-model="selectedColumns[column.id]" :inputId="'col-' + column.id" :binary="true" class="mr-3" />
          <label :for="'col-' + column.id" class="flex-grow-1 cursor-pointer" :class="{ 'text-color-secondary': !selectedColumns[column.id] }">
            {{ column.value }}
          </label>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-content-between w-full">
          <Button label="Отменить" @click="showColumnSelector = false" text size="small" />
          <Button label="Применить" @click="applyColumnSelection" size="small" icon="pi pi-check" />
        </div>
      </template>
    </Dialog>

    <!-- Filter Dialog — переиспользуемый компонент FilterConditionsDialog -->
    <FilterConditionsDialog
      v-model:visible="isFilterDialogVisible"
      :filterConditions="filterConditions"
      :filterableFields="filterableFieldsForDialog"
      :refFilterOptions="refFilterOptions"
      :refFilterLoading="refFilterLoading"
      :currentUserId="integramApiClient.userId"
      :selectorState="selectorState"
      :loadRefOptions="loadRefOptions"
      @apply="onFilterDialogApply"
      @reset="onFilterDialogReset"
      @cancel="cancelFilter"
    />

    <!-- Filter Dialog - Integram Style (LEGACY — сохранён для совместимости, скрыт) -->
    <template v-if="false">
    <Dialog
      v-model:visible="isFilterDialogVisible"
      header="Фильтрация данных"
      :modal="true"
      :style="{ width: '600px' }"
      :breakpoints="{ '960px': '90vw' }"
    >
      <div v-if="filterConditions.length === 0" class="filter-empty-state">
        <i class="pi pi-filter" style="font-size: 2rem; color: var(--text-color-secondary);"></i>
        <p class="mt-3 mb-3 text-color-secondary">Условия фильтрации не заданы</p>
        <Button
          label="Добавить условие"
          icon="pi pi-plus"
          outlined
          @click="addCondition"
        />
      </div>

      <div v-else class="filter-conditions-list">
        <div
          v-for="(condition, index) in filterConditions"
          :key="index"
          class="filter-condition-item"
        >
          <div class="condition-header">
            <h4 class="condition-title">Условие {{ index + 1 }}</h4>
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              size="small"
              @click="removeCondition(index)"
              v-tooltip.left="'Удалить условие'"
            />
          </div>

          <div class="condition-fields">
            <div class="field mb-3">
              <label :for="`column-${index}`">Столбец</label>
              <Dropdown
                :id="`column-${index}`"
                v-model="condition.headerId"
                :options="filterableHeaders"
                optionLabel="value"
                optionValue="id"
                placeholder="Выберите столбец"
                class="w-full"
                @change="updateConditionType(index)"
              />
            </div>

            <div class="field mb-3">
              <label :for="`operator-${index}`">Оператор</label>
              <Dropdown
                :id="`operator-${index}`"
                v-model="condition.operator"
                :options="getOperatorsForType(condition.type)"
                optionLabel="label"
                optionValue="value"
                placeholder="Выберите оператор"
                class="w-full"
                @change="() => {
                  condition.value = null
                  if ((condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'equals' && condition.dirTableId) {
                    loadRefOptions(condition.dirTableId)
                  }
                }"
              />
            </div>

            <!-- Value input field -->
            <template v-if="condition.operator !== 'isEmpty'">
              <!-- Value source toggle: manual / selector -->
              <div class="field mb-2">
                <label>Источник значения</label>
                <div class="flex gap-2 mt-1">
                  <Button
                    label="Вручную"
                    size="small"
                    :severity="condition.valueSource === 'manual' ? 'primary' : 'secondary'"
                    :outlined="condition.valueSource !== 'manual'"
                    @click="condition.valueSource = 'manual'; condition.selectorName = null"
                  />
                  <Button
                    label="Selector (динамически)"
                    icon="pi pi-link"
                    size="small"
                    :severity="condition.valueSource === 'selector' ? 'info' : 'secondary'"
                    :outlined="condition.valueSource !== 'selector'"
                    @click="toggleValueSource(index)"
                  />
                </div>
              </div>

              <!-- Selector name input when valueSource = 'selector' -->
              <div v-if="condition.valueSource === 'selector'" class="field mb-3">
                <label :for="`selector-name-${index}`">Имя Selector'а</label>
                <InputText
                  :id="`selector-name-${index}`"
                  v-model="condition.selectorName"
                  class="w-full"
                  placeholder="vid_kno, region, status..."
                />
                <small class="text-color-secondary">
                  Значение берётся из блока Selector с этим именем
                  <span v-if="condition.selectorName && selectorState.selectors[condition.selectorName]">
                    — сейчас: <strong>{{ selectorState.selectors[condition.selectorName] }}</strong>
                  </span>
                  <span v-else-if="condition.selectorName" class="text-orange-500"> — не активен</span>
                </small>
              </div>

              <div v-if="condition.valueSource === 'manual' && !isRangeOperator(condition.operator)" class="field">
                <label :for="`value-${index}`">Значение</label>
                <!-- Reference field exact match: object picker -->
                <template v-if="(condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'equals'">
                  <Dropdown
                    :id="`value-${index}`"
                    v-model="condition.value"
                    :options="refFilterOptions[condition.dirTableId] || []"
                    optionLabel="label"
                    optionValue="id"
                    :filter="true"
                    filterPlaceholder="Поиск..."
                    placeholder="Выберите объект..."
                    class="w-full"
                    :loading="!!refFilterLoading[condition.dirTableId]"
                    @show="loadRefOptions(condition.dirTableId)"
                  >
                    <template #option="{ option }">
                      <span :class="option.isSpecial ? 'text-primary font-semibold' : ''">
                        {{ option.label }}
                        <span v-if="option.isSpecial && integramApiClient.userId" class="text-sm opacity-70">
                          (ID: {{ integramApiClient.userId }})
                        </span>
                      </span>
                    </template>
                  </Dropdown>
                  <small v-if="condition.value === '__current_user__'" class="text-primary">
                    Будет использован ID текущего пользователя из сессии
                  </small>
                  <small v-else-if="condition.value" class="text-color-secondary">
                    F_{{ condition.headerId?.replace('req_', '') }}=@{{ condition.value }}
                  </small>
                </template>
                <!-- Reference field text search: plain input -->
                <template v-else-if="(condition.columnType === 'dir' || condition.columnType === 'multi') && condition.operator === 'contains'">
                  <InputText
                    :id="`value-${index}`"
                    v-model="condition.value"
                    class="w-full"
                    placeholder="Поиск по тексту..."
                  />
                  <small class="text-color-secondary">Поиск по отображаемому значению (LIKE)</small>
                </template>
                <InputText
                  v-else-if="[3, 8, 12].includes(condition.type)"
                  :id="`value-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  placeholder="Введите значение..."
                />
                <InputNumber
                  v-else-if="[13, 14].includes(condition.type)"
                  :id="`value-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  placeholder="Введите число..."
                />
                <Calendar
                  v-else-if="[4, 9].includes(condition.type)"
                  :id="`value-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  :showIcon="true"
                  dateFormat="dd.mm.yy"
                  :showTime="condition.type === 4"
                />
                <Textarea
                  v-else-if="[2, 12].includes(condition.type)"
                  :id="`value-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  :rows="3"
                />
                <InputText
                  v-else
                  :id="`value-${index}`"
                  v-model="condition.value"
                  class="w-full"
                  placeholder="Введите значение..."
                />
              </div>

              <div v-else-if="condition.valueSource === 'manual' && isRangeOperator(condition.operator)" class="grid">
                <div class="col-6">
                  <div class="field">
                    <label :for="`value-from-${index}`">От</label>
                    <InputText
                      v-if="[3, 8, 12].includes(condition.type)"
                      :id="`value-from-${index}`"
                      v-model="condition.value"
                      class="w-full"
                    />
                    <InputNumber
                      v-else-if="[13, 14].includes(condition.type)"
                      :id="`value-from-${index}`"
                      v-model="condition.value"
                      class="w-full"
                    />
                    <Calendar
                      v-else-if="[4, 9].includes(condition.type)"
                      :id="`value-from-${index}`"
                      v-model="condition.value"
                      :showIcon="true"
                      dateFormat="dd.mm.yy"
                      :showTime="condition.type === 4"
                    />
                  </div>
                </div>
                <div class="col-6">
                  <div class="field">
                    <label :for="`value-to-${index}`">До</label>
                    <InputText
                      v-if="[3, 8, 12].includes(condition.type)"
                      :id="`value-to-${index}`"
                      v-model="condition.value2"
                      class="w-full"
                    />
                    <InputNumber
                      v-else-if="[13, 14].includes(condition.type)"
                      :id="`value-to-${index}`"
                      v-model="condition.value2"
                      class="w-full"
                    />
                    <Calendar
                      v-else-if="[4, 9].includes(condition.type)"
                      :id="`value-to-${index}`"
                      v-model="condition.value2"
                      :showIcon="true"
                      dateFormat="dd.mm.yy"
                      :showTime="condition.type === 4"
                    />
                  </div>
                </div>
              </div>
            </template>

            <!-- Hide column toggle: apply filter but hide the column from table -->
            <div class="field mt-3">
              <div class="flex align-items-center gap-2">
                <Checkbox
                  :inputId="`hide-col-${index}`"
                  v-model="condition.hideColumn"
                  :binary="true"
                />
                <label :for="`hide-col-${index}`" class="cursor-pointer text-sm">
                  Скрыть колонку в таблице
                </label>
              </div>
              <small v-if="condition.hideColumn" class="text-color-secondary">
                Фильтр применяется, но колонка не отображается в таблице
              </small>
            </div>
          </div>
        </div>

        <div class="mt-3">
          <Button
            label="Добавить условие"
            icon="pi pi-plus"
            text
            class="w-full"
            @click="addCondition"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-between align-items-center w-full">
          <Button
            label="Сбросить все"
            icon="pi pi-filter-slash"
            @click="resetAllFilters"
            severity="danger"
            text
            size="small"
          />
          <div class="flex gap-2">
            <Button
              label="Отмена"
              @click="cancelFilter"
              text
            />
            <Button
              ref="filterApplyButton"
              label="Применить"
              icon="pi pi-check"
              @click="applyFilter"
            />
          </div>
        </div>
      </template>
    </Dialog>
    </template><!-- end legacy filter dialog -->

    <!-- Compact Nested Card (quick fill without full component) -->
    <Dialog
      v-model:visible="nestedCard.visible"
      :header="nestedCard.tableName || 'Подчинённая таблица'"
      :modal="true"
      :style="{ width: '380px' }"
      :breakpoints="{ '480px': '95vw' }"
      class="nested-card-dialog"
      @hide="nestedCard.editingId = null; nestedCard.newRecordName = ''"
    >
      <template #header>
        <div class="flex align-items-center justify-content-between w-full">
          <span>{{ nestedCard.tableName || 'Подчинённая таблица' }}</span>
          <Badge :value="nestedCard.records.length" severity="secondary" />
        </div>
      </template>

      <!-- Loading -->
      <div v-if="nestedCard.loading" class="nested-card-loading">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Загрузка...</span>
      </div>

      <div v-else class="nested-card-body">
        <!-- Records list -->
        <div v-if="nestedCard.records.length === 0" class="nested-card-empty">
          <i class="pi pi-inbox"></i>
          <span>Нет записей</span>
        </div>
        <ul v-else class="nested-card-list">
          <li
            v-for="rec in nestedCard.records"
            :key="rec.id"
            class="nested-card-item"
            :class="{ editing: nestedCard.editingId === rec.id }"
          >
            <!-- Inline edit mode -->
            <template v-if="nestedCard.editingId === rec.id">
              <InputText
                v-model="nestedCard.editingVal"
                class="nested-card-edit-input"
                size="small"
                autofocus
                @keydown.enter="saveNestedCardRecord(rec.id)"
                @keydown.escape="nestedCard.editingId = null"
              />
              <div class="nested-card-edit-actions">
                <button class="nca-btn ok" @click="saveNestedCardRecord(rec.id)" title="Сохранить"><i class="pi pi-check"></i></button>
                <button class="nca-btn cancel" @click="nestedCard.editingId = null" title="Отмена"><i class="pi pi-times"></i></button>
              </div>
            </template>
            <!-- View mode -->
            <template v-else>
              <span class="nested-card-rec-val" @dblclick="startEditNestedCard(rec)">{{ rec.val || '—' }}</span>
              <div class="nested-card-item-actions">
                <button class="nca-btn edit" @click="startEditNestedCard(rec)" title="Редактировать"><i class="pi pi-pencil"></i></button>
                <button class="nca-btn del" @click="deleteNestedCardRecord(rec.id)" title="Удалить"><i class="pi pi-trash"></i></button>
              </div>
            </template>
          </li>
        </ul>

        <!-- Quick add -->
        <div class="nested-card-add">
          <InputText
            v-model="nestedCard.newRecordName"
            placeholder="Добавить запись..."
            class="nested-card-add-input"
            size="small"
            :disabled="nestedCard.adding"
            @keydown.enter="addNestedCardRecord"
          />
          <Button
            icon="pi pi-plus"
            size="small"
            :loading="nestedCard.adding"
            :disabled="!nestedCard.newRecordName.trim()"
            @click="addNestedCardRecord"
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="Открыть полностью"
          icon="pi pi-arrow-right"
          text
          size="small"
          @click="openNestedCardFull"
        />
        <Button label="Закрыть" size="small" @click="nestedCard.visible = false" />
      </template>
    </Dialog>

    <!-- Nested (Subordinate) Table Dialog (full) -->
    <Dialog
      v-model:visible="nestedDialog.visible"
      :header="nestedDialog.tableName || 'Подчинённая таблица'"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '1200px' }"
      :breakpoints="{ '1200px': '90vw', '640px': '98vw' }"
      :maximizable="true"
      class="nested-table-dialog"
    >
      <div v-if="nestedDialog.loading" class="text-center py-5">
        <ProgressSpinner />
        <p class="mt-2 text-color-secondary">Загрузка...</p>
      </div>
      <div v-else-if="nestedDialog.tableId" class="nested-table-content">
        <IntegramDataTableWrapper
          :key="nestedDialog.tableId + '-' + nestedDialog.parentRowId"
          :typeId="nestedDialog.tableId"
          :database="database"
          :parentId="nestedDialog.parentRowId"
          :embedded="true"
          :instanceId="props.tabId || props.instanceId"
        />
      </div>
      <template #footer>
        <div class="flex justify-content-between w-full">
          <div class="flex gap-2">
            <Button
              label="Добавить запись"
              icon="pi pi-plus"
              @click="createNestedRecord"
              outlined
            />
            <Button
              label="AI-заполнение"
              icon="pi pi-sparkles"
              @click="openAIFillDialog"
              severity="secondary"
              outlined
              v-tooltip.top="'Заполнить таблицу данными с помощью AI'"
            />
          </div>
          <Button label="Закрыть" @click="nestedDialog.visible = false" />
        </div>
      </template>
    </Dialog>

    <!-- AI Fill Table Dialog (Issue #6622) -->
    <AIFillTableDialog
      v-model:visible="aiFillDialog.visible"
      :tableId="aiFillDialog.tableId"
      :tableName="aiFillDialog.tableName"
      :tableStructure="aiFillDialog.tableStructure"
      :parentRowId="aiFillDialog.parentRowId"
      :database="database"
      :serverURL="apiServerUrl"
      :token="integramApiClient.getToken()"
      :xsrfToken="integramApiClient.getXsrfToken()"
      @fill-complete="handleAIFillComplete"
      @fill-error="handleAIFillError"
    />

    <!-- Import Table Dialog (Issue #6673) -->
    <ImportTableDialog
      v-model:visible="showImportDialog"
      :typeId="typeId"
      :tableName="typeData?.val || 'Таблица'"
      :tableHeaders="headers"
      :database="database"
      @import-complete="handleImportComplete"
    />

    <!-- Version History Panel (Issue #7191) -->
    <VersionHistoryPanel
      v-if="versionHistoryPanel.visible"
      v-model="versionHistoryPanel.visible"
      :serverUrl="apiServerUrl"
      :database="database"
      :token="integramApiClient.getToken()"
      :xsrfToken="integramApiClient.getXsrfToken()"
      :objId="versionHistoryPanel.objId"
      :userId="integramApiClient.userId"
      @rollback-complete="handleVersionRollbackComplete"
    />

    <!-- Convert to Reference Dialog (Issue #6791) -->
    <Dialog
      v-model:visible="showConvertToRefDialog"
      modal
      header="Конвертировать в справочник"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
      :closable="!convertIsProcessing"
      :closeOnEscape="!convertIsProcessing"
    >
      <div class="flex flex-column gap-4">
        <Message severity="info" :closable="false">
          Будет создана новая таблица-справочник с уникальными значениями из колонки <strong>{{ convertColumnHeader?.value }}</strong>.
          Текущая колонка будет преобразована в ссылку на эту таблицу.
        </Message>

        <div class="field">
          <label for="newTableName" class="font-bold block mb-2">
            Название новой таблицы-справочника *
          </label>
          <InputText
            id="newTableName"
            v-model="convertNewTableName"
            placeholder="Например: Категории"
            class="w-full"
            :disabled="convertIsProcessing"
          />
        </div>

        <div class="field">
          <label class="font-bold block mb-2">Уникальные значения</label>
          <div class="p-3 surface-100 border-round">
            <p class="mb-2">Найдено уникальных значений: <strong>{{ convertUniqueValues.length }}</strong></p>
            <div class="text-sm text-color-secondary max-h-10rem overflow-y-auto">
              <div v-for="(val, i) in convertUniqueValues.slice(0, 20)" :key="i" class="py-1">
                • {{ val }}
              </div>
              <div v-if="convertUniqueValues.length > 20" class="py-1 font-italic">
                ... и ещё {{ convertUniqueValues.length - 20 }} значений
              </div>
            </div>
          </div>
        </div>

        <div v-if="convertIsProcessing" class="field">
          <label class="font-bold block mb-2">Прогресс</label>
          <ProgressBar :value="convertProgress" :showValue="false" style="height: 8px;" />
          <p class="text-sm text-color-secondary mt-1">{{ Math.round(convertProgress) }}%</p>
        </div>
      </div>

      <template #footer>
        <Button
          label="Отмена"
          text
          @click="showConvertToRefDialog = false"
          :disabled="convertIsProcessing"
        />
        <Button
          label="Конвертировать"
          icon="pi pi-arrow-right"
          :loading="convertIsProcessing"
          :disabled="!convertNewTableName.trim() || convertUniqueValues.length === 0"
          @click="convertTextToReference(convertColumnHeader.id, convertNewTableName)"
        />
      </template>
    </Dialog>

    <!-- Convert to Text Dialog (Issue #6791) -->
    <Dialog
      v-model:visible="showConvertToTextDialog"
      modal
      header="Преобразовать в текст"
      :style="{ width: '28rem' }"
      :breakpoints="{ '640px': '95vw' }"
      :closable="!convertIsProcessing"
      :closeOnEscape="!convertIsProcessing"
    >
      <div class="flex flex-column gap-4">
        <Message severity="warn" :closable="false">
          Колонка <strong>{{ convertColumnHeader?.value }}</strong> будет преобразована в текстовый тип.
          Все ссылки на справочник будут заменены текстовыми значениями.
        </Message>

        <div class="p-3 surface-100 border-round">
          <p class="text-sm">
            <i class="pi pi-info-circle mr-2"></i>
            Таблица-справочник не будет удалена и останется доступной.
          </p>
        </div>

        <div v-if="convertIsProcessing" class="field">
          <label class="font-bold block mb-2">Прогресс</label>
          <ProgressBar :value="convertProgress" :showValue="false" style="height: 8px;" />
          <p class="text-sm text-color-secondary mt-1">{{ Math.round(convertProgress) }}%</p>
        </div>
      </div>

      <template #footer>
        <Button
          label="Отмена"
          text
          @click="showConvertToTextDialog = false"
          :disabled="convertIsProcessing"
        />
        <Button
          label="Преобразовать"
          icon="pi pi-arrow-right"
          severity="warning"
          :loading="convertIsProcessing"
          @click="convertReferenceToText(convertColumnHeader.id)"
        />
      </template>
    </Dialog>

    <!-- Directory Table Dialog -->
    <Dialog
      v-model:visible="directoryDialog.visible"
      :header="directoryDialog.typeName || 'Справочник'"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '1200px' }"
      :breakpoints="{ '1200px': '90vw', '640px': '98vw' }"
      :maximizable="true"
      class="directory-table-dialog"
    >
      <div v-if="directoryDialog.typeId" class="directory-table-content">
        <IntegramDataTableWrapper
          :key="'dir-' + directoryDialog.typeId + '-' + directoryDialog.dirRowId"
          :typeId="directoryDialog.typeId"
          :database="database"
          :filterId="directoryDialog.dirRowId"
          :embedded="true"
        />
      </div>
      <template #footer>
        <Button label="Закрыть" @click="directoryDialog.visible = false" />
      </template>
    </Dialog>

    <!-- Help Dialog -->
    <Dialog
      v-model:visible="showHelpDialog"
      header="Справка по таблице"
      :modal="true"
      :style="{ width: '800px', maxHeight: '90vh' }"
      :breakpoints="{ '960px': '95vw' }"
      class="help-dialog"
    >
      <div class="help-content">
        <!-- Overview Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-info-circle"></i>
            <h3>Обзор</h3>
          </div>
          <div class="help-info-block">
            <p>Интерактивная таблица данных с поддержкой редактирования, фильтрации, сортировки и работы со связанными данными (справочниками и подчинёнными таблицами).</p>
          </div>
        </div>

        <!-- Navigation Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-arrows-alt"></i>
            <h3>Навигация и выделение</h3>
          </div>
          <div class="help-grid">
            <div class="help-card">
              <div class="help-card-icon">🖱️</div>
              <div class="help-card-title">Клик по ячейке</div>
              <div class="help-card-desc">Выделяет ячейку. Для справочников и подчинённых таблиц — открывает их в модальном окне.</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">👆👆</div>
              <div class="help-card-title">Двойной клик</div>
              <div class="help-card-desc">Входит в режим редактирования ячейки (если включён режим двойного клика).</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">🔲</div>
              <div class="help-card-title">Выделение диапазона</div>
              <div class="help-card-desc">Зажмите мышь и проведите по ячейкам для выделения. Внизу появится статус-бар с агрегациями (сумма, среднее, мин/макс).</div>
            </div>
          </div>
        </div>

        <!-- Preview Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-eye"></i>
            <h3>Предварительный просмотр</h3>
          </div>
          <div class="help-info-block">
            <h4>Наведение на справочник</h4>
            <p>При наведении курсора на значение справочника (ссылку) появляется всплывающее окно с детальной информацией о записи: все поля, включая подчинённые таблицы (показывается количество).</p>
          </div>
          <div class="help-info-block mt-3">
            <h4>Клик по справочнику</h4>
            <p>Открывает справочник в модальном окне с фильтрацией по конкретной записи.</p>
          </div>
        </div>

        <!-- Editing Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-pencil"></i>
            <h3>Редактирование</h3>
          </div>
          <div class="help-grid">
            <div class="help-card">
              <div class="help-card-icon">✏️</div>
              <div class="help-card-title">Режим редактирования</div>
              <div class="help-card-desc">Нажмите кнопку <i class="pi pi-pencil"></i> в тулбаре для переключения между режимами: одинарный клик / двойной клик.</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">💾</div>
              <div class="help-card-title">Сохранение</div>
              <div class="help-card-desc"><kbd>Enter</kbd> — сохранить изменения.<br><kbd>Esc</kbd> — отменить редактирование.</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">🟢</div>
              <div class="help-card-title">Индикатор изменений</div>
              <div class="help-card-desc">Зелёный треугольник в углу ячейки означает, что она была изменена в текущей сессии.</div>
            </div>
          </div>
        </div>

        <!-- Fill Handle Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-arrows-v"></i>
            <h3>Автозаполнение (протяжка)</h3>
          </div>
          <div class="help-info-block">
            <p>При выделении ячейки в правом нижнем углу появляется маркер заполнения (маленький квадрат). Потяните его вниз или вправо для автозаполнения:</p>
            <ul class="help-list">
              <li><strong>Числовые последовательности:</strong> 1, 2, 3 → 4, 5, 6...</li>
              <li><strong>Дни недели:</strong> Понедельник, Вторник → Среда, Четверг...</li>
              <li><strong>Месяцы:</strong> Январь, Февраль → Март, Апрель...</li>
              <li><strong>Копирование:</strong> одиночное значение копируется во все ячейки</li>
            </ul>
          </div>
        </div>

        <!-- Toolbar Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-bars"></i>
            <h3>Панель инструментов</h3>
          </div>
          <div class="help-toolbar-grid">
            <div class="help-toolbar-item">
              <i class="pi pi-refresh"></i>
              <span>Обновить данные</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-pencil"></i>
              <span>Режим редактирования</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-filter"></i>
              <span>Фильтры</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-check-square"></i>
              <span>Режим выделения строк</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-calculator"></i>
              <span>Футер с агрегациями</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-eye-slash"></i>
              <span>Видимость колонок</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-print"></i>
              <span>Печать таблицы</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-file-excel"></i>
              <span>Экспорт в Excel</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-file-pdf"></i>
              <span>Экспорт в PDF</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-cog"></i>
              <span>Настройки</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-plus"></i>
              <span>Новая строка</span>
            </div>
            <div class="help-toolbar-item">
              <i class="pi pi-plus-circle"></i>
              <span>Новая колонка</span>
            </div>
          </div>
        </div>

        <!-- Column Header Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-th-large"></i>
            <h3>Заголовки колонок</h3>
          </div>
          <div class="help-grid">
            <div class="help-card">
              <div class="help-card-icon">↕️</div>
              <div class="help-card-title">Сортировка</div>
              <div class="help-card-desc">Клик по заголовку сортирует данные. Повторный клик меняет направление. <kbd>Ctrl</kbd>+клик для мультисортировки.</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">↔️</div>
              <div class="help-card-title">Изменение ширины</div>
              <div class="help-card-desc">Потяните границу между заголовками для изменения ширины колонки.</div>
            </div>
            <div class="help-card">
              <div class="help-card-icon">📌</div>
              <div class="help-card-title">Закрепление</div>
              <div class="help-card-desc">ПКМ по заголовку → "Закрепить колонку". Закреплённые колонки остаются видимы при горизонтальной прокрутке.</div>
            </div>
          </div>
        </div>

        <!-- Context Menu Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-list"></i>
            <h3>Контекстное меню (ПКМ)</h3>
          </div>
          <div class="help-info-block">
            <h4>По заголовку колонки</h4>
            <ul class="help-list">
              <li>Сортировка по возрастанию / убыванию</li>
              <li>Закрепить / открепить колонку</li>
              <li>Показать дубликаты (выделяет повторяющиеся значения цветом)</li>
              <li>Скрыть колонку</li>
            </ul>
          </div>
          <div class="help-info-block mt-3">
            <h4>По строке</h4>
            <ul class="help-list">
              <li>Редактировать строку (форма со всеми полями)</li>
              <li>Переместить вверх (изменить порядок)</li>
              <li>Изменить родителя (для иерархических таблиц)</li>
              <li>Удалить строку</li>
            </ul>
          </div>
        </div>

        <!-- Keyboard Shortcuts Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-key"></i>
            <h3>Горячие клавиши</h3>
          </div>
          <div class="help-shortcuts">
            <div class="help-shortcut">
              <kbd>Enter</kbd>
              <span>Сохранить редактирование</span>
            </div>
            <div class="help-shortcut">
              <kbd>Esc</kbd>
              <span>Отменить редактирование</span>
            </div>
            <div class="help-shortcut">
              <kbd>F3</kbd>
              <span>Следующее совпадение поиска</span>
            </div>
            <div class="help-shortcut">
              <kbd>Shift</kbd> + <kbd>F3</kbd>
              <span>Предыдущее совпадение поиска</span>
            </div>
            <div class="help-shortcut">
              <kbd>Ctrl</kbd> + клик по заголовку
              <span>Мультисортировка</span>
            </div>
          </div>
        </div>

        <!-- Duplicates Section -->
        <div class="help-section">
          <div class="help-section-header">
            <i class="pi pi-copy"></i>
            <h3>Поиск дубликатов</h3>
          </div>
          <div class="help-info-block">
            <p>ПКМ по заголовку колонки → "Показать дубликаты". Повторяющиеся значения будут выделены разными цветами (каждая группа своим цветом). В подсказке показывается количество повторений.</p>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Понятно" icon="pi pi-check" @click="showHelpDialog = false" />
      </template>
    </Dialog>

    <!-- Settings Dialog -->
    <Dialog
      v-model:visible="showSettingsDialog"
      header="Настройки таблицы"
      :modal="true"
      :style="{ width: '600px', maxHeight: '90vh' }"
      :breakpoints="{ '960px': '95vw' }"
      class="settings-dialog"
    >
      <div class="settings-content">
        <!-- Loading Settings Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <i class="pi pi-download"></i>
            <h3>Загрузка данных</h3>
          </div>
          <div class="settings-options">
            <div class="settings-option">
              <Checkbox
                v-model="settings.autoLoadAll"
                inputId="settingsAutoLoadCheckbox"
                binary
                @change="toggleAutoLoad(settings.autoLoadAll)"
              />
              <div class="settings-option-content">
                <label for="settingsAutoLoadCheckbox" class="settings-option-label">
                  Автоматически загружать все данные
                </label>
                <small class="settings-option-desc">
                  Загрузит все строки таблицы в фоне. Фильтрация и поиск будут работать по всем записям.
                </small>
              </div>
            </div>
            <div class="settings-option">
              <Checkbox
                v-model="settings.autoLoadDirs"
                inputId="settingsAutoLoadDirsCheckbox"
                binary
                @change="toggleAutoLoadDirs(settings.autoLoadDirs)"
              />
              <div class="settings-option-content">
                <label for="settingsAutoLoadDirsCheckbox" class="settings-option-label">
                  Автозагрузка справочников
                </label>
                <small class="settings-option-desc">
                  Загрузит данные всех справочников с задержкой 500мс между запросами.
                </small>
              </div>
            </div>
            <div class="settings-info-note">
              <i class="pi pi-info-circle"></i>
              <span>Для таблиц > {{ settings.maxAutoLoadSize.toLocaleString() }} записей автозагрузка отключена.</span>
            </div>
          </div>
        </div>

        <!-- Date Style Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <i class="pi pi-calendar"></i>
            <h3>Отображение дат</h3>
          </div>
          <div class="date-style-grid">
            <div
              class="date-style-card"
              :class="{ active: settings.dateStyle === 'classic' }"
              @click="setDateStyle('classic')"
            >
              <div class="date-style-preview classic">
                <span class="date-dir-preview">18.12.2024</span>
              </div>
              <div class="date-style-name">Классический</div>
              <div class="date-style-desc">Стиль справочника</div>
            </div>

            <div
              class="date-style-card"
              :class="{ active: settings.dateStyle === 'relative' }"
              @click="setDateStyle('relative')"
            >
              <div class="date-style-preview relative">
                <span class="date-dir-preview today">Сегодня</span>
              </div>
              <div class="date-style-name">Относительный</div>
              <div class="date-style-desc">Стиль справочника + относит.</div>
            </div>

            <div
              class="date-style-card"
              :class="{ active: settings.dateStyle === 'pill' }"
              @click="setDateStyle('pill')"
            >
              <div class="date-style-preview pill">
                <span class="date-nested-preview">Сегодня</span>
              </div>
              <div class="date-style-name">Капсула</div>
              <div class="date-style-desc">Как вложенные таблицы</div>
            </div>
          </div>
        </div>

        <!-- Edit Style Section (Issue #6651) -->
        <div class="settings-section">
          <div class="settings-section-header">
            <i class="pi pi-pencil"></i>
            <h3>Редактирование</h3>
          </div>
          <div class="settings-options">
            <div class="settings-option">
              <Checkbox
                v-model="settings.showSavePopup"
                inputId="settingsShowSavePopup"
                binary
                @change="toggleShowSavePopup(settings.showSavePopup)"
              />
              <div class="settings-option-content">
                <label for="settingsShowSavePopup" class="settings-option-label">
                  Диалог «Редактировать строку»
                </label>
                <small class="settings-option-desc">
                  Показывать диалог с кнопкой «Сохранить» при двойном клике на строке. Если выключено — строка редактируется только через контекстное меню.
                </small>
              </div>
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <Button label="Готово" icon="pi pi-check" @click="showSettingsDialog = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick, inject, triggerRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

// Safe injection helpers for embedded mode (sub-app may lack some providers)
const safeUseRouter = () => { try { return useRouter() } catch { return null } }
const safeUseRoute = () => { try { return useRoute() || { params: {}, query: {} } } catch { return { params: {}, query: {} } } }
const safeUseToast = () => { try { return useToast() } catch { return { add: () => {} } } }
const safeUseConfirm = () => { try { return useConfirm() } catch { return { require: (opts) => opts.accept?.() } } }
import { useIntegramSession } from '@/composables/useIntegramSession'
import integramApiClient from '@/services/integramApiClient'
import { integramEventBus } from '@/services/integramEventBus'
import { useIntegramSync } from '@/composables/useIntegramSync'
import { selectorState, getGlobalSelector, setGlobalSelector } from '@/stores/selectorState'
// Issue #6742: Step 2 — WebSocket sync for cross-tab/cross-user propagation
const integramSync = useIntegramSync()
import { saveDDLAlias, saveDDLAttrs, updateBlock } from '@/services/docBlocksApiService'
import { getCurrentUserId, getDefaultToken } from '@/services/aiTokenService'
import { getApiUrl } from '@/utils/apiConfig'
import DataTable from '@/components/integram/DataTable.vue'
import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue'
import { useIntegramBreadcrumb } from '@/composables/useIntegramBreadcrumb'
import AIFillTableDialog from '@/components/integram/DataTable/dialogs/AIFillTableDialog.vue'
import ImportTableDialog from '@/components/integram/DataTable/dialogs/ImportTableDialog.vue'
import VersionHistoryPanel from '@/components/integram/DataTable/dialogs/VersionHistoryPanel.vue'
import ReferenceField from '@/components/integram/fields/ReferenceField.vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Calendar from 'primevue/calendar'
import Checkbox from 'primevue/checkbox'
import FilterConditionsDialog from '@/components/integram/FilterConditionsDialog.vue'

// Heavy libraries loaded dynamically on demand
let html2canvasModule = null
let jsPDFModule = null
let XLSXModule = null

const props = defineProps({
  // Props can override route params if needed
  typeIdProp: {
    type: [String, Number],
    default: null
  },
  // Alternative prop names for embedded use
  typeId: {
    type: [String, Number],
    default: null
  },
  databaseProp: {
    type: String,
    default: null
  },
  database: {
    type: String,
    default: null
  },
  serverUrl: {
    type: String,
    default: null
  },
  // Hide breadcrumb and some controls when embedded
  embedded: {
    type: Boolean,
    default: false
  },
  // Parent ID for filtering subordinate objects (F_U filter)
  parentId: {
    type: [String, Number],
    default: null
  },
  // Filter by specific object ID (F_I filter)
  filterId: {
    type: [String, Number],
    default: null
  },
  // Edit mode: 'double-click' | 'single-click'. Defaults to 'single-click' when embedded.
  editModeProp: {
    type: String,
    default: null
  },
  // Selector integration: name of the selector to listen to
  selectorName: {
    type: String,
    default: null
  },
  // Selector integration: column to filter by ('__val__' for main field or a requisite ID)
  selectorColumnId: {
    type: String,
    default: null
  },
  // Block-level settings from DB metadata (shared across all users, per block)
  blockId: {
    type: [String, Number],
    default: null
  },
  // When set, signals that this table is embedded inside IntegramTabsEmbed.
  // Filters and column visibility are managed per-tab by the parent, not via localStorage/blockId.
  tabId: {
    default: null
  },
  // When set, isolates localStorage filter key to a specific instance (tab/block).
  // Used by nested subordinate dialogs to inherit the parent tab's instanceId so their
  // filter settings are stored per-tab, not globally.
  // Does NOT trigger the tabId event-delegation mechanism — localStorage is still used.
  instanceId: {
    default: null
  },
  initialFilterConditions: {
    type: Array,
    default: null
  },
  initialSelectedColumns: {
    type: Object,
    default: null
  },
  // Alternative prop name for column visibility (used in IntegramTabsEmbed)
  columnVisibility: {
    type: Object,
    default: null
  },
  initialColumnWidths: {
    type: Object,
    default: null
  },
  // Column order stored in block metadata (free reorder without DB changes)
  initialColumnOrder: {
    type: Array,
    default: null
  },
  // Virtual lookup columns (Relation) — no DB requisite, stored in block metadata
  initialVirtualColumns: {
    type: Array,
    default: null
  },
  // When true: skip background loading of all rows (used in IntegramTabsEmbed for lazy loading)
  disableAutoLoadAll: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['table-loaded', 'update:columnVisibility', 'settings-updated'])

// Topbar breadcrumb integration (only when not embedded — i.e. standalone table view in IntegramMain)
const { setExtra, clearExtra } = useIntegramBreadcrumb()

// Use safe injection helpers to support embedded mode (sub-app context)
const route = safeUseRoute()
const router = safeUseRouter()

// Issue #6777: Inject WebSocket table update function (optional, only available in BlockDocumentEditor)
const wsSendTableUpdate = inject('wsSendTableUpdate', null)

// Unique ID for this component instance — used to skip own event-bus events
const _componentId = `wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}`

// Get typeId from route params or prop
const typeId = computed(() => props.typeIdProp || props.typeId || route.params?.typeId)
const toast = safeUseToast()
const confirm = safeUseConfirm()
const { isAuthenticated, database: sessionDatabase } = useIntegramSession()

// Issue #6514: Reactive flag for kval auto-auth (isAuthenticated computed can't track non-reactive client)
const kvalAutoAuthed = ref(false)

// Selector state (module-level singleton, works across sub-apps without Pinia)

// State
const loading = ref(true) // Start as true to prevent flash of table before data loads
const loadingMore = ref(false)
const error = ref(null)
const creating = ref(false)
const isAddingRow = ref(false)
const isAddingColumn = ref(false)
const showAddColumnDialog = ref(false)
const newColumnType = ref(3) // Default: SHORT text
const newColumnAlias = ref('')
const isReferenceColumn = ref(false)
const referenceTableId = ref(null)
const referenceTableOptions = ref([])
const loadingReferenceTables = ref(false)
// Virtual columns (Relation/Lookup) — defined in block metadata, no DB requisite
const virtualColumns = ref([]) // [{ id, name, refColumnId, targetFieldId }]
// Column display order — stored in block metadata, independent of DB order
const columnOrder = ref([]) // array of column id strings
// Local cache of block metadata — prevents separate saves from overwriting each other
const blockMetadataCache = ref({})

// Lookup column configuration (Issue #6792, #6873)
const isLookupColumn = ref(false)
const lookupSourceReqId = ref(null) // Reference column in current table
const lookupTargetReqId = ref(null) // Field to display from target table (deprecated - use lookupSelectedTargetIds)
const lookupSelectedTargetIds = ref([]) // Issue #6873: Array of selected target field IDs for multi-select
const lookupSourceOptions = ref([]) // Available ref columns in current table
const lookupTargetOptions = ref([]) // Available fields in target table
const loadingLookupTargetFields = ref(false)
// Issue #6714: Use single-click edit mode when embedded (Quill intercepts dblclick)
const editMode = ref(props.editModeProp || (props.embedded ? 'single-click' : 'double-click'))
const showCreateDialog = ref(false)
const showColumnSelector = ref(false)
const dataTableRef = ref(null)
// Import dialog (Issue #6673)
const showImportDialog = ref(false)

// Row selection mode (Phase 1 - Feature Roadmap)
const isSelectionModeActive = ref(false)

function toggleSelectionMode() {
  if (dataTableRef.value) {
    dataTableRef.value.toggleSelectionMode()
    isSelectionModeActive.value = dataTableRef.value.selectionModeEnabled()
  }
}

// Footer aggregations (Phase 1 - Feature Roadmap)
const isFooterActive = ref(false)

function toggleFooter() {
  if (dataTableRef.value) {
    dataTableRef.value.toggleFooter()
    isFooterActive.value = dataTableRef.value.isFooterVisible()
  }
}

// Row Density (Phase 2 - Feature Roadmap)
const rowDensity = ref('comfortable') // 'compact' | 'comfortable' | 'spacious'

function cycleRowDensity() {
  const densities = ['compact', 'comfortable', 'spacious']
  const currentIndex = densities.indexOf(rowDensity.value)
  rowDensity.value = densities[(currentIndex + 1) % densities.length]
}

function getRowDensityIcon() {
  switch (rowDensity.value) {
    case 'compact': return 'pi pi-bars'
    case 'comfortable': return 'pi pi-th-large'
    case 'spacious': return 'pi pi-stop'
    default: return 'pi pi-th-large'
  }
}

function getRowDensityLabel() {
  switch (rowDensity.value) {
    case 'compact': return 'Компактный'
    case 'comfortable': return 'Удобный'
    case 'spacious': return 'Просторный'
    default: return 'Удобный'
  }
}

// Text wrap mode (Issue #6779)
const textWrapEnabled = ref(false)

function toggleTextWrap() {
  textWrapEnabled.value = !textWrapEnabled.value
  // Save to block metadata
  saveTextWrapSetting()
}

async function saveTextWrapSetting() {
  if (props.blockId) {
    try {
      await saveBlockMetadata({ textWrapEnabled: textWrapEnabled.value })
      console.log('[saveTextWrapSetting] Text wrap setting saved to metadata:', textWrapEnabled.value)
    } catch (e) {
      console.error('[saveTextWrapSetting] Error saving to DB:', e)
    }
  }
  // Also save to localStorage as fallback
  if (typeId.value) {
    try {
      localStorage.setItem(`datatable_textwrap_${database.value}_${typeId.value}`, JSON.stringify(textWrapEnabled.value))
    } catch (e) {
      console.error('[saveTextWrapSetting] Error saving to localStorage:', e)
    }
  }
}

function loadTextWrapSetting() {
  // Priority: DB metadata > localStorage
  if (props.initialFilterConditions && typeof props.blockId !== 'undefined') {
    // Try to get from block metadata (passed as prop or fetched separately)
    // For now, we'll load from localStorage as the primary mechanism
    // TODO: Extend props to include initialTextWrapEnabled if needed
  }

  // Load from localStorage
  if (typeId.value) {
    try {
      const stored = localStorage.getItem(`datatable_textwrap_${database.value}_${typeId.value}`)
      if (stored !== null) {
        textWrapEnabled.value = JSON.parse(stored)
        console.log('[loadTextWrapSetting] Loaded from localStorage:', textWrapEnabled.value)
      }
    } catch (e) {
      console.error('[loadTextWrapSetting] Error loading from localStorage:', e)
    }
  }
}

// Background directory loading (Phase 1 - Settings)
const isLoadingDirs = ref(false)
const dirLoadProgress = ref({ loaded: 0, total: 0 })
let dirLoadProgressInterval = null

function toggleBackgroundLoading() {
  if (!dataTableRef.value) return

  if (isLoadingDirs.value) {
    // Stop loading
    dataTableRef.value.stopBackgroundLoading()
    isLoadingDirs.value = false
    if (dirLoadProgressInterval) {
      clearInterval(dirLoadProgressInterval)
      dirLoadProgressInterval = null
    }
  } else {
    // Start loading (pass autoLoadDirs setting to function)
    isLoadingDirs.value = true
    dataTableRef.value.loadAllDirDataInBackground(settings.value.autoLoadDirs)

    // Update progress every 200ms
    dirLoadProgressInterval = setInterval(() => {
      if (dataTableRef.value) {
        dirLoadProgress.value = dataTableRef.value.backgroundLoadProgress()
        isLoadingDirs.value = dataTableRef.value.isBackgroundLoadingDirs()

        // Stop interval when loading completes
        if (!isLoadingDirs.value) {
          clearInterval(dirLoadProgressInterval)
          dirLoadProgressInterval = null
        }
      }
    }, 200)
  }
}

function toggleAutoLoadDirs(enabled) {
  // Ensure enabled is a boolean, not a string
  const enabledBool = enabled === true || enabled === 'true'
  console.log('[toggleAutoLoadDirs] Изменяем автозагрузку справочников:', { enabled, enabledBool, previous: settings.value.autoLoadDirs })

  // ВАЖНО: Отключаем загрузку если она уже происходит
  if (!enabledBool && dirLoadProgressInterval) {
    clearInterval(dirLoadProgressInterval)
    dirLoadProgressInterval = null
    if (dataTableRef.value) {
      dataTableRef.value.stopBackgroundLoading()
    }
    console.log('[toggleAutoLoadDirs] Остановили текущую загрузку справочников')
  }

  settings.value.autoLoadDirs = enabledBool
  // ВАЖНО: Передаем plain object вместо Proxy для корректной сериализации в JSON
  saveSettings({ ...settings.value })

  if (enabledBool && dataTableRef.value) {
    console.log('[toggleAutoLoadDirs] Запускаем фоновую загрузку справочников')
    isLoadingDirs.value = true
    dataTableRef.value.loadAllDirDataInBackground(enabledBool)

    // Update progress every 200ms
    dirLoadProgressInterval = setInterval(() => {
      if (dataTableRef.value) {
        dirLoadProgress.value = dataTableRef.value.backgroundLoadProgress()
        isLoadingDirs.value = dataTableRef.value.isBackgroundLoadingDirs()

        // Stop interval when loading completes
        if (!isLoadingDirs.value) {
          // console.log('[toggleAutoLoadDirs] Фоновая загрузка справочников завершена')
          clearInterval(dirLoadProgressInterval)
          dirLoadProgressInterval = null
        }
      }
    }, 200)
  } else {
    console.log('[toggleAutoLoadDirs] Автозагрузка справочников отключена')
  }
}

// Nested (subordinate) table dialog state (full 80vw dialog)
const nestedDialog = ref({
  visible: false,
  tableId: null,
  parentRowId: null,
  tableName: '',
  loading: false
})

// AI Fill Table dialog state (Issue #6622)
const aiFillDialog = ref({
  visible: false,
  tableId: null,
  tableName: '',
  parentRowId: null,
  tableStructure: [] // Column definitions for the table
})

// Issue #7191: Version history panel state
const versionHistoryPanel = ref({
  visible: false,
  objId: null,
})

// Compact nested card state (quick edit without full component)
const nestedCard = ref({
  visible: false,
  tableId: null,
  parentRowId: null,
  tableName: '',
  records: [],       // loaded records list
  loading: false,
  newRecordName: '', // quick-add input value
  adding: false,     // adding in progress
  editingId: null,   // which record is being edited inline
  editingVal: '',    // current edit value
})

// Directory table dialog state
const directoryDialog = ref({
  visible: false,
  typeId: null,
  typeName: '',
  dirRowId: null
})

// Help dialog state
const showHelpDialog = ref(false)

// Settings dialog state
const showSettingsDialog = ref(false)

// Search & Filter state
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const isFilterDialogVisible = ref(false)
const filterConditions = ref([])
const filterApplyButton = ref(null)
// Reference field picker state (keyed by dirTableId)
const refFilterOptions = ref({})   // { [dirTableId]: [{id, label}] }
const refFilterLoading = ref({})
let searchDebounceTimer = null

// Search Navigation (Phase 2 - Feature Roadmap)
const searchMatches = ref([]) // Array of { rowId, headerId, value }
const currentMatchIndex = ref(-1)

// Column visibility
const allHeaders = ref([]) // All headers from API
const selectedColumns = ref({}) // { headerId: true/false }

// Data
const typeData = ref(null)
const requisitesMeta = ref([])
// Issue #6769: Auto-detected selector binding (from DOM scan after first loadData)
const autoSelectorName = ref(null)
const autoSelectorColumnId = ref(null)
const headers = ref([])
const rows = ref([])

// Pagination
const currentPage = ref(1)
const rowsPerPage = ref(50)
const hasMore = ref(false)

// Background loading & Smart loading
const STORAGE_KEY = 'datatable_settings'
const DEFAULT_SETTINGS = {
  autoLoadAll: false,          // Фоновая загрузка всех данных (откл по умолчанию, Issue #7183)
  autoLoadDirs: false,         // Автозагрузка справочников (откл по умолчанию, Issue #7183)
  maxAutoLoadSize: 20000,      // Макс размер для автозагрузки
  backgroundChunkSize: 1000,   // Размер chunk
  backgroundDelay: 150,        // Задержка между chunk (мс)
  dateStyle: 'classic',         // Стиль дат: classic (DD.MM.YYYY), relative, pill
  showSavePopup: false         // Issue #6651: Показывать диалог "Сохранить" при редактировании строки
}

// Load settings from localStorage
// ВАЖНО: Эта функция СОЗДАЕТ запись в localStorage при первом открытии!
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      // ✅ Пользователь уже открывал таблицу ранее - используем СОХРАНЕННЫЕ настройки
      const parsedSettings = JSON.parse(stored)
      // Force dateStyle to classic (override cached 'relative')
      parsedSettings.dateStyle = DEFAULT_SETTINGS.dateStyle
      console.log('[loadSettings] Загружены сохраненные настройки из localStorage:', parsedSettings)
      return { ...DEFAULT_SETTINGS, ...parsedSettings }
    } else {
      // ✅ ПЕРВОЕ ОТКРЫТИЕ - инициализируем localStorage с дефолтными значениями
      console.log('[loadSettings] ПЕРВОЕ ОТКРЫТИЕ: инициализируем localStorage с дефолтными настройками')
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
      return DEFAULT_SETTINGS
    }
  } catch (e) {
    console.error('[loadSettings] Ошибка при загрузке настроек:', e)
    // При ошибке все равно пытаемся сохранить дефолты
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    } catch {
      console.error('[loadSettings] Не удалось сохранить дефолтные настройки')
    }
    return DEFAULT_SETTINGS
  }
}

// Save settings to localStorage
// ВАЖНО: Вызывается из toggleAutoLoad() и toggleAutoLoadDirs() когда пользователь изменяет настройки
function saveSettings(newSettings) {
  try {
    console.log('[saveSettings] Сохраняем НОВЫЕ настройки в localStorage:', newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  } catch (e) {
    console.error('[saveSettings] Ошибка при сохранении настроек:', e)
  }
}

// Filter conditions & column visibility persistence
// Приоритет: DB metadata (blockId props) > localStorage (fallback для standalone)

function getFiltersKey() {
  // Include instanceId (tab ID) to isolate filters per IntegramTabsEmbed tab
  const instanceSuffix = (props.instanceId || props.tabId) ? `_i${props.instanceId || props.tabId}` : ''
  // Include parentId so each subordinate table instance (per parent row) gets its own filter settings
  const parentSuffix = props.parentId ? `_p${props.parentId}` : ''
  return `datatable_filters_${database.value}_${typeId.value}${instanceSuffix}${parentSuffix}`
}

async function saveBlockSettings() {
  const conditions = filterConditions.value
  const columns = selectedColumns.value

  // 0. If inside IntegramTabsEmbed (tabId is set), delegate persistence to the parent.
  // Emit both columnVisibility and filterConditions so each tab stores its own settings.
  if (props.tabId) {
    emit('update:columnVisibility', columns)
    emit('settings-updated', { selectedColumns: columns, filterConditions: conditions })
    return
  }

  // 1. Если есть blockId — сохраняем в DB metadata (общие для всех пользователей)
  if (props.blockId) {
    try {
      // ISSUE #6871 FIX: Always save selectedColumns, not conditionally
      // Previously: Object.keys(columns).length ? columns : undefined
      // This would pass undefined even when columns had values like { col1: false, col2: false }
      await saveBlockMetadata({
        filterConditions: conditions.length ? conditions : undefined,
        selectedColumns: columns  // Save full object unconditionally
      })
      console.log('[saveBlockSettings] Настройки сохранены в DB metadata, blockId:', props.blockId)
    } catch (e) {
      console.error('[saveBlockSettings] Ошибка сохранения в DB:', e)
    }
    // Emit even when blockId is set, so blot data-value stays in sync with DB
    emit('settings-updated', { selectedColumns: columns, filterConditions: conditions })
    return
  }

  // 2. Fallback: localStorage (standalone режим без blockId)
  // ISSUE #6871 FIX: Save both filters AND column visibility
  try {
    const settingsToSave = {
      filterConditions: conditions,
      selectedColumns: columns
    }
    localStorage.setItem(getFiltersKey(), JSON.stringify(settingsToSave))
    console.log('[saveBlockSettings] Настройки сохранены в localStorage:', settingsToSave)
  } catch (e) {
    console.error('[saveBlockSettings] Ошибка сохранения в localStorage:', e)
  }

  // Emit so parent blot (block editor) can update data-value in the document
  emit('settings-updated', { selectedColumns: columns, filterConditions: conditions })
}

// Оставляем старое название для совместимости с вызовами в applyFilter/removeCondition/resetAllFilters
function saveFilterConditions() {
  saveBlockSettings()
}

function loadFilterConditions() {
  // 1. Из DB metadata (переданы через props initialFilterConditions)
  if (props.initialFilterConditions && Array.isArray(props.initialFilterConditions) && props.initialFilterConditions.length > 0) {
    filterConditions.value = props.initialFilterConditions
    console.log('[loadFilterConditions] Загружены фильтры из DB metadata:', props.initialFilterConditions)
    _mergePropSelectorIntoConditions()
    return
  }

  // 2. Fallback: localStorage (standalone режим)
  // ISSUE #6871 FIX: Restore both filters AND column visibility from localStorage
  // Skip when inside IntegramTabsEmbed (tabId is set) — filters come from tab.viewConfig
  if (!props.blockId && !props.tabId) {
    try {
      const stored = localStorage.getItem(getFiltersKey())
      if (stored) {
        const parsed = JSON.parse(stored)

        // Handle both old format (array) and new format (object with filterConditions + selectedColumns)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Old format: just an array of filter conditions
          filterConditions.value = parsed
          console.log('[loadFilterConditions] Загружены фильтры из localStorage (старый формат):', parsed)
        } else if (parsed && typeof parsed === 'object') {
          // New format: object with filterConditions and selectedColumns
          if (parsed.filterConditions && Array.isArray(parsed.filterConditions) && parsed.filterConditions.length > 0) {
            filterConditions.value = parsed.filterConditions
            console.log('[loadFilterConditions] Загружены фильтры из localStorage:', parsed.filterConditions)
          }

          // CRITICAL FIX: Also restore selectedColumns if present
          if (parsed.selectedColumns && typeof parsed.selectedColumns === 'object') {
            selectedColumns.value = parsed.selectedColumns
            console.log('[loadFilterConditions] Загружена видимость колонок из localStorage:', parsed.selectedColumns)
          }
        }
      }
    } catch (e) {
      console.error('[loadFilterConditions] Ошибка загрузки фильтров:', e)
    }
  }

  _mergePropSelectorIntoConditions()
}

// Convert legacy props.selectorName / props.selectorColumnId binding into a filterCondition
// so that all filtering is managed through the unified filter dialog.
function _mergePropSelectorIntoConditions() {
  if (!props.selectorName || !props.selectorColumnId) return
  const alreadyHas = filterConditions.value.some(
    c => c.valueSource === 'selector' && c.selectorName === props.selectorName
  )
  if (alreadyHas) return
  const headerId = props.selectorColumnId === '__val__' ? 'val' : `req_${props.selectorColumnId}`
  filterConditions.value.push({
    headerId,
    type: 3,
    columnType: 'regular',
    dirTableId: null,
    operator: 'equals',
    value: null,
    value2: null,
    valueSource: 'selector',
    selectorName: props.selectorName,
    hideColumn: false
  })
  console.log(`[loadFilterConditions] Converted prop selectorName="${props.selectorName}" → filterCondition`)
}

function loadColumnVisibility() {
  // 1. Priority: columnVisibility prop (from IntegramTabsEmbed)
  if (props.columnVisibility && typeof props.columnVisibility === 'object' && Object.keys(props.columnVisibility).length > 0) {
    selectedColumns.value = props.columnVisibility
    console.log('[loadColumnVisibility] Загружена видимость колонок из columnVisibility prop:', props.columnVisibility)
    return
  }

  // 2. Из DB metadata (переданы через props initialSelectedColumns)
  if (props.initialSelectedColumns && typeof props.initialSelectedColumns === 'object' && Object.keys(props.initialSelectedColumns).length > 0) {
    selectedColumns.value = props.initialSelectedColumns
    console.log('[loadColumnVisibility] Загружена видимость колонок из DB metadata:', props.initialSelectedColumns)
  }
}

const settings = ref(loadSettings())
const allRows = ref([])                    // Все загруженные строки
const isBackgroundLoading = ref(false)     // Флаг фоновой загрузки
const backgroundProgress = ref(0)          // Прогресс (0-100)
const loadedCount = ref(0)                 // Загружено записей
const totalCount = ref(0)                  // Всего записей
const allDataLoaded = ref(false)           // Все данные загружены
const backgroundLoadingAborted = ref(false) // Отменена ли загрузка

// Create form
const createForm = ref({
  value: '',
  requisites: {}
})

// Computed
const database = computed(() => props.databaseProp || props.database || route.params.database || sessionDatabase.value || 'A2025')

// API server URL for file downloads (FILE and PATH types)
// Priority: 1) prop, 2) integramApiClient.getServer(), 3) fallback to dronedoc.ru
const apiServerUrl = computed(() => {
  if (props.serverUrl) return props.serverUrl
  const serverFromClient = integramApiClient.getServer()
  return serverFromClient || 'https://ai2o.ru'
})

const breadcrumbItems = computed(() => {
  const items = [
    { label: 'Таблицы', to: `/integram/table`, icon: 'pi pi-table' }
  ]
  if (typeData.value?.val) {
    items.push({ label: typeData.value.val, icon: 'pi pi-bars' })
  }
  return items
})

// Editable requisites for create dialog (excludes nested/subordinate tables)
const editableRequisites = computed(() => {
  return requisitesMeta.value.filter(req => !req.isNested)
})

// Column options for selector dialog
const columnOptions = computed(() => {
  return allHeaders.value.map(h => ({
    id: h.id,
    value: h.value || h.title || `Column ${h.id}`
  }))
})

// Filtered rows based on search query and filter conditions
const filteredRows = computed(() => {
  // ВАЖНО: Используем allRows ТОЛЬКО когда загрузка ЗАВЕРШЕНА
  // Иначе таблица будет постоянно перерисовываться во время загрузки
  let result = allDataLoaded.value ? allRows.value : rows.value

  // ✅ ФИЛЬТРАЦИЯ ТЕПЕРЬ ВСЕГДА СЕРВЕРНАЯ
  // Клиентская фильтрация НЕ нужна - данные уже отфильтрованы на сервере
  // Только поиск (searchQuery) применяется на клиенте

  // Apply search query filter (клиентский поиск)
  const query = debouncedSearchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(row =>
      row.values.some(cell => String(cell.value || '').toLowerCase().includes(query))
    )
  }

  // filterConditions применяются на СЕРВЕРЕ через buildServerFilters()
  // НЕ дублируем фильтрацию на клиенте!

  return result
})

// Issue #6856: Show banner when auto-selector filter is active and returns 0 rows
const activeAutoSelectorValue = computed(() => {
  if (!autoSelectorName.value) return null
  return getGlobalSelector(autoSelectorName.value) || null
})

// Embedded pagination: show 30 rows per page when embedded
const EMBEDDED_PAGE_SIZE = 30
const embeddedPage = ref(1)

const needsPagination = computed(() => {
  return props.embedded && filteredRows.value.length > EMBEDDED_PAGE_SIZE
})

const totalEmbeddedPages = computed(() => {
  return Math.ceil(filteredRows.value.length / EMBEDDED_PAGE_SIZE)
})

const paginatedRows = computed(() => {
  if (!props.embedded || filteredRows.value.length <= EMBEDDED_PAGE_SIZE) {
    return filteredRows.value
  }
  const start = (embeddedPage.value - 1) * EMBEDDED_PAGE_SIZE
  return filteredRows.value.slice(start, start + EMBEDDED_PAGE_SIZE)
})

// Показывать ли предупреждение о неполных данных
const showPartialDataWarning = computed(() => {
  // Фильтры теперь ВСЕГДА серверные - предупреждение не нужно
  // Показывать только если:
  // 1. Данные не загружены полностью
  // 2. Есть ПОИСК (searchQuery) - он клиентский
  // 3. Автозагрузка включена
  return settings.value.autoLoadAll &&
         !allDataLoaded.value &&
         !isBackgroundLoading.value &&
         searchQuery.value.trim().length > 0
})

// Helper function to check if a cell value matches a filter condition
/**
 * Resolve column display alias from Integram API response data.
 * _d_alias stores the alias in req_attrs[reqId]. For AI columns, _d_attrs overwrites
 * req_attrs with ':ALIAS=Name:ai-agent:p=prompt:...' — we extract the ALIAS value.
 * Falls back to req_type[reqId] (the concrete type's default name, e.g. 'Кнопка ИИ').
 */
function resolveColumnAlias(reqId, reqType, reqAttrs) {
  const rawAttrs = reqAttrs?.[reqId] || ''
  if (rawAttrs) {
    // Formatted attrs string: :ALIAS=Name:ai-agent:... → extract Name
    const aliasMatch = rawAttrs.match(/:ALIAS=([^:]+):/)
    if (aliasMatch) return aliasMatch[1]
    // Plain alias set by _d_alias (no colon formatting)
    if (!rawAttrs.startsWith(':')) return rawAttrs
  }
  const rawTypeName = reqType?.[reqId] || `Req ${reqId}`
  // Issue #6651: req_type value may contain 'TypeName:ALIAS=Alias:' format
  // In that case extract the ALIAS part for a cleaner display name
  const typeAliasMatch = rawTypeName.match(/:ALIAS=([^:]+):/)
  if (typeAliasMatch) return typeAliasMatch[1]
  return rawTypeName
}

function matchesCondition(cellValue, condition) {
  const { operator, value, value2, type } = condition
  const strValue = String(cellValue).toLowerCase()
  const filterValue = String(value || '').toLowerCase()

  switch (operator) {
    case 'contains':
      return strValue.includes(filterValue)
    case 'equals':
      if (type === 13 || type === 14) { // NUMBER types
        return Number(cellValue) === Number(value)
      }
      return strValue === filterValue
    case 'notEquals':
      return strValue !== filterValue
    case 'startsWith':
      return strValue.startsWith(filterValue)
    case 'endsWith':
      return strValue.endsWith(filterValue)
    case 'isEmpty':
      return !cellValue || strValue.trim() === ''
    case 'greater':
      return Number(cellValue) > Number(value)
    case 'less':
      return Number(cellValue) < Number(value)
    case 'between': {
      const numValue = Number(cellValue)
      return numValue >= Number(value) && numValue <= Number(value2)
    }
    default:
      return true
  }
}

// Headers available for filtering
const filterableHeaders = computed(() => {
  // Use allHeaders so hidden columns can still be used as filter criteria
  return allHeaders.value.filter(header => header.type !== 10)
})

/**
 * Нормализованные поля для FilterConditionsDialog:
 * { id, label, type, columnType, dirTableId }
 * (FilterConditionsDialog ожидает именно этот формат)
 */
const filterableFieldsForDialog = computed(() =>
  filterableHeaders.value.map(h => ({
    id: h.id,
    label: h.value,
    type: h.type,
    columnType: h.columnType || 'regular',
    dirTableId: h.dirTableId || null
  }))
)

/**
 * Обработчик события @apply из FilterConditionsDialog.
 * Принимает новый массив условий, обновляет filterConditions и перезагружает данные.
 */
async function onFilterDialogApply(newConditions) {
  filterConditions.value = newConditions
  await applyFilter()
}

/**
 * Обработчик события @reset из FilterConditionsDialog.
 * Очищает все условия, закрывает диалог и перезагружает данные.
 */
async function onFilterDialogReset() {
  isFilterDialogVisible.value = false
  await resetAllFilters()
}

// Check if there are active filters
const hasActiveFilters = computed(() => {
  return filterConditions.value.some(c =>
    c.operator === 'isEmpty' || (c.value !== null && c.value !== '')
  )
})

// Filter operators configuration
const OPERATORS = {
  text: [
    { label: 'содержит', value: 'contains' },
    { label: 'равно', value: 'equals' },
    { label: 'начинается с', value: 'startsWith' },
    { label: 'заканчивается на', value: 'endsWith' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  number: [
    { label: 'равно', value: 'equals' },
    { label: 'больше', value: 'greater' },
    { label: 'меньше', value: 'less' },
    { label: 'между', value: 'between' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  date: [
    { label: 'равно', value: 'equals' },
    { label: 'между', value: 'between' },
    { label: 'пусто', value: 'isEmpty' }
  ],
  boolean: [
    { label: 'равно', value: 'equals' },
    { label: 'не равно', value: 'notEquals' }
  ]
}

// Get type category for operator selection
function getTypeCategory(type) {
  switch (type) {
    case 3: case 8: case 12: return 'text'
    case 13: case 14: return 'number'
    case 9: case 4: return 'date'
    case 11: return 'boolean'
    default: return 'text'
  }
}

function getOperatorsForType(type) {
  return OPERATORS[getTypeCategory(type)]
}

function getDefaultOperatorForType(type) {
  return OPERATORS[getTypeCategory(type)][0].value
}

function isRangeOperator(operator) {
  return operator === 'between'
}

// displayHeaders: headers visible in the table, excluding columns hidden by filter conditions
const displayHeaders = computed(() => {
  const filterHidden = new Set(
    filterConditions.value
      .filter(c => c.hideColumn && c.headerId)
      .map(c => c.headerId)
  )
  if (filterHidden.size === 0) return headers.value
  return headers.value.filter(h => !filterHidden.has(h.id))
})

// Methods
async function loadData(page = 1) {
  if (!isAuthenticated.value && !kvalAutoAuthed.value) {
    router?.replace('/integram/login')
    return
  }

  // Track whether table-loaded was emitted so we can emit it in finally if not
  let tableLoadedEmitted = false

  try {
    if (page === 1) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    error.value = null

    // Set database context
    if (database.value) {
      integramApiClient.setDatabase(database.value)
    }

    // Fetch objects
    const queryFilters = {
      pg: page,
      LIMIT: rowsPerPage.value
    }

    // Filter by parent for subordinate tables
    if (props.parentId) {
      queryFilters.F_U = props.parentId
    }

    // Filter by specific object ID
    if (props.filterId) {
      queryFilters.F_I = props.filterId
    }

    // Добавить серверные фильтры
    // Фильтрация ВСЕГДА серверная для корректной работы
    const serverFilters = buildServerFilters()
    if (Object.keys(serverFilters).length > 0) {
      Object.assign(queryFilters, serverFilters)
      console.log('[loadData] Server filters:', serverFilters)
    }

    console.log('[loadData] Database:', integramApiClient.getDatabase(), 'TypeId:', typeId.value)
    const data = await integramApiClient.getObjectList(typeId.value, queryFilters)
    console.log('[loadData] API response reqs sample:', data.reqs ? Object.keys(data.reqs)[0] : 'none', data.reqs ? data.reqs[Object.keys(data.reqs)[0]] : null)
    typeData.value = data.type
    // Emit table info for parent components (e.g. tab management)
    if (data.type) {
      tableLoadedEmitted = true
      emit('table-loaded', data.type)
    }

    // Extract requisites metadata
    if (data.req_type && data.req_order) {
      requisitesMeta.value = data.req_order.map(reqId => ({
        id: reqId,
        alias: resolveColumnAlias(reqId, data.req_type, data.req_attrs),
        base: data.req_base?.[reqId] || 'SHORT',
        baseId: data.req_base_id?.[reqId],
        refType: data.ref_type?.[reqId] || null,
        isMulti: data.req_attrs?.[reqId]?.includes(':MULTI:') || false,
        isNested: !!data.arr_type?.[reqId]
      }))
      // Issue #6769: Try to auto-detect selector binding based on refType matching
      autoDetectSelectorBinding()
    }

    // Transform data to DataTable format
    transformData(data, page === 1)

    // Issue #6832: Emit table context for AI chat
    emitTableContextForChat()

    // Check if more data available
    hasMore.value = (data.object || []).length >= rowsPerPage.value
    currentPage.value = page

    // Load total count for badge (only on first page)
    if (page === 1 && totalCount.value === 0) {
      try {
        const countResult = await integramApiClient.getObjectCount(typeId.value)
        totalCount.value = countResult.count || 0
        console.log(`[loadData] Total records in table: ${totalCount.value}`)
      } catch (err) {
        console.warn('[loadData] Failed to get object count:', err)
      }
    }

    // Start background loading for first page
    if (page === 1) {
      console.log('[loadData] First page loaded. Settings from localStorage:', {
        autoLoadAll: settings.value.autoLoadAll,
        autoLoadDirs: settings.value.autoLoadDirs
      })

      // CRITICAL: Check for both boolean and string values
      // disableAutoLoadAll prop (from IntegramTabsEmbed) prevents background loading for lazy-loaded tabs
      const isAutoLoadAllEnabled = !props.disableAutoLoadAll &&
        (settings.value.autoLoadAll === true || settings.value.autoLoadAll === 'true')
      if (isAutoLoadAllEnabled) {
        // Запустить фоновую загрузку асинхронно (не ждать завершения)
        console.log('[loadData] autoLoadAll ВКЛЮЧЕНА - Scheduling background loading in 500ms...')
        setTimeout(() => {
          startBackgroundLoading()
        }, 500) // Небольшая задержка чтобы не перегружать сразу
      } else {
        console.log('[loadData] autoLoadAll ОТКЛЮЧЕНА - Background loading не будет запущена')
      }

      // Auto-start directory loading if enabled in settings
      console.log('[loadData] ПЕРЕД проверкой autoLoadDirs, значение:', settings.value.autoLoadDirs, 'typeof:', typeof settings.value.autoLoadDirs)
      // CRITICAL: Check for both boolean true AND string 'true'
      // if (value) will be TRUE for string "false"! Need explicit check
      const isAutoLoadDirsEnabled = settings.value.autoLoadDirs === true || settings.value.autoLoadDirs === 'true'
      if (isAutoLoadDirsEnabled) {
        console.log('[loadData] autoLoadDirs ВКЛЮЧЕНА (true) - Scheduling directory loading in 1000ms...')
        setTimeout(() => {
          console.log('[loadData] setTimeout callback: вызываем toggleAutoLoadDirs(true)')
          toggleAutoLoadDirs(true)
        }, 1000) // Немного больше задержка чтобы не перегружать одновременно с загрузкой всех строк
      } else {
        console.log('[loadData] autoLoadDirs ОТКЛЮЧЕНА (false) - Directory loading не будет запущена. Значение:', settings.value.autoLoadDirs)
      }
    }

  } catch (err) {
    error.value = err.message
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить данные: ' + err.message,
      life: 5000
    })
  } finally {
    loading.value = false
    loadingMore.value = false
    // Issue #6851: Ensure table-loaded fires even on error (page=1 only) so
    // IntegramTableEmbed skeleton is dismissed and the error message is shown.
    if (!tableLoadedEmitted && page === 1) {
      emit('table-loaded', null)
    }
  }
}

// Background loading function
async function startBackgroundLoading() {
  console.log('[BackgroundLoad] CALLED! settings.autoLoadAll =', settings.value.autoLoadAll, 'isBackgroundLoading =', isBackgroundLoading.value)

  // CRITICAL: Check for both boolean false AND string 'false'
  const isAutoLoadAllDisabled = settings.value.autoLoadAll === false || settings.value.autoLoadAll === 'false'
  if (isAutoLoadAllDisabled || isBackgroundLoading.value) {
    console.log('[BackgroundLoad] EARLY RETURN: autoLoadAll =', settings.value.autoLoadAll, 'isBackgroundLoading =', isBackgroundLoading.value)
    return
  }

  try {
    // Шаг 1: Определить размер таблицы
    console.log('[BackgroundLoad] Getting table size...')
    const sizeResult = await integramApiClient.getObjectCount(typeId.value)
    totalCount.value = sizeResult.count || 0

    console.log(`[BackgroundLoad] Table size: ${totalCount.value} records`)

    // Если таблица маленькая или уже все загружено
    if (totalCount.value <= rowsPerPage.value) {
      console.log('[BackgroundLoad] Table is small, no background loading needed')
      allDataLoaded.value = true
      allRows.value = [...rows.value]
      return
    }

    // Если таблица огромная - не загружать автоматически
    if (totalCount.value > settings.value.maxAutoLoadSize) {
      console.log(`[BackgroundLoad] Table is too large (${totalCount.value} > ${settings.value.maxAutoLoadSize}), skipping auto-load`)
      toast.add({
        severity: 'warn',
        summary: 'Большая таблица',
        detail: `Таблица содержит ${totalCount.value.toLocaleString()} записей. Автозагрузка отключена (лимит: ${settings.value.maxAutoLoadSize.toLocaleString()}). Фильтрация работает только на текущей странице (${rowsPerPage.value} записей).`,
        life: 8000
      })
      return
    }

    // Шаг 2: Начать фоновую загрузку
    isBackgroundLoading.value = true
    backgroundLoadingAborted.value = false

    // Собираем данные в обычный массив (не reactive) чтобы избежать мигания
    const tempAllRows = [...rows.value] // Начать с уже загруженных данных
    loadedCount.value = rows.value.length

    const chunkSize = settings.value.backgroundChunkSize
    const alreadyLoaded = rows.value.length // Сколько уже загружено (обычно 50)
    const remaining = totalCount.value - alreadyLoaded // Сколько осталось загрузить
    const additionalPages = Math.ceil(remaining / chunkSize) // Сколько дополнительных запросов нужно
    const startPage = 2 // Первая страница уже загружена

    console.log(`[BackgroundLoad] Already loaded: ${alreadyLoaded}, remaining: ${remaining}, additional pages: ${additionalPages}, chunk size: ${chunkSize}`)

    for (let chunk = 0; chunk < additionalPages; chunk++) {
      const page = startPage + chunk
      // Проверить отмену
      if (backgroundLoadingAborted.value) {
        console.log('[BackgroundLoad] Aborted by user')
        break
      }

      // Загрузить chunk
      const queryFilters = {
        pg: page,
        LIMIT: chunkSize
      }

      if (props.parentId) {
        queryFilters.F_U = props.parentId
      }

      if (props.filterId) {
        queryFilters.F_I = props.filterId
      }

      // Include active server filters in background loading
      const bgServerFilters = buildServerFilters()
      if (Object.keys(bgServerFilters).length > 0) {
        Object.assign(queryFilters, bgServerFilters)
      }

      const data = await integramApiClient.getObjectList(typeId.value, queryFilters)

      // Трансформировать и добавить к allRows
      const objects = data.object || []
      const reqs = data.reqs || {}

      console.log(`[BackgroundLoad] Received ${objects.length} objects from page ${page}`)

      objects.forEach(obj => {
        const rowValues = headers.value.map(header => {
          if (header.id === 'val') {
            return {
              headerId: header.id,
              value: obj.val,
              type: header.type,
              columnType: header.columnType
            }
          } else {
            const reqId = header.termId
            const reqData = reqs[obj.id]?.[reqId]
            const cell = {
              headerId: header.id,
              value: reqData || '',
              type: header.type,
              refType: header.refType,
              columnType: header.columnType,
              isMulti: header.isMulti
            }

            // CRITICAL: Preserve nested properties for subordinate table navigation
            // This matches the logic in parseRows() function
            if (header.nested || header.columnType === 'nested') {
              cell.nested = true
              cell.nestedTableId = header.nestedTableId
              cell.nestedLink = obj.id // Parent row ID for F_U parameter

              console.log('[BackgroundLoad] NESTED cell created:', {
                headerId: header.id,
                objId: obj.id,
                nestedLink: cell.nestedLink,
                nestedTableId: cell.nestedTableId
              })
            }

            return cell
          }
        })

        // ВАЖНО: Добавляем в НЕ-реактивный массив, чтобы избежать мигания
        tempAllRows.push({
          id: obj.id,
          values: rowValues
        })
      })

      loadedCount.value = tempAllRows.length
      backgroundProgress.value = Math.round(((chunk + 1) / additionalPages) * 100)

      console.log(`[BackgroundLoad] Progress: ${chunk + 1}/${additionalPages} chunks, loaded ${loadedCount.value}/${totalCount.value} records (${backgroundProgress.value}%)`)

      // Задержка между запросами
      if (chunk < additionalPages - 1) {
        await new Promise(resolve => setTimeout(resolve, settings.value.backgroundDelay))
      }
    }

    // Завершено - АТОМАРНОЕ обновление реактивного массива
    if (!backgroundLoadingAborted.value) {
      // Сначала обновляем массив данных
      allRows.value = tempAllRows
      // ТОЛЬКО потом меняем флаг (это триггерит пересчет filteredRows)
      allDataLoaded.value = true

      console.log(`[BackgroundLoad] Complete! Loaded ${allRows.value.length} records`)

      toast.add({
        severity: 'success',
        summary: 'Загрузка завершена',
        detail: `Загружено ${allRows.value.length} записей. Фильтрация работает по всем данным.`,
        life: 3000
      })
    }

  } catch (err) {
    console.error('[BackgroundLoad] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка фоновой загрузки',
      detail: err.message,
      life: 5000
    })
  } finally {
    isBackgroundLoading.value = false
  }
}

// Cancel background loading
function cancelBackgroundLoading() {
  backgroundLoadingAborted.value = true
  isBackgroundLoading.value = false

  toast.add({
    severity: 'info',
    summary: 'Загрузка отменена',
    detail: `Сохранено ${loadedCount.value} записей из ${totalCount.value}`,
    life: 3000
  })
}

// Toggle auto-load setting
function toggleAutoLoad(value) {
  console.log('[toggleAutoLoad] Изменяем автозагрузку всех данных:', { value, previous: settings.value.autoLoadAll })
  settings.value.autoLoadAll = value
  // ВАЖНО: Передаем plain object вместо Proxy для корректной сериализации в JSON
  saveSettings({ ...settings.value })

  toast.add({
    severity: 'info',
    summary: 'Настройки сохранены',
    detail: value ? 'Автозагрузка включена' : 'Автозагрузка выключена',
    life: 2000
  })
}

// Set date display style
const DATE_STYLE_NAMES = {
  classic: 'Классический',
  relative: 'Относительный',
  chip: 'Чип',
  smart: 'Умный'
}

// Issue #6651: Toggle "show row edit dialog (save popup)" setting
function toggleShowSavePopup(enabled) {
  settings.value.showSavePopup = enabled
  saveSettings({ ...settings.value })
}

function setDateStyle(style) {
  settings.value.dateStyle = style
  // ВАЖНО: Передаем plain object вместо Proxy для корректной сериализации в JSON
  saveSettings({ ...settings.value })

  toast.add({
    severity: 'info',
    summary: 'Стиль дат изменён',
    detail: DATE_STYLE_NAMES[style] || style,
    life: 2000
  })
}

/**
 * Issue #6832: Emit table context for AI chat
 * This allows the chat sidebar to know about the current table structure
 * and provide contextual assistance.
 */
function emitTableContextForChat() {
  const context = {
    typeId: typeId.value,
    database: database.value,
    tableName: typeData.value?.name || typeData.value?.val || `Таблица ${typeId.value}`,
    columns: headers.value.map(h => ({
      id: h.id,
      termId: h.termId,
      alias: h.alias || h.value || h.val,
      value: h.value || h.val,
      type: h.type,
      baseType: requisitesMeta.value.find(r => r.id == h.termId)?.base,
      isMain: h.isMain || false
    })),
    rowCount: rows.value.length,
    totalCount: totalCount.value,
    selectedRows: []
  }

  // Emit event for chat composable to pick up
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('integram-table-context-update', { detail: context }))
    window.__integramTableContext = context
    console.log('[IntegramDataTableWrapper] Table context emitted for AI chat:', context.tableName)
  }
}

// Auto-detection disabled: all filter configuration is done through filterConditions dialog.
// Previously auto-detected selector bindings caused unexpected default filters.
// Users should use the filter dialog (valueSource: 'selector') to add selector-based filters.
function autoDetectSelectorBinding() {
  // no-op: disabled to prevent unexpected default filters
}

// Преобразовать filterConditions в серверные параметры Integram API
// Формат Legacy: F_{requisiteId}={value} с символами % для LIKE операторов
// lnx=0 для линейного поиска (LIKE/contains)
function buildServerFilters() {
  const serverFilters = {}
  let hasLikeFilters = false // Фильтры требующие LIKE (%, lnx=0)

  console.log('[buildServerFilters] START')
  console.log('[buildServerFilters] filterConditions:', JSON.stringify(filterConditions.value))
  console.log('[buildServerFilters] headers count:', headers.value.length)

  filterConditions.value.forEach((condition, idx) => {
    console.log(`[buildServerFilters] Condition ${idx}:`, condition)

    // Resolve value from current Integram user (userId from session)
    if (condition.valueSource === 'currentUser') {
      const uid = integramApiClient.userId || getCurrentUserId()
      if (!uid) {
        console.warn('[buildServerFilters] SKIP: currentUser source but no userId in session')
        return
      }
      condition = { ...condition, value: String(uid), operator: 'equals' }
    }

    // Handle __current_user__ sentinel value from reference picker dropdown
    if (condition.value === REF_CURRENT_USER) {
      const uid = integramApiClient.userId || getCurrentUserId()
      if (!uid) {
        console.warn('[buildServerFilters] SKIP: __current_user__ but no userId in session')
        return
      }
      condition = { ...condition, value: String(uid), operator: 'equals' }
    }

    // Issue #6769: resolve value from Selector if valueSource = 'selector'
    if (condition.valueSource === 'selector') {
      if (!condition.selectorName) return
      const resolved = getGlobalSelector(condition.selectorName)
      if (!resolved) return // selector = "Все" — пропустить фильтр
      condition = { ...condition, value: resolved }
    }

    // Пропустить пустые условия
    if (!condition.headerId || !condition.value) {
      console.log(`[buildServerFilters] SKIP: Empty condition (headerId=${condition.headerId}, value=${condition.value})`)
      return
    }

    // Найти header чтобы получить termId (requisiteId)
    // Используем allHeaders т.к. hideColumn-колонки могут быть исключены из headers.value
    const header = allHeaders.value.find(h => h.id === condition.headerId) ||
                   headers.value.find(h => h.id === condition.headerId)
    console.log(`[buildServerFilters] Found header:`, header)

    // Use stored termId as fallback when headers haven't been loaded yet (e.g. on page reload
    // the first loadData() call happens before transformData populates headers.value).
    const effectiveTermId = header?.termId || condition.termId
    if (!effectiveTermId) {
      console.warn('[buildServerFilters] SKIP: No termId available for condition:', condition)
      return
    }

    // Для колонки 'val' используем F_{typeId} (ID таблицы)
    // Для остальных колонок - F_{requisiteId}
    const filterKey = effectiveTermId === 'val' ? `F_${typeId.value}` : `F_${effectiveTermId}`
    let filterValue = String(condition.value)

    console.log(`[buildServerFilters] Filter key: ${filterKey} for termId: ${effectiveTermId} (typeId: ${typeId.value})`)

    // Check if this is a reference column (fallback to header.columnType for conditions loaded from storage)
    const isRefColumn = (condition.columnType === 'dir' || condition.columnType === 'multi') ||
                        (header?.columnType === 'dir' || header?.columnType === 'multi')

    if (isRefColumn && condition.operator === 'equals') {
      // Reference field exact match: Integram expects @objectId format
      filterValue = filterValue.startsWith('@') ? filterValue : `@${filterValue}`
    } else {
      // Применить операторы поиска с символом % (как в Legacy)
      switch (condition.operator) {
        case 'contains':
          // Содержит: %value%
          filterValue = `%${filterValue.replace(/%/g, '')}%`
          hasLikeFilters = true
          break

        case 'startsWith':
          // Начинается с: value%
          filterValue = `${filterValue.replace(/%/g, '')}%`
          hasLikeFilters = true
          break

        case 'endsWith':
          // Заканчивается на: %value
          filterValue = `%${filterValue.replace(/%/g, '')}`
          hasLikeFilters = true
          break

        case 'equals':
          // Точное совпадение: value (без % и без lnx)
          break

        case 'notEquals':
        case 'greater':
        case 'less':
        case 'between':
          // Для числовых операторов - просто значение
          break

        default:
          break
      }
    }

    serverFilters[filterKey] = filterValue

    console.log(`[buildServerFilters] Added filter: ${filterKey}=${filterValue} (operator: ${condition.operator})`)
  })

  // Добавить lnx=0 ТОЛЬКО для LIKE операторов (contains, startsWith, endsWith)
  // Для точного совпадения (equals) lnx НЕ нужен!
  if (hasLikeFilters) {
    serverFilters.lnx = 0
    console.log('[buildServerFilters] Added lnx=0 for LIKE search')
  }

  // NOTE: selector-based and auto-selector filters are now handled exclusively through
  // filterConditions (valueSource: 'selector'). Separate prop-based and auto-detected
  // selector sections removed to prevent conflicts with filterConditions.

  console.log('[buildServerFilters] RESULT:', serverFilters)
  console.log('[buildServerFilters] END')

  return serverFilters
}

function transformData(data, reset = true) {
  console.log('[transformData] data.type:', data.type)
  console.log('[transformData] data.req_order:', data.req_order)
  console.log('[transformData] data.req_type:', data.req_type)

  // Build headers from requisites
  const newHeaders = [
    {
      id: 'val',
      value: data.type?.val || 'Значение',
      type: 3, // SHORT text
      width: 200,
      termId: 'val',
      isMain: true,
      columnType: 'regular'
    }
  ]

  // Add requisite headers
  if (data.req_order) {
    data.req_order.forEach(reqId => {
      const alias = resolveColumnAlias(reqId, data.req_type, data.req_attrs)
      const base = data.req_base?.[reqId] || 'SHORT'
      const refType = data.ref_type?.[reqId]
      const isMulti = data.req_attrs?.[reqId]?.includes(':MULTI:') || false
      const isNested = !!data.arr_type?.[reqId]

      // Determine column type
      let columnType = 'regular'
      if (isNested) {
        columnType = 'nested'
      } else if (refType) {
        columnType = isMulti ? 'multi' : 'dir'
      }

      // Issue #6792: Detect lookup columns from attrs
      // Format: :ALIAS=name:lookup:refReq=123:targetReq=456:
      const attrs = data.req_attrs?.[reqId] || ''
      const isLookup = attrs.includes(':lookup:')
      let lookupConfig = null
      if (isLookup) {
        columnType = 'lookup'
        // Parse lookup configuration from attrs
        const refReqMatch = attrs.match(/:refReq=(\d+):/)
        const targetReqMatch = attrs.match(/:targetReq=(\w+):/)
        if (refReqMatch && targetReqMatch) {
          lookupConfig = {
            refReqId: refReqMatch[1],
            targetReqId: targetReqMatch[1]
          }
          console.log('[transformData] Lookup column detected:', { reqId, lookupConfig })
        }
      }

      // Issue #6839: Parse display field (df=) and filter condition (fc=) for Select/Multiselect
      let displayField = null
      let filterCondition = null
      if (columnType === 'dir' || columnType === 'multi') {
        // Parse df= (display field requisite ID)
        const dfMatch = attrs.match(/:df=([^:]+):/)
        if (dfMatch) {
          displayField = dfMatch[1]
          console.log('[transformData] Display field detected:', { reqId, displayField })
        }
        // Parse fc= (filter condition, with escaped colons as %%COL%%)
        const fcMatch = attrs.match(/:fc=([^:]+):/)
        if (fcMatch) {
          filterCondition = fcMatch[1].replace(/%%COL%%/g, ':')
          console.log('[transformData] Filter condition detected:', { reqId, filterCondition })
        }
      }

      newHeaders.push({
        id: `req_${reqId}`,
        value: alias,
        type: getTypeIdFromBase(base),
        width: 150,
        termId: reqId,
        columnType,
        dirTableId: refType ? parseInt(refType) : null,
        isMulti,
        nested: isNested, // Boolean flag for DataTable.vue compatibility
        nestedTableId: isNested ? parseInt(reqId) : null, // For nested columns, reqId in req_order IS the subordinate table typeId
        attrs: attrs, // Store attrs for BUTTON type action URLs and lookup config
        lookupConfig, // Issue #6792: Lookup configuration
        displayField, // Issue #6839: Display field for Select/Multiselect
        filterCondition // Issue #6839: Filter condition for Select/Multiselect
      })
      // Debug: log attrs for AI columns
      if (data.req_attrs?.[reqId]?.includes('ai-agent')) {
        console.log('[transformData] AI column attrs loaded:', reqId, data.req_attrs[reqId])
      }
    })
  }

  // Initialize column visibility on first load (must happen before headers.value is filtered)
  if (reset && allHeaders.value.length === 0) {
    allHeaders.value = [...newHeaders]
    // Initialize new columns as visible, but preserve existing false values (user-hidden columns)
    const existing = selectedColumns.value
    const cols = {}
    newHeaders.forEach(h => {
      // Keep explicit false (hidden by user); default new columns to visible
      cols[h.id] = existing[h.id] === false ? false : true
    })
    selectedColumns.value = cols
  }

  // Apply visibility filter: exclude columns explicitly hidden by user
  const visibleHeaders = applyColumnOrder(injectVirtualColumns(applyStoredWidths(newHeaders)))
  headers.value = visibleHeaders.filter(h => selectedColumns.value[h.id] !== false)

  // Build rows from objects
  const objects = data.object || []
  const requisitesMap = data.reqs || {}

  // Debug: check if ref_XXX keys exist in reqs
  if (objects.length > 0) {
    const firstObjId = objects[0].id
    const firstObjReqs = requisitesMap[firstObjId]
    console.log('[parseRows] First object reqs keys:', firstObjReqs ? Object.keys(firstObjReqs) : 'none')
    console.log('[parseRows] Sample ref keys:', firstObjReqs ? Object.keys(firstObjReqs).filter(k => k.startsWith('ref_')) : 'none')
  }

  const newRows = objects.map((obj, index) => {
    const values = []

    // Add main value cell
    values.push({
      headerId: 'val',
      value: obj.val,
      type: 3
    })

    // Add requisite cells
    if (data.req_order) {
      data.req_order.forEach(reqId => {
        const reqValue = requisitesMap[obj.id]?.[reqId] || ''
        const base = data.req_base?.[reqId] || 'SHORT'
        const refType = data.ref_type?.[reqId]
        const isMulti = data.req_attrs?.[reqId]?.includes(':MULTI:') || false
        const isNested = !!data.arr_type?.[reqId]

        // Debug log for reqId 957
        if (reqId === '957' || reqId === 957) {
          console.log('[parseRows] DEBUG reqId 957:', {
            objId: obj.id,
            reqValue,
            isNested,
            arr_type_value: data.arr_type?.[reqId],
            has_arr_type: !!data.arr_type?.[reqId]
          })
        }

        // Build cell object
        const cell = {
          headerId: `req_${reqId}`,
          value: reqValue,
          type: getTypeIdFromBase(base)
        }

        // Handle reference/directory values
        // Integram returns ref_${reqId} with format "tableId:rowId" or "tableId:rowId1,rowId2" for multiselect
        const refKey = `ref_${reqId}`
        const refValue = requisitesMap[obj.id]?.[refKey]

        if (refType) {
          console.log('[parseRows] reqId:', reqId, 'refType:', refType, 'refKey:', refKey, 'refValue:', refValue, 'objReqs:', requisitesMap[obj.id])
        }

        if (refType && refValue) {
          const parts = refValue.split(':', 2)
          if (parts.length === 2) {
            const tableId = parseInt(parts[0])
            const rowIds = parts[1].split(',').map(id => parseInt(id)).filter(id => !isNaN(id))

            if (isMulti) {
              // Multiselect: store array of dirValues with display names
              // reqValue contains comma-separated display names (e.g., "Administrator, Manager")
              const displayNames = reqValue ? reqValue.split(',').map(s => s.trim()) : []
              cell.dirValues = rowIds.map((id, idx) => ({
                dirRowId: id,
                displayValue: displayNames[idx] || null
              }))
              cell.dirTableId = tableId
            } else {
              // Single directory reference
              cell.dirRowId = rowIds[0] || null
              cell.dirTableId = tableId
            }
          }
        } else if (refType && !refValue) {
          // Reference column but no value set
          if (isMulti) {
            cell.dirValues = []
          } else {
            cell.dirRowId = null
          }
        }

        // Mark nested/subordinate fields
        if (isNested) {
          cell.nested = true
          cell.nestedTableId = parseInt(reqId) // For nested columns, reqId in req_order IS the subordinate table typeId
          cell.nestedLink = obj.id // Link to parent object for opening subordinate table
          console.log('[parseRows] NESTED cell created:', {
            reqId,
            objId: obj.id,
            nestedLink: cell.nestedLink,
            nestedTableId: cell.nestedTableId,
            value: cell.value
          })
        }

        // Issue #6792: Mark lookup cells for lazy value resolution
        // Lookup values are resolved from reference column data
        const header = newHeaders.find(h => h.termId === reqId)
        if (header?.columnType === 'lookup' && header.lookupConfig) {
          cell.isLookup = true
          cell.lookupConfig = header.lookupConfig
          // Value will be resolved when rendering based on the reference column's dirRowId
          cell.lookupValue = null // Placeholder, will be resolved in DataTable
        }

        values.push(cell)
      })
    }

    return {
      id: obj.id,
      values
    }
  })

  // Inject virtual column cells into each row (can resolve synchronously if targetField is 'val'/'id')
  const vCols = props.initialVirtualColumns || virtualColumns.value
  if (vCols && vCols.length > 0) {
    newRows.forEach(row => {
      for (const vc of vCols) {
        const sourceCell = row.values.find(v => v.headerId === `req_${vc.refColumnId}`)
        let resolvedValue = ''
        if (sourceCell) {
          if (vc.targetFieldId === 'val' || vc.targetFieldId === '__val__') {
            resolvedValue = sourceCell.value || ''
          } else if (vc.targetFieldId === 'id') {
            resolvedValue = sourceCell.dirRowId ? String(sourceCell.dirRowId) : ''
          }
          // For other fields: resolved async in resolveVirtualLookupValues
        }
        row.values.push({ headerId: vc.id, value: resolvedValue, type: 3 })
      }
    })
    // Async resolve non-val fields after rows are set
    const needsAsync = vCols.some(vc => vc.targetFieldId !== 'val' && vc.targetFieldId !== '__val__' && vc.targetFieldId !== 'id')
    if (needsAsync) {
      // Pass a copy so we don't mutate after rows.value is set
      nextTick(() => resolveVirtualLookupValues([...newRows], vCols))
    }
  }

  if (reset) {
    rows.value = newRows
  } else {
    // Append for infinite scroll
    rows.value = [...rows.value, ...newRows]
  }
}

function getTypeIdFromBase(base) {
  // Map Integram base type names to type IDs
  // Full list: 2=HTML, 3=SHORT, 4=DATETIME, 5=GRANT, 6=PWD, 7=BUTTON,
  // 8=CHARS, 9=DATE, 10=FILE, 11=BOOLEAN, 12=MEMO, 13=NUMBER, 14=SIGNED,
  // 15=CALCULATABLE, 16=REPORT_COLUMN, 17=PATH
  const typeMap = {
    'HTML': 2,
    'SHORT': 3,
    'DATETIME': 4,
    'GRANT': 5,
    'PWD': 6,
    'BUTTON': 7,
    'CHARS': 8,
    'LONG': 8,      // LONG is same as CHARS
    'DATE': 9,
    'TIME': 9,      // TIME uses DATE display
    'FILE': 10,
    'BOOLEAN': 11,
    'BOOL': 11,
    'MEMO': 12,
    'NUMBER': 13,
    'SIGNED': 14,
    'CALCULATABLE': 15,
    'CALC': 15,
    'REPORT_COLUMN': 16,
    'REP_COL': 16,
    'PATH': 17
  }
  return typeMap[base] || 3
}

// Unified input component/props helpers (used for both requisites and filters)
function getInputComponentForType(type) {
  switch (type) {
    case 4: case 9: return Calendar  // DATETIME, DATE
    case 11: return Checkbox          // BOOLEAN
    case 13: case 14: return InputNumber // NUMBER, SIGNED
    case 2: case 12: return Textarea  // LONG, MEMO/HTML
    default: return InputText
  }
}

function getInputPropsForType(type, context = 'edit') {
  // context: 'edit' for form editing, 'filter' for filter dialog
  const dateFormat = context === 'filter' ? 'dd.mm.yy' : 'yy-mm-dd'
  switch (type) {
    case 4: return { dateFormat, showTime: true, showSeconds: context === 'filter' } // DATETIME
    case 9: return { dateFormat } // DATE
    case 11: return { binary: true } // BOOLEAN
    case 2: case 12: return { rows: 3 } // LONG, MEMO/HTML
    default: return {}
  }
}

// Requisite helpers (for create/edit forms)
function getRequisiteInputComponent(base) {
  return getInputComponentForType(getTypeIdFromBase(base))
}

function getRequisiteInputProps(base) {
  return getInputPropsForType(getTypeIdFromBase(base), 'edit')
}

function toggleEditMode() {
  editMode.value = editMode.value === 'double-click' ? 'single-click' : 'double-click'
  toast.add({
    severity: 'info',
    summary: editMode.value === 'single-click' ? 'Режим редактирования включен' : 'Режим редактирования выключен',
    detail: editMode.value === 'single-click' ? 'Кликните на ячейку для редактирования' : 'Двойной клик для редактирования',
    life: 2000
  })
}

// Column width persistence
function getColWidthsKey() {
  return `integram_col_widths_${database.value}_${typeId.value}`
}

async function saveColumnWidths(updatedHeaders) {
  const widths = {}
  updatedHeaders.forEach(h => {
    if (h.width) widths[h.id] = h.width
  })

  // 1. If blockId — save to DB metadata (shared across users, persistent)
  if (props.blockId) {
    try {
      await saveBlockMetadata({ columnWidths: widths })
    } catch (e) {
      console.error('[saveColumnWidths] Error saving to DB metadata:', e)
    }
  } else {
    // 2. Fallback: localStorage (standalone mode)
    try {
      localStorage.setItem(getColWidthsKey(), JSON.stringify(widths))
    } catch (e) {
      // ignore
    }
  }

  // Emit so parent blot can update data-value in the document
  emit('settings-updated', { columnWidths: widths })
}

function loadColumnWidths() {
  try {
    const stored = localStorage.getItem(getColWidthsKey())
    return stored ? JSON.parse(stored) : null
  } catch (e) {
    return null
  }
}

function applyStoredWidths(headersList) {
  // Priority: prop from DB metadata > localStorage
  const widths = props.initialColumnWidths || loadColumnWidths()
  if (!widths) return headersList
  return headersList.map(h => widths[h.id] ? { ...h, width: widths[h.id] } : h)
}

function handleTableConfigUpdate({ headers: updatedHeaders, reordered }) {
  saveColumnWidths(updatedHeaders)
  // Sync width changes back into the reactive headers so they persist during session
  updatedHeaders.forEach(uh => {
    const h = headers.value.find(x => x.id === uh.id)
    if (h) h.width = uh.width
  })
  // If columns were reordered by drag — save new order to block metadata
  if (reordered) {
    const newOrder = updatedHeaders.map(h => String(h.id))
    columnOrder.value = newOrder
    saveColumnOrder(newOrder)
  }
}

async function saveColumnOrder(order) {
  if (props.blockId) {
    try {
      await saveBlockMetadata({ columnOrder: order })
    } catch (e) {
      console.error('[saveColumnOrder]', e)
    }
  }
  // Emit regardless of blockId so parent blot can update data-value in the document
  emit('settings-updated', { columnOrder: order })
}

function applyColumnOrder(headersList) {
  const order = props.initialColumnOrder || columnOrder.value
  if (!order || order.length === 0) return headersList
  const orderMap = new Map(order.map((id, i) => [String(id), i]))
  return [...headersList].sort((a, b) => {
    const ia = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 9999
    const ib = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 9999
    return ia - ib
  })
}

/**
 * Inject virtual (Relation) columns into headers, right after their source ref column.
 * Virtual columns are stored in block metadata, not in DB.
 */
function injectVirtualColumns(headersList) {
  const vCols = props.initialVirtualColumns || virtualColumns.value
  if (!vCols || vCols.length === 0) return headersList

  const result = [...headersList]
  // Insert in reverse order so relative positions stay correct
  for (let i = vCols.length - 1; i >= 0; i--) {
    const vc = vCols[i]
    // Don't add duplicates
    if (result.some(h => h.id === vc.id)) continue

    const sourceIdx = result.findIndex(h =>
      String(h.termId) === String(vc.refColumnId) ||
      h.id === `req_${vc.refColumnId}`
    )
    const virtualHeader = {
      id: vc.id,
      value: vc.name,
      termId: vc.id,
      type: 3, // TEXT display
      width: vc.width || 150,
      isVirtual: true,
      columnType: 'virtual-lookup',
      virtualConfig: vc,
      disableEdit: true // Read-only
    }
    if (sourceIdx >= 0) {
      result.splice(sourceIdx + 1, 0, virtualHeader)
    } else {
      result.push(virtualHeader)
    }
  }
  return result
}

/**
 * Save virtual columns to block metadata.
 */
async function saveVirtualColumns(vCols) {
  if (props.blockId) {
    try {
      await saveBlockMetadata({ virtualColumns: vCols })
    } catch (e) {
      console.error('[saveVirtualColumns]', e)
    }
  }
  // Emit so parent blot can update data-value in the document
  emit('settings-updated', { virtualColumns: vCols })
}

/**
 * Unified block metadata save with local cache merge.
 * Prevents individual saves from overwriting each other's data.
 */
async function saveBlockMetadata(partialMeta) {
  if (!props.blockId) return
  // Merge into local cache
  blockMetadataCache.value = { ...blockMetadataCache.value, ...partialMeta }
  // Remove null/undefined keys
  const cleanMeta = Object.fromEntries(
    Object.entries(blockMetadataCache.value).filter(([, v]) => v !== undefined && v !== null)
  )
  await updateBlock(String(props.blockId), { metadata: cleanMeta }, 'kval')
}

/**
 * Async-resolve virtual lookup values for fields other than 'val'/'id'.
 * Fetches target table data and updates row cells.
 */
async function resolveVirtualLookupValues(rowList, vCols) {
  const pending = vCols.filter(vc =>
    vc.targetFieldId !== 'val' && vc.targetFieldId !== '__val__' && vc.targetFieldId !== 'id'
  )
  if (pending.length === 0) return

  for (const vc of pending) {
    try {
      const sourceHeaderId = `req_${vc.refColumnId}`
      const dirRowIdSet = new Set()
      for (const row of rowList) {
        const sourceCell = row.values.find(v => v.headerId === sourceHeaderId)
        if (sourceCell?.dirRowId) dirRowIdSet.add(sourceCell.dirRowId)
      }
      if (dirRowIdSet.size === 0) continue

      if (database.value) integramApiClient.setDatabase(database.value)
      const result = await integramApiClient.getObjects(vc.targetTableId, { LIMIT: 1000 })
      const objects = result.object || []
      const reqs = result.reqs || {}

      // Build lookup map: objId → fieldValue
      const lookupMap = {}
      for (const obj of objects) {
        if (!dirRowIdSet.has(obj.id) && !dirRowIdSet.has(Number(obj.id))) continue
        const objReqs = reqs[obj.id] || {}
        lookupMap[String(obj.id)] = objReqs[vc.targetFieldId]?.value ?? objReqs[vc.targetFieldId] ?? ''
      }

      // Update rows.value cells
      rows.value = rows.value.map(row => {
        const sourceCell = row.values.find(v => v.headerId === sourceHeaderId)
        if (!sourceCell?.dirRowId) return row
        const resolved = lookupMap[String(sourceCell.dirRowId)] ?? ''
        const existingCell = row.values.find(v => v.headerId === vc.id)
        if (existingCell) {
          existingCell.value = resolved
          return { ...row, values: [...row.values] }
        }
        return { ...row, values: [...row.values, { headerId: vc.id, value: resolved, type: 3 }] }
      })
    } catch (err) {
      console.error('[resolveVirtualLookupValues] Failed for virtual column', vc.id, err)
    }
  }
}

// Column visibility methods
function selectAllColumns(visible) {
  const cols = {}
  allHeaders.value.forEach(h => {
    cols[h.id] = visible
  })
  selectedColumns.value = cols
}

function applyColumnSelection() {
  // Filter headers based on selectedColumns
  headers.value = allHeaders.value.filter(h => selectedColumns.value[h.id] !== false)
  showColumnSelector.value = false
  // Сохранить выбор колонок в DB metadata
  saveBlockSettings()
  toast.add({
    severity: 'success',
    summary: 'Колонки обновлены',
    life: 2000
  })
}

// Search methods
function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = searchQuery.value
    updateSearchMatches()
  }, 300)
}

// Search Navigation (Phase 2)
function updateSearchMatches() {
  if (!searchQuery.value.trim()) {
    searchMatches.value = []
    currentMatchIndex.value = -1
    return
  }

  const matches = []
  const query = searchQuery.value.toLowerCase()

  filteredRows.value.forEach(row => {
    headers.value.forEach(header => {
      const cellValue = String(row.cells[header.id]?.value || '').toLowerCase()
      if (cellValue.includes(query)) {
        matches.push({
          rowId: row.id,
          headerId: header.id,
          value: row.cells[header.id]?.value
        })
      }
    })
  })

  searchMatches.value = matches
  currentMatchIndex.value = matches.length > 0 ? 0 : -1
}

function nextSearchMatch() {
  if (searchMatches.value.length === 0) return

  currentMatchIndex.value = (currentMatchIndex.value + 1) % searchMatches.value.length
  scrollToCurrentMatch()
}

function prevSearchMatch() {
  if (searchMatches.value.length === 0) return

  currentMatchIndex.value = currentMatchIndex.value <= 0
    ? searchMatches.value.length - 1
    : currentMatchIndex.value - 1
  scrollToCurrentMatch()
}

function scrollToCurrentMatch() {
  if (currentMatchIndex.value < 0 || !dataTableRef.value) return

  const match = searchMatches.value[currentMatchIndex.value]
  if (match) {
    // Call DataTable's scrollToCell method if available
    if (dataTableRef.value.scrollToCell) {
      dataTableRef.value.scrollToCell(match.headerId, match.rowId)
    }
  }
}

function handleSearchNavigation(event) {
  // F3 - next match, Shift+F3 - previous match
  if (event.key === 'F3') {
    event.preventDefault()
    if (event.shiftKey) {
      prevSearchMatch()
    } else {
      nextSearchMatch()
    }
  }
}

// Special sentinel value for "current user" option in reference dropdowns
const REF_CURRENT_USER = '__current_user__'

// Load reference options for a filter condition (lazy, cached by dirTableId)
async function loadRefOptions(dirTableId) {
  if (!dirTableId) return
  if (refFilterOptions.value[dirTableId]) return // Already loaded
  refFilterLoading.value = { ...refFilterLoading.value, [dirTableId]: true }
  try {
    const data = await integramApiClient.getObjectList(dirTableId, { LIMIT: 500 })
    const items = [
      // "Current user" as first option in any reference picker
      { id: REF_CURRENT_USER, label: '👤 Текущий пользователь', isSpecial: true },
      ...(data.object || []).map(obj => ({
        id: String(obj.id),
        label: obj.val || `#${obj.id}`
      }))
    ]
    refFilterOptions.value = { ...refFilterOptions.value, [dirTableId]: items }
  } catch (e) {
    console.warn('[loadRefOptions] Failed:', e)
    refFilterOptions.value = { ...refFilterOptions.value, [dirTableId]: [
      { id: REF_CURRENT_USER, label: '👤 Текущий пользователь', isSpecial: true }
    ] }
  } finally {
    refFilterLoading.value = { ...refFilterLoading.value, [dirTableId]: false }
  }
}

// Filter methods
function showFilterDialog() {
  if (filterConditions.value.length === 0) {
    addCondition()
  }
  isFilterDialogVisible.value = true
  // Enrich conditions with columnType/dirTableId from current headers (for conditions loaded from storage)
  // and pre-load reference options for equals conditions
  nextTick(() => {
    filterConditions.value.forEach(c => {
      // Enrich from allHeaders so hidden columns are also found
      if (!c.columnType || c.columnType === 'regular') {
        const header = allHeaders.value.find(h => h.id === c.headerId) ||
                       headers.value.find(h => h.id === c.headerId)
        if (header) {
          c.columnType = header.columnType || 'regular'
          c.dirTableId = header.dirTableId || null
          // For reference columns default to equals to show the object picker
          if ((c.columnType === 'dir' || c.columnType === 'multi') && c.operator !== 'equals') {
            c.operator = 'equals'
          }
        }
      }
      if ((c.columnType === 'dir' || c.columnType === 'multi') && c.dirTableId && c.operator === 'equals') {
        loadRefOptions(c.dirTableId)
      }
    })
    filterApplyButton.value?.$el?.focus()
  })
}

function addCondition() {
  const firstHeader = filterableHeaders.value[0]
  const isRef = firstHeader?.columnType === 'dir' || firstHeader?.columnType === 'multi'
  // Reference columns default to 'equals' so the object picker appears immediately
  const defaultOperator = isRef ? 'equals' : getDefaultOperatorForType(firstHeader?.type || 3)
  filterConditions.value.push({
    headerId: firstHeader?.id || null,
    type: firstHeader?.type || 3,
    columnType: firstHeader?.columnType || 'regular',
    dirTableId: firstHeader?.dirTableId || null,
    operator: defaultOperator,
    value: null,
    value2: null,
    valueSource: 'manual', // 'manual' | 'selector'
    selectorName: null,
    hideColumn: false
  })
  // Pre-load reference options if first header is a reference column
  if (isRef && firstHeader?.dirTableId) {
    loadRefOptions(firstHeader.dirTableId)
  }
}

// Issue #6769: Toggle value source between manual and selector
function toggleValueSource(index) {
  const condition = filterConditions.value[index]
  if (condition.valueSource === 'selector') {
    condition.valueSource = 'manual'
    condition.selectorName = null
  } else {
    condition.valueSource = 'selector'
    condition.value = null
    condition.value2 = null
    // Pre-fill with first known selector name if any
    const knownSelectors = Object.keys(selectorState.selectors)
    if (knownSelectors.length > 0) condition.selectorName = knownSelectors[0]
  }
}

async function removeCondition(index) {
  filterConditions.value.splice(index, 1)

  // Сохранить обновлённые фильтры
  saveFilterConditions()

  // Перезагрузить данные с обновлёнными фильтрами (сбросить background data)
  backgroundLoadingAborted.value = true
  allDataLoaded.value = false
  allRows.value = []
  currentPage.value = 1
  await loadData()

  if (filterConditions.value.length === 0) {
    isFilterDialogVisible.value = false
  }
}

function updateConditionType(index) {
  const header = filterableHeaders.value.find(h => h.id === filterConditions.value[index].headerId)
  if (header) {
    filterConditions.value[index].type = header.type
    filterConditions.value[index].columnType = header.columnType || 'regular'
    filterConditions.value[index].dirTableId = header.dirTableId || null
    filterConditions.value[index].value = null
    filterConditions.value[index].value2 = null

    const isRef = header.columnType === 'dir' || header.columnType === 'multi'
    // Reference columns default to 'equals' so the object picker (with Текущий пользователь) appears immediately
    filterConditions.value[index].operator = isRef ? 'equals' : getDefaultOperatorForType(header.type)

    // Pre-load reference options immediately on column switch
    if (isRef && header.dirTableId) {
      loadRefOptions(header.dirTableId)
    }
  }
}

// Filter helpers (delegates to unified functions)
function getFilterComponent(type) {
  return getInputComponentForType(type)
}

function getFilterProps(type) {
  return getInputPropsForType(type, 'filter')
}

async function applyFilter() {
  isFilterDialogVisible.value = false

  // Enrich each condition with termId from the current header so that buildServerFilters
  // can apply the filter even on page reload when headers haven't loaded yet.
  // Issue #6967 / filter-persistence: without termId stored, the first loadData() call
  // (before transformData populates headers.value) skips all conditions.
  filterConditions.value = filterConditions.value.map(condition => {
    if (condition.termId) return condition // already enriched
    const header = allHeaders.value.find(h => h.id === condition.headerId) ||
                   headers.value.find(h => h.id === condition.headerId)
    return header?.termId ? { ...condition, termId: header.termId } : condition
  })

  // Сохранить фильтры в localStorage
  saveFilterConditions()

  // Фильтрация ВСЕГДА серверная — перезагрузить данные с фильтрами
  // Сбросить background-загруженные данные чтобы computed filteredRows взял свежие данные
  backgroundLoadingAborted.value = true
  allDataLoaded.value = false
  allRows.value = []
  currentPage.value = 1
  await loadData()

  toast.add({
    severity: 'success',
    summary: 'Фильтр применён',
    life: 2000
  })
}

async function resetAllFilters() {
  filterConditions.value = []
  saveFilterConditions()
  addCondition()

  // Перезагрузить данные без фильтров (серверная фильтрация всегда активна)
  // Сбросить background-загруженные данные
  backgroundLoadingAborted.value = true
  allDataLoaded.value = false
  allRows.value = []
  currentPage.value = 1
  await loadData()
}

function cancelFilter() {
  isFilterDialogVisible.value = false
}

// Export methods
function printTable() {
  const tableElement = document.querySelector('.coda-style-datatable')
  if (!tableElement) {
    toast.add({ severity: 'warn', summary: 'Таблица не найдена', life: 3000 })
    return
  }

  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <html>
      <head>
        <title>Печать таблицы - ${typeData.value?.val || 'Таблица'}</title>
        <style>
          body { margin: 20px; font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .table-title { font-size: 1.5rem; margin-bottom: 15px; text-align: center; }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="table-title">${typeData.value?.val || 'Таблица'}</div>
        ${tableElement.innerHTML}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
}

async function exportToPDF() {
  const tableElement = document.querySelector('.coda-style-datatable')
  if (!tableElement) {
    toast.add({ severity: 'warn', summary: 'Таблица не найдена', life: 3000 })
    return
  }

  try {
    toast.add({ severity: 'info', summary: 'Загрузка библиотек...', life: 1500 })

    // Dynamic import of heavy libraries
    if (!html2canvasModule) {
      html2canvasModule = (await import('html2canvas')).default
    }
    if (!jsPDFModule) {
      jsPDFModule = (await import('jspdf')).default
    }

    toast.add({ severity: 'info', summary: 'Создание PDF...', life: 2000 })

    const canvas = await html2canvasModule(tableElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const pdf = new jsPDFModule('landscape', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 280
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const title = typeData.value?.val || 'Таблица'
    pdf.setFontSize(16)
    pdf.text(title, 10, 15)
    pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight)
    pdf.save(`${title.replace(/\s+/g, '_')}.pdf`)

    toast.add({ severity: 'success', summary: 'PDF создан', life: 3000 })
  } catch (error) {
    console.error('Ошибка при создании PDF:', error)
    toast.add({ severity: 'error', summary: 'Ошибка экспорта', detail: 'Не удалось создать PDF файл', life: 5000 })
  }
}

async function exportToExcel() {
  if (!filteredRows.value.length) {
    toast.add({ severity: 'warn', summary: 'Нет данных', detail: 'Нет данных для экспорта', life: 3000 })
    return
  }

  try {
    // Dynamic import of XLSX library
    if (!XLSXModule) {
      toast.add({ severity: 'info', summary: 'Загрузка библиотеки...', life: 1500 })
      XLSXModule = await import('xlsx')
    }

    const wsData = []

    // Header row
    const headerRow = headers.value.map(header => header.value)
    wsData.push(headerRow)

    // Data rows
    filteredRows.value.forEach(row => {
      const rowData = []
      headers.value.forEach(header => {
        const cell = row.values.find(c => c.headerId === header.id)
        rowData.push(cell ? cell.value || '' : '')
      })
      wsData.push(rowData)
    })

    const ws = XLSXModule.utils.aoa_to_sheet(wsData)
    const wb = XLSXModule.utils.book_new()
    const sheetName = (typeData.value?.val || 'Таблица').substring(0, 31)
    XLSXModule.utils.book_append_sheet(wb, ws, sheetName)

    const fileName = `${(typeData.value?.val || 'Таблица').replace(/\s+/g, '_')}.xlsx`
    XLSXModule.writeFile(wb, fileName)

    toast.add({ severity: 'success', summary: 'Excel создан', life: 3000 })
  } catch (error) {
    console.error('Ошибка при экспорте в Excel:', error)
    toast.add({ severity: 'error', summary: 'Ошибка экспорта', detail: 'Не удалось создать Excel файл', life: 5000 })
  }
}

// Event handlers
async function handleCellUpdate(event) {
  const { rowId, headerId, value, dirRowId } = event

  try {
    if (headerId === 'val') {
      // Update main value
      await integramApiClient.saveObject(rowId, typeId.value, value, {})
    } else {
      // Update requisite - extract reqId from header ID
      const reqId = headerId.replace('req_', '')
      const requisites = {}

      // For directory columns, use dirRowId (object ID), not display value
      const header = headers.value.find(h => h.id === headerId)
      if (header?.dirTableId && dirRowId !== undefined && dirRowId !== null) {
        requisites[reqId] = String(dirRowId)
      } else {
        requisites[reqId] = value
      }

      await integramApiClient.setObjectRequisites(rowId, requisites)
    }

    // Update local data — replace row object to guarantee Vue 3 reactivity
    // (nested mutation of cell.value is not reliably tracked by computed deps)
    const rowIndex = rows.value.findIndex(r => r.id === rowId)
    if (rowIndex !== -1) {
      rows.value[rowIndex] = {
        ...rows.value[rowIndex],
        values: rows.value[rowIndex].values.map(v => {
          if (v.headerId !== headerId) return v
          return {
            ...v,
            value,
            ...(dirRowId !== undefined ? { dirRowId } : {})
          }
        })
      }
    }

    // Notify other components on this page about the update
    const reqId = headerId === 'val' ? null : headerId.replace('req_', '')
    // For reference fields emit objectId (dirRowId) so kanban can group correctly;
    // keep displayLabels so DataTableWrapper can update cell.value properly
    const emitVal = (reqId && dirRowId !== undefined && dirRowId !== null) ? String(dirRowId) : value
    const cellRequisites = reqId ? { [reqId]: emitVal } : {}
    const emitDisplayLabels = (reqId && dirRowId !== undefined && dirRowId !== null)
      ? { [reqId]: value }
      : undefined
    integramEventBus.emit('object:updated', {
      database: database.value,
      typeId: String(typeId.value),
      objectId: rowId,
      requisites: cellRequisites,
      displayLabels: emitDisplayLabels
    })
    // Issue #6742: Broadcast to other tabs/users via WebSocket
    integramSync.publish('object:updated', { database: database.value, typeId: String(typeId.value), objectId: rowId, requisites: cellRequisites })

    // Issue #6777: Notify other users in BlockDocumentEditor about table data change
    if (wsSendTableUpdate && typeId.value && database.value) {
      wsSendTableUpdate(String(typeId.value), database.value)
    }

    // Issue #6618: Removed save success toast notification
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось сохранить: ' + err.message,
      life: 5000
    })
  }
}

async function handleRowUpdate(event) {
  const { id, headers: updatedHeaders } = event

  try {
    // Build requisites object
    const requisites = {}
    let mainValue = null

    updatedHeaders.forEach(updatedHeader => {
      if (updatedHeader.headerId === 'val') {
        mainValue = updatedHeader.value
      } else {
        const reqId = updatedHeader.headerId.replace('req_', '')
        const columnHeader = headers.value.find(h => h.id === updatedHeader.headerId)

        // For directory columns (single select), use dirRowId
        if (columnHeader?.dirTableId && !columnHeader.isMulti) {
          requisites[reqId] = updatedHeader.dirRowId ? String(updatedHeader.dirRowId) : ''
        }
        // For multiselect columns, use dirValues joined by comma
        else if (columnHeader?.dirTableId && columnHeader.isMulti && updatedHeader.dirValues) {
          requisites[reqId] = updatedHeader.dirValues.map(v => v.dirRowId).join(',')
        }
        // For regular columns, use value
        else {
          requisites[reqId] = updatedHeader.value
        }
      }
    })

    // Save object with all values
    if (mainValue !== null) {
      await integramApiClient.saveObject(id, typeId.value, mainValue, requisites)
    } else {
      await integramApiClient.setObjectRequisites(id, requisites)
    }

    // Update local data — replace row object to guarantee Vue 3 reactivity
    const rowIndex = rows.value.findIndex(r => r.id === id)
    if (rowIndex !== -1) {
      rows.value[rowIndex] = {
        ...rows.value[rowIndex],
        values: rows.value[rowIndex].values.map(v => {
          const update = updatedHeaders.find(h => h.headerId === v.headerId)
          if (!update) return v
          return {
            ...v,
            value: update.value,
            ...(update.dirRowId !== undefined ? { dirRowId: update.dirRowId } : {}),
            ...(update.dirValues !== undefined ? { dirValues: update.dirValues } : {})
          }
        })
      }
    }

    // Notify other components on this page about the update
    integramEventBus.emit('object:updated', {
      database: database.value,
      typeId: String(typeId.value),
      objectId: id,
      requisites
    })
    // Issue #6742: Broadcast to other tabs/users via WebSocket
    integramSync.publish('object:updated', { database: database.value, typeId: String(typeId.value), objectId: id, requisites })

    // Issue #6777: Notify other users in BlockDocumentEditor about table data change
    if (wsSendTableUpdate && typeId.value && database.value) {
      wsSendTableUpdate(String(typeId.value), database.value)
    }

    // Issue #6618: Removed save success toast notification
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось обновить строку: ' + err.message,
      life: 5000
    })
  }
}

async function handleCellMultiUpdate(event) {
  const { rowId, headerId, dirTableId, dirValues } = event

  try {
    const reqId = headerId.replace('req_', '')

    // Get current multiselect items from cell
    const rowIndex = rows.value.findIndex(r => r.id === rowId)
    const cell = rowIndex !== -1 ? rows.value[rowIndex].values.find(v => v.headerId === headerId) : null
    const oldValues = cell?.dirValues || []

    // Find items to add and remove
    const oldIds = new Set(oldValues.map(v => v.dirRowId))
    const newIds = new Set(dirValues.map(v => v.dirRowId))

    const toAdd = dirValues.filter(v => !oldIds.has(v.dirRowId))
    const toRemove = oldValues.filter(v => !newIds.has(v.dirRowId))

    // Add new items using _m_set
    for (const item of toAdd) {
      await integramApiClient.addMultiselectItem(rowId, reqId, item.dirRowId)
    }

    // Remove items using _m_del
    // msId (relationship record ID) is rarely stored upfront, so fetch from edit_obj when needed
    if (toRemove.length > 0) {
      const needFetchMsId = toRemove.some(item => !item.msId)
      let msIdByDirRowId = {}

      if (needFetchMsId) {
        try {
          // edit_obj returns reqs[reqId].multiselect.{id[], val[]}
          // where id[i] = relationship record ID (msId), val[i] = dirRowId
          const editData = await integramApiClient.getObjectEditData(rowId)
          const ms = editData?.reqs?.[reqId]?.multiselect
          if (ms?.id && ms?.val) {
            ms.val.forEach((dirRowId, idx) => {
              msIdByDirRowId[String(dirRowId)] = ms.id[idx]
            })
          }
        } catch (fetchErr) {
          console.warn('[handleCellMultiUpdate] Failed to fetch msIds from edit_obj:', fetchErr)
        }
      }

      for (const item of toRemove) {
        const msId = item.msId ?? msIdByDirRowId[String(item.dirRowId)]
        if (msId) {
          await integramApiClient.removeMultiselectItem(msId)
        } else {
          console.warn('[handleCellMultiUpdate] No msId found for dirRowId:', item.dirRowId)
        }
      }
    }

    // Update local data with new values — replace row object for Vue 3 reactivity
    if (rowIndex !== -1) {
      rows.value[rowIndex] = {
        ...rows.value[rowIndex],
        values: rows.value[rowIndex].values.map(v => {
          if (v.headerId !== headerId) return v
          return { ...v, dirValues }
        })
      }
    }

    // Issue #6618: Removed save success toast notification
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось обновить: ' + err.message,
      life: 5000
    })
  }
}

async function handleLoadDirectoryList(event) {
  const { dirTableId, callback, withReqs = false } = event
  console.log('[handleLoadDirectoryList] Loading directory:', dirTableId, '| withReqs:', withReqs)

  // NOTE: We ALWAYS load when explicitly requested via emit, regardless of autoLoadDirs setting
  // The autoLoadDirs check happens at the point where loading is initiated, NOT when handling the load request.
  // This allows dropdown/multiselect cells to work even when autoLoadDirs is disabled.

  try {
    const data = await integramApiClient.getObjectList(dirTableId, { LIMIT: 500 })
    console.log('[handleLoadDirectoryList] Got data for', dirTableId, ':', data?.object?.length || 0, 'items')
    const list = (data.object || []).map(obj => ({
      // Convert id to number for consistent matching with dirRowId (which is parsed as parseInt)
      id: parseInt(obj.id) || obj.id,
      value: obj.val,
      reqs: {}
    }))

    if (withReqs && list.length > 0) {
      // Load full object data (with requisites) in parallel batches of 10.
      // Needed for filterConditions that reference specific field IDs like [numericId].
      console.log('[handleLoadDirectoryList] Loading reqs for', list.length, 'items in batches')
      const BATCH = 10
      for (let i = 0; i < list.length; i += BATCH) {
        const batchItems = list.slice(i, i + BATCH)
        const batchResults = await Promise.allSettled(
          batchItems.map(item => integramApiClient.getObjectEditData(item.id))
        )
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value?.reqs) {
            list[i + idx].reqs = result.value.reqs
          }
        })
      }
    }

    console.log('[handleLoadDirectoryList] Sample item:', list[0])
    callback(list)
  } catch (err) {
    console.error('[handleLoadDirectoryList] Error loading directory', dirTableId, ':', err)
    callback([])
  }
}

async function handleLoadDirRow(event) {
  const { dirTableId, dirRowId, callback } = event
  // NOTE: dirTableId is the referenced type, dirRowId is the specific object ID

  // NOTE: We ALWAYS load when explicitly requested via emit, regardless of autoLoadDirs setting
  // The autoLoadDirs check happens at the point where loading is initiated (e.g., in preloadRowDirData,
  // showDirInfo, loadAllDirDataInBackground), NOT when handling the load request.
  // This allows hover/preview to work even when autoLoadDirs is disabled.

  try {
    // Load object data AND type metadata in parallel
    const [data, typeListData] = await Promise.all([
      integramApiClient.getObjectEditData(dirRowId),
      dirTableId ? integramApiClient.getObjectList(dirTableId, { LIMIT: 1 }) : null
    ])

    if (data && data.obj) {
      // Build headers array from req_type (column aliases)
      const headers = []
      const values = []
      const subordinates = [] // Array of subordinate tables with their objects

      // Add main value header - use type name or "Значение"
      const typeName = data.obj.type_name || data.type?.val || typeListData?.type?.val || 'Значение'
      headers.push({
        id: 'val',
        value: typeName
      })
      values.push({
        headerId: 'val',
        value: data.obj.val || ''
      })

      // Helper to extract value from reqData
      const extractValue = (reqData) => {
        if (!reqData) return ''
        if (typeof reqData === 'object') {
          return reqData.value ?? reqData.val ?? ''
        }
        return reqData
      }

      // Collect subordinate table IDs from type metadata (arr_type)
      const subordinateTypeIds = []
      const arrType = typeListData?.arr_type || data.arr_type
      const reqType = typeListData?.req_type || data.req_type
      if (arrType) {
        Object.keys(arrType).forEach(reqId => {
          if (arrType[reqId]) {
            subordinateTypeIds.push({
              typeId: parseInt(reqId),
              alias: reqType?.[reqId] || `Таблица ${reqId}`
            })
          }
        })
      }

      // Build unified items array in order from req_order
      const items = []
      const reqOrder = typeListData?.req_order || data.req_order || []

      // First pass: collect items in order (values and subordinate placeholders)
      for (const reqId of reqOrder) {
        if (arrType?.[reqId]) {
          // This is a subordinate table - add placeholder
          items.push({
            itemType: 'subordinate',
            typeId: parseInt(reqId),
            alias: reqType?.[reqId] || '',
            objects: [],
            count: 0
          })
        } else {
          // Regular value
          const reqValue = extractValue(data.reqs?.[reqId])
          if (reqValue || reqValue === 0) {
            items.push({
              itemType: 'value',
              headerId: reqId,
              alias: reqType?.[reqId] || '',
              value: reqValue,
              type: data.req_base_id?.[reqId] || null
            })
          }
        }
      }

      // Second pass: load subordinate data in parallel
      const subordinateItems = items.filter(i => i.itemType === 'subordinate')
      if (subordinateItems.length > 0) {
        const subPromises = subordinateItems.map(async (subItem) => {
          try {
            const subData = await integramApiClient.getObjectList(subItem.typeId, {
              F_U: dirRowId,
              LIMIT: 5
            })
            subItem.objects = (subData?.object || []).slice(0, 5).map(obj => ({
              id: obj.id,
              val: obj.val
            }))
            subItem.count = subData?.count || subItem.objects.length
          } catch (e) {
            console.warn(`Failed to load subordinate ${subItem.typeId}:`, e)
          }
        })
        await Promise.all(subPromises)
      }

      callback({
        headers,
        rows: [{
          id: data.obj.id,
          val: data.obj.val,
          items  // unified array in correct order
        }]
      })
    } else {
      callback(null)
    }
  } catch (err) {
    console.error('Error loading dir row:', err)
    callback(null)
  }
}

/**
 * Load nested table preview data for hover popover
 * Shows first 5 records from the subordinate table
 */
async function handleLoadNestedPreview(event) {
  const { nestedTableId, parentRowId, tableName, callback } = event

  if (!nestedTableId || !parentRowId) {
    callback({ items: [], totalCount: 0 })
    return
  }

  try {
    // Load first 5 records filtered by parent
    const data = await integramApiClient.getObjectList(nestedTableId, {
      F_U: parentRowId,
      LIMIT: 6 // Load 6 to know if there are more
    })

    const items = (data?.object || []).slice(0, 5).map(obj => ({
      id: obj.id,
      val: obj.val,
      value: obj.val
    }))

    const totalCount = data?.count || items.length

    callback({
      items,
      totalCount,
      tableName
    })
  } catch (err) {
    console.error('[handleLoadNestedPreview] Error:', err)
    callback({ items: [], totalCount: 0 })
  }
}

function handleLoadMore() {
  if (!loadingMore.value && hasMore.value) {
    loadData(currentPage.value + 1)
  }
}

function handleOpenNested(event) {
  console.log('[handleOpenNested] RECEIVED event:', event)
  const { tableId, parentRowId, tableName } = event
  // Extract the requisite ID from header ID (format: "req_123")
  const reqId = tableId?.replace?.('req_', '') || tableId
  console.log('[handleOpenNested] Extracted reqId:', reqId, 'parentRowId:', parentRowId)

  if (parentRowId && reqId) {
    // Issue #6614: Open full dialog directly instead of compact card
    // Previously: opened small card first, then user had to click "Open fully" to see large dialog
    // Now: directly open the large dialog for better UX
    nestedDialog.value = {
      visible: true,
      tableId: reqId,
      parentRowId: parentRowId,
      tableName: tableName || 'Подчинённая таблица',
      loading: false,
    }
  } else {
    console.log('[handleOpenNested] Condition FALSE - missing parentRowId or reqId')
  }
}

async function loadNestedCardRecords() {
  if (!nestedCard.value.tableId || !nestedCard.value.parentRowId) return
  nestedCard.value.loading = true
  try {
    const data = await integramApiClient.getObjectList(nestedCard.value.tableId, {
      F_U: nestedCard.value.parentRowId,
      LIMIT: 200,
    })
    nestedCard.value.records = (data.objs || []).map(o => ({ id: o.id, val: o.val || '' }))
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось загрузить записи: ' + err.message, life: 4000 })
  } finally {
    nestedCard.value.loading = false
  }
}

function startEditNestedCard(rec) {
  nestedCard.value.editingId = rec.id
  nestedCard.value.editingVal = rec.val
}

async function saveNestedCardRecord(id) {
  const val = nestedCard.value.editingVal.trim()
  try {
    await integramApiClient.saveObject(id, nestedCard.value.tableId, val, {})
    const rec = nestedCard.value.records.find(r => r.id === id)
    if (rec) rec.val = val
    nestedCard.value.editingId = null
    nestedCard.value.editingVal = ''
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось сохранить: ' + err.message, life: 4000 })
  }
}

async function deleteNestedCardRecord(id) {
  try {
    await integramApiClient.deleteObject(id)
    nestedCard.value.records = nestedCard.value.records.filter(r => r.id !== id)
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось удалить: ' + err.message, life: 4000 })
  }
}

async function addNestedCardRecord() {
  const val = nestedCard.value.newRecordName.trim()
  if (!val) return
  nestedCard.value.adding = true
  try {
    const result = await integramApiClient.createObject(
      nestedCard.value.tableId,
      val,
      {},
      nestedCard.value.parentRowId
    )
    if (result?.id) {
      nestedCard.value.records.push({ id: result.id, val })
    }
    nestedCard.value.newRecordName = ''
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось создать запись: ' + err.message, life: 4000 })
  } finally {
    nestedCard.value.adding = false
  }
}

function openNestedCardFull() {
  const { tableId, parentRowId, tableName } = nestedCard.value
  nestedCard.value.visible = false
  nestedDialog.value = {
    visible: true,
    tableId,
    parentRowId,
    tableName: tableName || 'Подчинённая таблица',
    loading: false,
  }
}

function handleOpenDirectory(event) {
  const { typeId, typeName, dirRowId } = event
  if (typeId) {
    directoryDialog.value = {
      visible: true,
      typeId: typeId,
      typeName: typeName || 'Справочник',
      dirRowId: dirRowId || null
    }
  }
}

async function createNestedRecord() {
  // Create a new record in the nested table with parent reference
  if (!nestedDialog.value.tableId || !nestedDialog.value.parentRowId) return

  try {
    nestedDialog.value.loading = true

    // Create object with parent ID
    const result = await integramApiClient.createObject(
      nestedDialog.value.tableId,
      'Новая запись',
      {},
      nestedDialog.value.parentRowId
    )

    toast.add({
      severity: 'success',
      summary: 'Создано',
      detail: 'Запись добавлена',
      life: 2000
    })

    // Force re-render of nested table by changing key
    const currentTableId = nestedDialog.value.tableId
    const currentParentId = nestedDialog.value.parentRowId
    nestedDialog.value.tableId = null
    await nextTick()
    nestedDialog.value.tableId = currentTableId
    nestedDialog.value.parentRowId = currentParentId

  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось создать запись: ' + err.message,
      life: 5000
    })
  } finally {
    nestedDialog.value.loading = false
  }
}

/**
 * Open AI Fill Table dialog (Issue #6622)
 * Loads the table structure and opens the AI fill dialog
 */
async function openAIFillDialog() {
  if (!nestedDialog.value.tableId) return

  try {
    // Load table metadata to get column structure
    const metadata = await integramApiClient.getTypeMetadata(nestedDialog.value.tableId)

    // Build table structure array from requisites
    const tableStructure = []
    if (metadata?.req_order) {
      const reqOrder = Array.isArray(metadata.req_order)
        ? metadata.req_order
        : String(metadata.req_order).split(',').filter(Boolean)

      for (const reqId of reqOrder) {
        const req = metadata.reqs?.[reqId]
        if (req) {
          tableStructure.push({
            id: reqId,
            alias: req.alias || req.val || `Поле ${reqId}`,
            val: req.val,
            type: req.type || 3, // Default to SHORT text
            termId: reqId
          })
        }
      }
    }

    // Set up dialog state
    aiFillDialog.value = {
      visible: true,
      tableId: nestedDialog.value.tableId,
      tableName: nestedDialog.value.tableName || metadata?.val || 'Подчинённая таблица',
      parentRowId: nestedDialog.value.parentRowId,
      tableStructure: tableStructure
    }

    console.log('[openAIFillDialog] Dialog opened with structure:', tableStructure)

  } catch (err) {
    console.error('[openAIFillDialog] Error loading table structure:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить структуру таблицы: ' + err.message,
      life: 5000
    })
  }
}

/**
 * Handle AI fill completion (Issue #6622)
 * Refreshes the nested table to show new records
 */
async function handleAIFillComplete(result) {
  console.log('[handleAIFillComplete] Result:', result)

  const created = result.createdCount ?? result.toolCallsCount ?? 0
  const total = result.totalCount ?? created
  toast.add({
    severity: 'success',
    summary: 'AI-заполнение завершено',
    detail: `Создано ${created}${total && total !== created ? ' из ' + total : ''} записей`,
    life: 5000
  })

  // Close the AI fill dialog
  aiFillDialog.value.visible = false

  // Force re-render of nested table by changing key
  const currentTableId = nestedDialog.value.tableId
  const currentParentId = nestedDialog.value.parentRowId
  nestedDialog.value.tableId = null
  await nextTick()
  nestedDialog.value.tableId = currentTableId
  nestedDialog.value.parentRowId = currentParentId
}

/**
 * Handle AI fill error (Issue #6622)
 */
function handleAIFillError(err) {
  console.error('[handleAIFillError] Error:', err)
  toast.add({
    severity: 'error',
    summary: 'Ошибка AI-заполнения',
    detail: err.message || 'Произошла ошибка при заполнении таблицы',
    life: 5000
  })
}

// Issue #7191: Open version history side panel for the selected row
function handleRowVersionHistory(rowId) {
  versionHistoryPanel.value = { visible: true, objId: rowId }
}

// Issue #7191: Handle rollback-complete from VersionHistoryPanel
function handleVersionRollbackComplete(result) {
  toast.add({
    severity: 'success',
    summary: 'Откат выполнен',
    detail: `Создана версия v${result.version} (obj #${result.newObjId})`,
    life: 5000,
  })
  loadData(1)
}

// Issue #6673: Handle import completion
function handleImportComplete(result) {
  console.log('[handleImportComplete] Imported:', result)
  toast.add({
    severity: 'success',
    summary: 'Импорт завершён',
    detail: `Загружено ${result?.count || 0} записей`,
    life: 4000
  })
  loadData()
}

async function handleAddRow() {
  // Issue #6618: Auto-create new row instead of showing dialog
  try {
    creating.value = true
    isAddingRow.value = true

    // Ensure correct database context before API call
    if (database.value) integramApiClient.setDatabase(database.value)

    // Get parent ID from props (embedded/subordinate mode) or route (standalone mode)
    // Issue #6651: When embedded as subordinate table, parentId comes from props, not route
    const parentId = props.parentId || route.query.F_U || null

    // Create a new row with empty value (user will edit inline)
    const result = await integramApiClient.createObject(
      typeId.value,
      '', // Empty value - user will edit it inline in the table
      {},  // No requisites initially
      parentId
    )

    // Auto-set user fields (REF → type 18) with current user ID
    // and pre-fill selector value so new row is visible with active filters
    if (result?.id) {
      const autoReqs = {}

      // Detect user-reference columns (dirTableId === 18 = Users table in my-database)
      const currentUserId = integramApiClient.userId || integramApiClient.databases?.[integramApiClient.currentDatabase]?.userId
      if (currentUserId) {
        ;(headers.value || []).forEach(h => {
          if (h.dirTableId === 18 && h.termId) {
            autoReqs[h.termId] = String(currentUserId)
          }
        })
      }

      // Issue #6856: Pre-fill auto-detected selector value so new row immediately
      // appears in the active filter. Without this, creating a row while a selector
      // filter is active causes the row to be invisible after reload (filtered out).
      if (autoSelectorName.value && autoSelectorColumnId.value) {
        const selectorValue = getGlobalSelector(autoSelectorName.value)
        if (selectorValue) autoReqs[autoSelectorColumnId.value] = selectorValue
      }

      if (Object.keys(autoReqs).length > 0) {
        try {
          await integramApiClient.setObjectRequisites(result.id, autoReqs)
        } catch (e) {
          console.warn('[handleAddRow] Could not pre-fill auto requisites:', e.message)
        }
      }
    }

    // Optimistic update: insert the new row immediately without full reload
    if (result?.id) {
      const newRow = {
        id: result.id,
        values: [
          { headerId: 'val', value: '', type: 3 },
          ...(headers.value || [])
            .filter(h => h.id !== 'val')
            .map(h => ({ headerId: h.id, value: '', type: h.type || 3 }))
        ]
      }
      rows.value = [...rows.value, newRow]
      if (allRows.value.length > 0) allRows.value = [...allRows.value, newRow]
      totalCount.value = (totalCount.value || 0) + 1

      // Notify other tables on the page that show the same typeId (skip own instance)
      integramEventBus.emit('object:created', {
        database: database.value,
        typeId: String(typeId.value),
        objectId: result.id,
        _sourceId: _componentId
      })
    }

  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось создать запись: ' + err.message,
      life: 5000
    })
  } finally {
    creating.value = false
    isAddingRow.value = false
  }
}

async function handleAddColumn() {
  newColumnAlias.value = ''
  newColumnType.value = 3 // Default: SHORT text
  isReferenceColumn.value = false
  referenceTableId.value = null
  referenceTableOptions.value = []
  // Issue #6792, #6873: Reset lookup column state
  isLookupColumn.value = false
  lookupSourceReqId.value = null
  lookupTargetReqId.value = null
  lookupSelectedTargetIds.value = [] // Issue #6873: Multi-select support
  lookupSourceOptions.value = []
  lookupTargetOptions.value = []
  showAddColumnDialog.value = true

  // Preload table list for reference dropdown
  loadingReferenceTables.value = true
  try {
    if (database.value) integramApiClient.setDatabase(database.value)
    const dict = await integramApiClient.getDictionary()
    const types = dict.type || dict.types || []
    // Filter out base/system types (id < 100) and current table itself
    referenceTableOptions.value = types
      .filter(t => {
        const id = Number(t.id || t.ID)
        return id > 100 && id !== Number(typeId.value)
      })
      .map(t => ({ label: t.val || t.name || String(t.id || t.ID), value: Number(t.id || t.ID) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

    // Issue #6792: Load available reference columns for lookup
    loadLookupSourceOptions()
  } catch (e) {
    console.warn('[handleAddColumn] Failed to load tables for reference:', e.message)
  } finally {
    loadingReferenceTables.value = false
  }
}

/**
 * Opens add-column dialog pre-configured for Relation (lookup) type,
 * with the source reference column pre-selected.
 * Triggered from TieredMenu "🔗 Добавить Relation колонку"
 */
async function handleOpenAddLookupColumn(sourceColumnId) {
  await handleAddColumn()
  newColumnType.value = 'lookup'
  // Pre-select the source reference column
  if (sourceColumnId) {
    lookupSourceReqId.value = String(sourceColumnId)
    await handleLookupSourceChange()
  }
}

/**
 * Issue #6792: Load available reference columns for lookup
 * Populates lookupSourceOptions with columns that have ref_type (reference columns)
 */
function loadLookupSourceOptions() {
  if (!requisitesMeta.value || requisitesMeta.value.length === 0) {
    lookupSourceOptions.value = []
    return
  }

  // Filter columns that are references (have ref_type)
  lookupSourceOptions.value = requisitesMeta.value
    .filter(req => req.ref_type || req.refType)
    .map(req => ({
      label: req.alias || req.name || `Column ${req.id}`,
      value: req.id,
      targetTableId: req.ref_type || req.refType
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  console.log('[loadLookupSourceOptions] Found reference columns:', lookupSourceOptions.value)
}

/**
 * Issue #6792, #6873: Handle column type change
 * Resets lookup state when switching away from lookup type
 */
function handleColumnTypeChange() {
  if (newColumnType.value !== 'lookup') {
    lookupSourceReqId.value = null
    lookupTargetReqId.value = null
    lookupSelectedTargetIds.value = [] // Issue #6873: Reset multi-select
    lookupTargetOptions.value = []
  }
}

/**
 * Issue #6873: Toggle selection of a target field in multi-select mode
 */
function toggleLookupTargetSelection(fieldId) {
  const index = lookupSelectedTargetIds.value.indexOf(fieldId)
  if (index === -1) {
    lookupSelectedTargetIds.value.push(fieldId)
  } else {
    lookupSelectedTargetIds.value.splice(index, 1)
  }
}

/**
 * Issue #6792, #6873: Handle lookup source change
 * When user selects a reference column, load available fields from the target table
 */
async function handleLookupSourceChange() {
  lookupTargetReqId.value = null
  lookupSelectedTargetIds.value = [] // Issue #6873: Reset multi-select
  lookupTargetOptions.value = []

  const selectedSource = lookupSourceOptions.value.find(opt => opt.value === lookupSourceReqId.value)
  if (!selectedSource || !selectedSource.targetTableId) {
    return
  }

  loadingLookupTargetFields.value = true
  try {
    if (database.value) integramApiClient.setDatabase(database.value)
    const targetMeta = await integramApiClient.getTypeMetadata(selectedSource.targetTableId)

    if (targetMeta && targetMeta.reqs) {
      // Get all requisites from target table
      lookupTargetOptions.value = targetMeta.reqs
        .filter(req => {
          // Exclude nested tables and complex types
          const base = req.base || req.baseType
          return base !== 'TABLE' && !req.arr_type && !req.arrType
        })
        .map(req => ({
          label: req.alias || req.name || `Field ${req.id}`,
          value: req.id,
          base: req.base || req.baseType
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

      // Add ID field at the beginning
      lookupTargetOptions.value.unshift({ label: 'ID', value: 'id', base: 'NUMBER' })

      console.log('[handleLookupSourceChange] Loaded target fields:', lookupTargetOptions.value.length)
    }
  } catch (err) {
    console.error('[handleLookupSourceChange] Failed to load target table metadata:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить поля целевой таблицы',
      life: 3000
    })
  } finally {
    loadingLookupTargetFields.value = false
  }
}

/**
 * Issue #6609: Get user credentials for DDL operations.
 * Returns the user's token and xsrf from integramApiClient for the active database.
 * @param {string} db - Target database
 * @returns {Object|null} User credentials { token, xsrf } or null if not available
 */
function getUserCredentialsForDDL(db) {
  // Try to get database-specific credentials first
  const dbSession = integramApiClient.databases?.[db]
  if (dbSession?.token && dbSession?.xsrfToken) {
    return { token: dbSession.token, xsrf: dbSession.xsrfToken }
  }
  // Fall back to legacy single-session credentials
  if (integramApiClient.token && integramApiClient.xsrfToken) {
    return { token: integramApiClient.token, xsrf: integramApiClient.xsrfToken }
  }
  return null
}

async function createColumn() {
  if (!newColumnAlias.value.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Внимание',
      detail: 'Введите название колонки',
      life: 3000
    })
    return
  }

  try {
    isAddingColumn.value = true

    // Issue #6583: Ensure correct database is set for DDL operations
    // Without this, database may still be 'my' from login instead of the target DB (e.g. 'kval')
    if (database.value) {
      integramApiClient.setDatabase(database.value)
    }

    // Ensure we have the correct XSRF token for this database
    await integramApiClient.ensureXsrf()

    // Check if it's an AI Agent or Action Button column (both use BUTTON base type 7)
    const isAIAgent = newColumnType.value === 'ai-agent'
    const isActionButton = newColumnType.value === 'action-button'
    const isVote = newColumnType.value === 'vote'
    const isReference = isReferenceColumn.value && referenceTableId.value
    // Lookup (Relation) columns are virtual — no DB write, stored in block metadata only
    // Issue #6873: Support multi-select - check if we have selected target fields
    const isLookup = newColumnType.value === 'lookup' && lookupSourceReqId.value && lookupSelectedTargetIds.value.length > 0

    // Issue #6873: Relation columns with multi-select - create multiple virtual columns
    if (isLookup) {
      const selectedSource = lookupSourceOptions.value.find(o => o.value === lookupSourceReqId.value)
      const newVirtualColumns = [...virtualColumns.value]
      const addedColumns = []

      // Create a virtual column for each selected target field
      for (const targetFieldId of lookupSelectedTargetIds.value) {
        const targetField = lookupTargetOptions.value.find(opt => opt.value === targetFieldId)
        const vcId = `v_${Date.now()}_${targetFieldId}`
        const vcConfig = {
          id: vcId,
          name: targetField?.label || String(targetFieldId), // Issue #6873: Use original field name
          refColumnId: String(lookupSourceReqId.value),
          targetFieldId: String(targetFieldId),
          targetTableId: selectedSource?.targetTableId ? String(selectedSource.targetTableId) : null,
          width: 150
        }
        newVirtualColumns.push(vcConfig)
        addedColumns.push(vcConfig.name)
        // Small delay to ensure unique IDs
        await new Promise(resolve => setTimeout(resolve, 1))
      }

      virtualColumns.value = newVirtualColumns
      await saveVirtualColumns(newVirtualColumns)

      toast.add({
        severity: 'success',
        summary: 'Готово',
        detail: `Добавлено ${addedColumns.length} Relation-колонок: ${addedColumns.join(', ')}`,
        life: 5000
      })
      showAddColumnDialog.value = false
      newColumnAlias.value = ''
      lookupSourceReqId.value = null
      lookupTargetReqId.value = null
      lookupSelectedTargetIds.value = []
      lookupTargetOptions.value = []
      // Reload data to reinject virtual columns into headers
      await loadData()
      return
    }

    // For reference columns, use the target table ID directly (no base type resolution needed)
    let candidateTypes
    if (isReference) {
      candidateTypes = [referenceTableId.value]
      console.log('[createColumn] Reference column → target table ID:', referenceTableId.value)
    } else if (isLookup) {
      // Lookup columns are text columns with special attributes
      candidateTypes = [await integramApiClient.resolveRequisiteType(3)] // 3 = SHORT text
      console.log('[createColumn] Lookup column → using TEXT type')
    } else if (isVote) {
      // Vote columns use LONG text (type 2) to store JSON array of voter IDs
      candidateTypes = [await integramApiClient.resolveRequisiteType(2)] // 2 = LONG text
      console.log('[createColumn] Vote column → using LONG TEXT type')
    } else {
      const baseType = (isAIAgent || isActionButton) ? 7 : newColumnType.value // 7 = BUTTON base type
      // Issue #6583: On ai2o.ru, base types (3, 7, 11...) can't be used directly.
      // Issue #6662: For button types get ALL concrete candidates to try if primary returns duplicate.
      candidateTypes = (isAIAgent || isActionButton)
        ? await integramApiClient.resolveAllRequisiteTypes(baseType)
        : [await integramApiClient.resolveRequisiteType(baseType)]
      console.log('[createColumn] Resolved type candidates:', newColumnType.value, '→', candidateTypes)
    }

    // Get existing column IDs to detect if API returns existing column instead of creating new
    const existingReqIds = new Set(headers.value.map(h => h.termId).filter(id => id && id !== 'val'))

    // Step 1: Add requisite to type — try each candidate until one creates a new column
    // Issue #6662: Some databases return an existing column ID when a concrete type already
    // has a column, so we cycle through all available concrete types as fallbacks.
    let newRequisiteId = null
    for (const candidateType of candidateTypes) {
      console.log('[createColumn] Trying type:', candidateType)
      const result = await integramApiClient.addRequisite(typeId.value, candidateType)

      // Skip on Integram API error (200 with [{error: "..."}])
      if (Array.isArray(result) && result[0]?.error) {
        console.warn('[createColumn] Type', candidateType, 'error:', result[0].error)
        continue
      }

      const candidateId = result.id
      if (!candidateId) {
        continue
      }

      // Check if returned ID already exists — API returned an existing column instead of a new one
      if (existingReqIds.has(String(candidateId)) || existingReqIds.has(candidateId)) {
        console.warn('[createColumn] Issue #6662: Type', candidateType, 'returned existing column ID', candidateId)
        continue
      }

      newRequisiteId = candidateId
      break
    }

    // Issue #6662 (user request): If all existing types are exhausted, create a new type
    // named "Кнопка ИИ N" (e.g. "Кнопка ИИ 2", "Кнопка ИИ 3", ...) for AI Agent columns.
    // This gives each new AI button its own dedicated type with a numeric index.
    if (!newRequisiteId && isAIAgent) {
      console.log('[createColumn] All existing button types exhausted — creating new AI button type')
      const newTypeId = await integramApiClient.createAIButtonType()
      const result = await integramApiClient.addRequisite(typeId.value, newTypeId)
      if (!Array.isArray(result) && result.id && !existingReqIds.has(String(result.id))) {
        newRequisiteId = result.id
        console.log('[createColumn] Created new AI button type, requisite ID:', newRequisiteId)
      }
    }

    if (!newRequisiteId) {
      throw new Error('Сервер не вернул ID нового реквизита')
    }

    // Step 2: Set alias for the requisite via backend
    // Issue #6609: Pass user credentials for user-initiated DDL operations
    const activeDatabase = database.value || route.params.database || 'kval'
    const userCredentials = getUserCredentialsForDDL(activeDatabase)
    await saveDDLAlias(newRequisiteId, newColumnAlias.value.trim(), activeDatabase, userCredentials)

    // Step 3: For AI Agent, Action Button, Vote, or Lookup, set initial attrs via backend
    // Issue #6609: Pass user credentials for user-initiated DDL operations
    if (isAIAgent) {
      const attrs = `:ALIAS=${newColumnAlias.value.trim()}:ai-agent:`
      await saveDDLAttrs(newRequisiteId, attrs, activeDatabase, userCredentials)
    } else if (isActionButton) {
      // Set initial attrs as 'none' action — user configures via context menu (⚡ Настроить действие кнопки)
      const attrs = `:ALIAS=${newColumnAlias.value.trim()}:none:`
      await saveDDLAttrs(newRequisiteId, attrs, activeDatabase, userCredentials)
    } else if (isVote) {
      // Issue #6877: Vote column stores JSON array of voter IDs with configurable icon
      // Format: :ALIAS=name:vote:icon=👍:
      const attrs = `:ALIAS=${newColumnAlias.value.trim()}:vote:icon=👍:`
      await saveDDLAttrs(newRequisiteId, attrs, activeDatabase, userCredentials)
      console.log('[createColumn] Vote column created with attrs:', attrs)
    } else if (isLookup) {
      // Issue #6792: Set lookup attributes to store configuration
      // Format: :ALIAS=name:lookup:refReq=123:targetReq=456:
      const attrs = `:ALIAS=${newColumnAlias.value.trim()}:lookup:refReq=${lookupSourceReqId.value}:targetReq=${lookupTargetReqId.value}:`
      await saveDDLAttrs(newRequisiteId, attrs, activeDatabase, userCredentials)
      console.log('[createColumn] Lookup column created with attrs:', attrs)
    }

    const refTableLabel = isReference
      ? (referenceTableOptions.value.find(t => t.value === referenceTableId.value)?.label || referenceTableId.value)
      : null
    // Issue #6792: Get lookup source/target labels for success message
    const lookupSourceLabel = isLookup
      ? (lookupSourceOptions.value.find(o => o.value === lookupSourceReqId.value)?.label || '')
      : null
    const lookupTargetLabel = isLookup
      ? (lookupTargetOptions.value.find(o => o.value === lookupTargetReqId.value)?.label || '')
      : null

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: isReference
        ? `Справочник "${newColumnAlias.value}" → "${refTableLabel}" добавлен!`
        : isAIAgent
          ? `AI Агент "${newColumnAlias.value}" добавлен! Нажмите ⚙️ для настройки.`
          : isActionButton
            ? `Кнопка действия "${newColumnAlias.value}" добавлена! Нажмите ПКМ на заголовок → ⚡ Настроить действие кнопки.`
            : isVote
              ? `Колонка голосования "${newColumnAlias.value}" добавлена! Пользователи могут голосовать за строки.`
              : isLookup
                ? `Relation-колонка "${newColumnAlias.value}" добавлена! (${lookupSourceLabel} → ${lookupTargetLabel})`
                : `Колонка "${newColumnAlias.value}" добавлена!`,
      life: 5000
    })

    showAddColumnDialog.value = false
    newColumnAlias.value = ''
    isReferenceColumn.value = false
    referenceTableId.value = null
    // Issue #6792, #6873: Reset lookup state
    lookupSourceReqId.value = null
    lookupTargetReqId.value = null
    lookupSelectedTargetIds.value = []
    lookupTargetOptions.value = []

    // Reload data to get updated headers
    await loadData()

  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось создать колонку: ' + err.message,
      life: 5000
    })
  } finally {
    isAddingColumn.value = false
  }
}

// Column type options for add column dialog
const columnTypeOptions = [
  { value: 3, label: 'Текст (короткий)', icon: '📝' },
  { value: 2, label: 'Текст (длинный)', icon: '📄' },
  { value: 13, label: 'Число', icon: '🔢' },
  { value: 4, label: 'Дата и время', icon: '🕐' },
  { value: 9, label: 'Дата', icon: '📅' },
  { value: 11, label: 'Логический (Да/Нет)', icon: '☑' },
  { value: 'action-button', label: 'Кнопка действия', icon: '⚡' },
  { value: 'ai-agent', label: 'AI Агент (кнопка)', icon: '🤖' },
  { value: 'vote', label: 'Голосование (лайки)', icon: '👍' },
  { value: 'lookup', label: 'Relation (поле из связанной таблицы)', icon: '↗' }
]

async function handleCreate() {
  if (!createForm.value.value) return

  try {
    creating.value = true
    isAddingRow.value = true

    // Build requisites
    const requisites = {}
    Object.entries(createForm.value.requisites).forEach(([reqId, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        const meta = requisitesMeta.value.find(r => r.id === reqId)
        if (meta) {
          if (meta.base === 'BOOLEAN' || meta.base === 'BOOL') {
            requisites[reqId] = value ? 'X' : ''
          } else if ((meta.base === 'DATE' || meta.base === 'DATETIME') && value instanceof Date) {
            requisites[reqId] = meta.base === 'DATE'
              ? value.toISOString().split('T')[0]
              : value.toISOString()
          } else {
            requisites[reqId] = value
          }
        }
      }
    })

    // Get parent ID from props (embedded mode) or route (standalone mode)
    // Issue #6620: Embedded tables (subordinate tables in modal, block-editor) receive parentId via props, not route
    const parentId = props.parentId || route.query.F_U || null

    const result = await integramApiClient.createObject(
      typeId.value,
      createForm.value.value,
      requisites,
      parentId
    )

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: 'Запись создана!',
      life: 3000
    })

    // Notify other components on this page about the new object
    if (result?.id) {
      integramEventBus.emit('object:created', {
        database: database.value,
        typeId: String(typeId.value),
        objectId: result.id
      })
      // Issue #6742: Broadcast to other tabs/users via WebSocket
      integramSync.publish('object:created', { database: database.value, typeId: String(typeId.value), objectId: result.id })

      // Issue #6777: Notify other users in BlockDocumentEditor about table data change
      if (wsSendTableUpdate && typeId.value && database.value) {
        wsSendTableUpdate(String(typeId.value), database.value)
      }
    }

    showCreateDialog.value = false
    createForm.value = { value: '', requisites: {} }

    // Reload data
    await loadData()

  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось создать запись: ' + err.message,
      life: 5000
    })
  } finally {
    creating.value = false
    isAddingRow.value = false
  }
}

async function handleBulkDelete(rowIds) {
  if (!rowIds || rowIds.length === 0) return
  confirm.require({
    message: `Вы уверены, что хотите удалить ${rowIds.length} записей? Данные будут потеряны.`,
    header: 'Подтверждение удаления',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      let successCount = 0
      let errorCount = 0
      for (const rowId of rowIds) {
        try {
          await integramApiClient.deleteObject(rowId)
          rows.value = rows.value.filter(r => r.id !== rowId)
          // Notify other components on this page about the deletion
          integramEventBus.emit('object:deleted', {
            database: database.value,
            typeId: String(typeId.value),
            objectId: rowId
          })
          // Issue #6742: Broadcast to other tabs/users via WebSocket
          integramSync.publish('object:deleted', { database: database.value, typeId: String(typeId.value), objectId: rowId })

          // Issue #6777: Notify other users in BlockDocumentEditor about table data change
          if (wsSendTableUpdate && typeId.value && database.value) {
            wsSendTableUpdate(String(typeId.value), database.value)
          }

          successCount++
        } catch (err) {
          errorCount++
          console.error('[handleBulkDelete] Failed to delete', rowId, err)
        }
      }
      if (successCount > 0) {
        toast.add({
          severity: 'success',
          summary: 'Удалено',
          detail: `Удалено записей: ${successCount}`,
          life: 3000
        })
      }
      if (errorCount > 0) {
        toast.add({
          severity: 'warn',
          summary: 'Частично',
          detail: `Не удалось удалить: ${errorCount}`,
          life: 5000
        })
      }
    }
  })
}

function handleRowDelete(rowId) {
  confirm.require({
    message: `Вы уверены, что хотите удалить запись #${rowId}?`,
    header: 'Подтверждение удаления',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await integramApiClient.deleteObject(rowId)

        // Remove from local data
        rows.value = rows.value.filter(r => r.id !== rowId)

        // Notify other components on this page about the deletion
        integramEventBus.emit('object:deleted', {
          database: database.value,
          typeId: String(typeId.value),
          objectId: rowId
        })
        // Issue #6742: Broadcast to other tabs/users via WebSocket
        integramSync.publish('object:deleted', { database: database.value, typeId: String(typeId.value), objectId: rowId })

        // Issue #6777: Notify other users in BlockDocumentEditor about table data change
        if (wsSendTableUpdate && typeId.value && database.value) {
          wsSendTableUpdate(String(typeId.value), database.value)
        }

        toast.add({
          severity: 'success',
          summary: 'Удалено',
          detail: 'Запись удалена',
          life: 2000
        })
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: 'Не удалось удалить: ' + err.message,
          life: 5000
        })
      }
    }
  })
}

// Issue #6784: Handle row restore for undo functionality
async function handleRowRestore(rowData) {
  try {
    const { id, cells } = rowData

    // Build requisites object from cell data
    const requisites = {}
    let mainValue = null

    // Extract requisites from cells
    if (cells) {
      Object.entries(cells).forEach(([headerId, cellData]) => {
        if (headerId === 'val') {
          mainValue = cellData.value
        } else if (headerId.startsWith('req_')) {
          const reqId = headerId.replace('req_', '')
          requisites[reqId] = cellData.value
        }
      })
    }

    // Create new object with the same ID (or let API assign new ID)
    // Note: Integram API doesn't support creating with specific ID, so we create new
    const newId = await integramApiClient.createObject(typeId.value, mainValue || '', requisites)

    // Add to local data (use original ID if possible, otherwise use new ID)
    const restoredRow = {
      id: newId,
      ...rowData,
      cells: {
        ...cells,
        val: { ...cells?.val, value: mainValue }
      }
    }

    rows.value.push(restoredRow)

    // Notify other components
    integramEventBus.emit('object:created', {
      database: database.value,
      typeId: String(typeId.value),
      objectId: newId
    })

    toast.add({
      severity: 'success',
      summary: 'Восстановлено',
      detail: 'Строка восстановлена (Undo)',
      life: 2000
    })
  } catch (err) {
    console.error('[handleRowRestore] Failed to restore row:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось восстановить строку: ' + err.message,
      life: 5000
    })
  }
}

async function handleRowMoveUp(rowId) {
  try {
    await integramApiClient.moveObjectUp(rowId)

    toast.add({
      severity: 'success',
      summary: 'Перемещено',
      detail: 'Объект перемещён вверх',
      life: 2000
    })

    // Reload data to reflect new order
    await loadData(1)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось переместить: ' + err.message,
      life: 5000
    })
  }
}

async function handleRowChangeParent({ rowId, newParentId }) {
  try {
    // newParentId = 1 means make independent (up=1), otherwise set as subordinate
    await integramApiClient.moveObjectToParent(rowId, newParentId)

    const actionText = newParentId === 1 ? 'Запись теперь независимая' : `Запись переподчинена (ID родителя: ${newParentId})`

    toast.add({
      severity: 'success',
      summary: 'Подчинённость изменена',
      detail: actionText,
      life: 3000
    })

    // Reload data to reflect the change
    await loadData(1)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось изменить подчинённость: ' + err.message,
      life: 5000
    })
  }
}

/**
 * Handle row duplication (with subordinates)
 * Issue #6616: Duplicates a row including all its subordinate/nested objects
 * @param {number} rowId - ID of the row to duplicate
 */
async function handleRowDuplicate(rowId) {
  try {
    // Ensure database context is set (fixes #6616 bug)
    if (database.value) {
      integramApiClient.setDatabase(database.value)
    }

    // Show progress toast
    toast.add({
      severity: 'info',
      summary: 'Дублирование...',
      detail: 'Копируем строку и подчинённые записи',
      life: 2000
    })

    // 1. Get full object data including requisites
    const fullObject = await integramApiClient.getObjectEditData(rowId)
    if (!fullObject || !fullObject.obj) {
      throw new Error('Не удалось загрузить данные объекта')
    }

    // 2. Extract object data
    const objData = fullObject.obj
    const typeId = objData.typ
    const parentId = objData.up

    // Get arr_type (subordinate table map) from getObjectList — edit_obj does NOT include it at top level.
    // arr_type structure from getObjectList: { "reqId": "subordinateTypeId", ... }
    // KEYS are the subordinate array requisite IDs (also valid typeIds for getObjectList with F_U filter).
    let arrType = {}
    try {
      const typeMeta = await integramApiClient.getObjectList(typeId, { LIMIT: 1 })
      arrType = typeMeta?.arr_type || {}
    } catch (metaErr) {
      console.warn('[handleRowDuplicate] Could not fetch type metadata for arr_type:', metaErr)
    }

    // Build requisites map from the response
    // reqs is an object { reqId: { type, value, base, arr_type?, ... }, ... }, not an array
    const requisites = {}
    if (fullObject.reqs && typeof fullObject.reqs === 'object') {
      for (const [reqId, reqData] of Object.entries(fullObject.reqs)) {
        // Skip reqs that belong to a subordinate table (indicated by req.arr_type being set)
        if (reqData && typeof reqData === 'object' && reqData.arr_type) continue
        // Extract value: reqData can be a primitive or object with .value/.val
        const val = (reqData !== null && typeof reqData === 'object')
          ? (reqData.value ?? reqData.val ?? null)
          : reqData
        if (val !== undefined && val !== null && val !== '') {
          requisites[reqId] = val
        }
      }
    }

    // 3. Create the main object copy
    const newObjectValue = objData.val
    const result = await integramApiClient.createObject(
      typeId,
      newObjectValue,
      requisites,
      parentId
    )

    if (!result || result.failed) {
      throw new Error(result?.failed || 'Не удалось создать копию объекта')
    }

    const newObjectId = result.id

    // 4. Find and duplicate subordinate objects
    // arrType keys are the requisite IDs that double as typeIds for getObjectList with F_U filter.
    const subordinateTypeIds = Object.keys(arrType).filter(id => id && arrType[id] && arrType[id] !== '0')

    let subordinatesCopied = 0
    for (const subordinateTypeId of subordinateTypeIds) {
      try {
        // Get all subordinate objects for this type
        const subordinates = await integramApiClient.getObjectList(subordinateTypeId, {
          F_U: rowId,  // Filter by parent ID
          LIMIT: 1000  // Get all subordinates
        })

        const subObjects = subordinates?.object || []
        for (const subObj of subObjects) {
          // Get full subordinate object data
          const fullSubObject = await integramApiClient.getObjectEditData(subObj.id)
          if (!fullSubObject || !fullSubObject.obj) continue

          const subObjData = fullSubObject.obj

          // Build subordinate requisites
          // reqs is an object { reqId: { type, value, base, arr_type?, ... }, ... }, not an array
          const subRequisites = {}
          if (fullSubObject.reqs && typeof fullSubObject.reqs === 'object') {
            for (const [reqId, reqData] of Object.entries(fullSubObject.reqs)) {
              // Skip reqs that belong to a deeper subordinate table
              if (reqData && typeof reqData === 'object' && reqData.arr_type) continue
              // Extract value: reqData can be a primitive or object with .value/.val
              const val = (reqData !== null && typeof reqData === 'object')
                ? (reqData.value ?? reqData.val ?? null)
                : reqData
              if (val !== undefined && val !== null && val !== '') {
                subRequisites[reqId] = val
              }
            }
          }

          // Create copy of subordinate object under the new parent
          await integramApiClient.createObject(
            subordinateTypeId,
            subObjData.val,
            subRequisites,
            newObjectId  // Link to the new parent object
          )
          subordinatesCopied++
        }
      } catch (subErr) {
        console.warn(`[handleRowDuplicate] Failed to copy subordinates of type ${subordinateTypeId}:`, subErr)
        // Continue with other subordinate types
      }
    }

    // 5. Reload data to show the new object
    await loadData(1)

    // Success message
    const detail = subordinatesCopied > 0
      ? `Создана копия с ${subordinatesCopied} подчинённ${subordinatesCopied === 1 ? 'ой записью' : 'ыми записями'}`
      : 'Создана копия строки'

    toast.add({
      severity: 'success',
      summary: 'Строка дублирована',
      detail,
      life: 3000
    })

  } catch (err) {
    console.error('[handleRowDuplicate] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка дублирования',
      detail: err.message || 'Не удалось дублировать строку',
      life: 5000
    })
  }
}

/**
 * Handle row expand action (Coda.io-style "Развернуть")
 * Opens the row object in a dedicated edit page (edit_obj route)
 */
function handleRowExpand(rowId) {
  const dbName = route.params.database || 'my'
  const url = `/integram/${dbName}/edit_obj/${rowId}`
  window.open(url, '_blank')
}

/**
 * Handle add-row-after action (Coda.io-style inline "+" button below a row)
 * Creates a new row (same as handleAddRow, but positioned after the given row)
 */
async function handleAddRowAfter(afterRowId) {
  // For now, just add a new row (Integram API doesn't support explicit ordering)
  await handleAddRow()
}

/**
 * Handle button action change from DataTable
 * Saves the button label, endpoint, and params to the column's attrs via _d_attrs API
 * New format: :ALIAS=ButtonLabel:endpoint:param1=value1:param2=value2:
 */
async function handleButtonActionChange({ headerId, termId, action, label, params }) {
  try {
    // Use label from dialog or fallback
    const buttonLabel = label || 'Кнопка'

    // Build attrs format: :ALIAS=Label:endpoint:param1=value1:param2=value2:
    let newAttrs = `:ALIAS=${buttonLabel}`

    // Add endpoint (or action id for 'none' type)
    if (action.endpoint) {
      newAttrs += `:${action.endpoint}`
    } else if (action.id) {
      newAttrs += `:${action.id}`
    }

    // Add params (only non-empty values)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value && value !== '') {
          newAttrs += `:${key}=${value}`
        }
      }
    }

    newAttrs += ':'

    // Save to server via _d_attrs endpoint
    await integramApiClient.saveRequisiteAttributes(termId, newAttrs)

    // Update local headers
    const headerIndex = headers.value.findIndex(h => h.id === headerId)
    if (headerIndex !== -1) {
      headers.value[headerIndex].attrs = newAttrs
    }

    toast.add({
      severity: 'success',
      summary: 'Кнопка настроена',
      detail: `"${buttonLabel}" → ${action.label}`,
      life: 3000
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось сохранить настройки кнопки: ' + err.message,
      life: 5000
    })
  }
}

/**
 * Handle button click from DataTable
 * Executes the configured action (API call, custom URL, etc.)
 * and reactively updates the UI based on refreshAction
 */
async function handleButtonClick({ rowId, headerId, endpoint, params, actionType, refreshAction }) {
  try {
    console.log('[handleButtonClick]', { rowId, headerId, endpoint, params, actionType, refreshAction })

    // For custom URLs, open in new tab
    if (actionType === 'custom-url') {
      let url = endpoint
      // Add params as query string if any
      if (params && Object.keys(params).length > 0) {
        const queryParams = new URLSearchParams(params).toString()
        url += (url.includes('?') ? '&' : '?') + queryParams
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    // For "Add Row" action: create a new row in the current table
    if (actionType === 'add-row') {
      await integramApiClient.createObject(
        typeId.value,
        '', // Empty value - user will edit inline
        {},
        null
      )
      toast.add({
        severity: 'success',
        summary: 'Строка добавлена',
        detail: 'Новая строка создана в таблице',
        life: 3000
      })
      await loadData(currentPage.value)
      return
    }

    // For "Call Report" action: execute a report by ID
    if (actionType === 'call-report') {
      const reportId = params?.reportId
      if (!reportId) {
        toast.add({
          severity: 'warn',
          summary: 'Не задан отчет',
          detail: 'Настройте кнопку: укажите ID отчета',
          life: 4000
        })
        return
      }
      const reportParams = { _m_confirmed: 0 }
      if (rowId) reportParams.row_id = rowId
      const result = await integramApiClient.executeReport(reportId, reportParams)
      toast.add({
        severity: 'success',
        summary: 'Отчет запущен',
        detail: `Отчет ${reportId} выполнен успешно`,
        life: 3000
      })
      if (refreshAction === 'reload-table') {
        await loadData(currentPage.value)
      }
      return
    }

    // For "newapi" direct command: execute arbitrary Integram API call
    if (actionType === 'newapi') {
      const apiCommand = params?.apiCommand
      if (!apiCommand) {
        toast.add({
          severity: 'warn',
          summary: 'Не задана команда',
          detail: 'Настройте кнопку: укажите команду API',
          life: 4000
        })
        return
      }
      // Parse command: may be "endpoint?param1=v1&param2=v2" format
      const [commandPath, queryString] = apiCommand.split('?')
      const commandParams = new URLSearchParams()
      if (queryString) {
        queryString.split('&').forEach(part => {
          const [k, v] = part.split('=')
          if (k) commandParams.append(k, v || '')
        })
      }
      await integramApiClient.post(commandPath, commandParams)
      toast.add({
        severity: 'success',
        summary: 'Команда выполнена',
        detail: `API команда выполнена: ${commandPath}`,
        life: 3000
      })
      if (refreshAction === 'reload-table' || !refreshAction) {
        await loadData(currentPage.value)
      } else if (refreshAction === 'delete-row') {
        const rowIndex = rows.value.findIndex(r => r.id === rowId)
        if (rowIndex !== -1) rows.value.splice(rowIndex, 1)
      }
      return
    }

    // For API macros, make POST request
    if (actionType === 'api-macro') {
      // Convert params to form data
      const formData = new URLSearchParams()
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value && value !== '') {
            formData.append(key, value)
          }
        }
      }

      // Make API call through integramApiClient
      await integramApiClient.post(endpoint, formData)

      // Show success toast
      toast.add({
        severity: 'success',
        summary: 'Действие выполнено',
        detail: `Запрос успешно выполнен: ${endpoint}`,
        life: 3000
      })

      // Reactive refresh based on refreshAction
      if (refreshAction === 'delete-row') {
        // Remove row from local data
        const rowIndex = rows.value.findIndex(r => r.id === rowId)
        if (rowIndex !== -1) {
          rows.value.splice(rowIndex, 1)
        }
      } else if (refreshAction === 'reload-table') {
        // Reload entire table
        await loadData(currentPage.value)
      } else if (refreshAction === 'reload-cell') {
        // Reload specific row (find and update)
        const response = await integramApiClient.getObjectEditData(rowId)
        if (response?.obj) {
          const rowIndex = rows.value.findIndex(r => r.id === rowId)
          if (rowIndex !== -1) {
            // Update row data
            // (simplified - in real implementation, merge response into row)
            await loadData(currentPage.value)
          }
        }
      }
    }
  } catch (err) {
    console.error('[handleButtonClick] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка действия',
      detail: 'Не удалось выполнить действие: ' + err.message,
      life: 5000
    })
  }
}

/**
 * Handle AI button click from DataTable
 * Executes AI prompt with row context and can manipulate Integram data via MCP
 * @param {Object} params - AI button parameters
 * @param {string|number} params.rowId - Row ID
 * @param {string|number} params.headerId - Header ID
 * @param {Object} params.rowData - Full row data as context
 * @param {Object} params.params - Button parameters (aiModel, aiPrompt, outputColumn)
 * @param {string} params.refreshAction - Refresh action after AI execution
 */
async function handleAIButtonClick({ rowId, headerId, rowData, params, refreshAction }) {
  try {
    console.log('[handleAIButtonClick]', { rowId, headerId, rowData, params, refreshAction })

    // Get user ID
    const userId = getCurrentUserId()
    if (!userId) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось определить пользователя. Войдите в систему.',
        life: 5000
      })
      return
    }

    // Get user's AI token (uses existing infrastructure)
    const tokenData = await getDefaultToken(userId)
    const { token, defaultModel } = tokenData

    // Extract AI parameters from button attrs
    const aiModel = params.aiModel || defaultModel?.model_id || 'deepseek/deepseek-chat'
    const promptTemplate = params.aiPrompt || 'Проанализируй эту строку и предложи улучшения'
    const outputField = params.outputField || null

    // Replace placeholders in prompt with row data
    // Placeholders: [ID], [VAL], [ColumnAlias]
    let prompt = promptTemplate

    // Replace [ID] with rowId
    prompt = prompt.replace(/\[ID\]/g, rowId)

    // Replace [VAL] with main value if exists
    if (rowData.val) {
      prompt = prompt.replace(/\[VAL\]/g, rowData.val)
    }

    // Replace column placeholders [ColumnName] with actual values
    for (const [key, value] of Object.entries(rowData)) {
      const placeholder = `[${key}]`
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, 'g'), value || '')
      }
    }

    // Show loading toast
    const loadingToast = toast.add({
      severity: 'info',
      summary: 'AI обработка',
      detail: 'Выполняется AI обработка строки...',
      life: 0 // Don't auto-close
    })

    // Call AI via existing token-based endpoint
    const apiBaseUrl = getApiUrl('/api')
    const response = await fetch(`${apiBaseUrl}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: aiModel,
        prompt: prompt,
        application: 'IntegramAIButton',
        operation: 'ai-button-execute',
        temperature: 0.7,
        maxTokens: 1024
      })
    })

    // Remove loading toast
    toast.remove(loadingToast)

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      let errorData = {}
      try { errorData = JSON.parse(bodyText) } catch {}
      throw new Error(errorData.error || errorData.message || `AI request failed (${response.status})${bodyText && !bodyText.startsWith('<') ? ': ' + bodyText.substring(0, 100) : ''}`)
    }

    const result = await response.json()
    const aiResponse = result.content || result.response || ''

    // If outputField specified, update Integram via IntegramService
    if (outputField && aiResponse) {
      // Find the header ID for the output field alias
      const outputHeader = headers.value.find(h => h.alias === outputField || h.val === outputField)

      if (outputHeader) {
        // Use IntegramAPIClient to update the requisite
        await integramApiClient.setObjectRequisites(rowId, {
          [outputHeader.id]: aiResponse.trim()
        })

        toast.add({
          severity: 'success',
          summary: 'AI обработка завершена',
          detail: `Поле "${outputField}" обновлено: ${aiResponse.trim()}`,
          life: 5000
        })
      } else {
        toast.add({
          severity: 'warning',
          summary: 'AI обработка завершена',
          detail: `Поле "${outputField}" не найдено, но AI ответил: ${aiResponse}`,
          life: 8000
        })
      }
    } else {
      // Just show AI response without updating
      toast.add({
        severity: 'info',
        summary: 'AI ответ',
        detail: aiResponse,
        life: 8000
      })
    }

    // Refresh table to show updates
    if (refreshAction === 'reload-table' || outputField) {
      await loadData(currentPage.value)
    }
  } catch (err) {
    console.error('[handleAIButtonClick] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка AI обработки',
      detail: 'Не удалось выполнить AI обработку: ' + err.message,
      life: 8000
    })
  }
}

/**
 * Fetch with automatic retry on transient errors (502/503/504/network failures).
 * @param {string} url - Fetch URL
 * @param {Object} options - Fetch options
 * @param {number} [maxRetries=2] - Max retry attempts
 * @param {number} [delay=1500] - Delay between retries in ms
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = 2, delay = 1500) {
  let lastResponse = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
    try {
      const response = await fetch(url, options)
      // Retry on gateway/server-overload errors only
      if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
        lastResponse = response
        console.warn(`[fetchWithRetry] ${response.status} received, will retry`)
        continue
      }
      return response
    } catch (networkErr) {
      // Network error (connection refused, timeout, etc.) — retry
      console.warn(`[fetchWithRetry] Network error on attempt ${attempt + 1}:`, networkErr.message)
      if (attempt >= maxRetries) throw networkErr
      lastResponse = null
    }
  }
  // Exhausted retries — return last gateway response or throw
  if (lastResponse) return lastResponse
  throw new Error('AI request failed after retries')
}

/**
 * Handle AI Agent Execute button click
 * Uses the same logic as handleAIButtonClick but with config from attrs
 * Issue #6547: Added support for MCP mode to interact with other tables/rows
 * @param {Object} params - Execute parameters
 * @param {string|number} params.rowId - Row ID
 * @param {string|number} params.headerId - Header ID
 * @param {Object} params.rowData - Row data context
 * @param {Object} params.config - AI config { model, prompt, outputField, useMCP }
 */
async function handleAIAgentExecute({ rowId, headerId, rowData, config }) {
  try {
    console.log('[handleAIAgentExecute]', { rowId, headerId, rowData, config })

    // Get user ID
    const userId = getCurrentUserId()
    if (!userId) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось определить пользователя. Войдите в систему.',
        life: 5000
      })
      return
    }

    // Get user's AI token
    const tokenData = await getDefaultToken(userId)
    const { token } = tokenData

    // Use config from attrs
    const aiModel = config.model || 'Kodacode/KodaAgent'
    const promptTemplate = config.prompt || ''
    const outputField = config.outputField || null
    const useWebSearch = config.useWebSearch || false // Issue #6607: Web search (Tavily) flag
    const useMCP = config.useMCP || false // Issue #6547: MCP mode flag

    if (!promptTemplate) {
      toast.add({
        severity: 'warn',
        summary: 'Промпт не настроен',
        detail: 'Сначала настройте промпт в диалоге настройки AI',
        life: 5000
      })
      return
    }

    // Replace placeholders in prompt
    let prompt = promptTemplate
    prompt = prompt.replace(/\[ID\]/g, rowId)

    if (rowData.val) {
      prompt = prompt.replace(/\[VAL\]/g, rowData.val)
    }

    // Replace column placeholders
    for (const [key, value] of Object.entries(rowData)) {
      const placeholder = `[${key}]`
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, 'g'), value || '')
      }
    }

    // Show loading toast (auto-dismiss after 60s for MCP mode which can take longer)
    const loadingLife = useMCP ? 60000 : (useWebSearch ? 45000 : 30000)
    const agentLabel = useMCP ? 'AI Агент (MCP)' : (useWebSearch ? 'AI Агент (Веб-поиск)' : 'AI Агент')
    const agentDetail = useMCP ? 'Выполняется обработка с доступом к БД...' : (useWebSearch ? 'Выполняется обработка с поиском в интернете...' : 'Выполняется обработка...')
    toast.add({
      severity: 'info',
      summary: agentLabel,
      detail: agentDetail,
      life: loadingLife
    })

    const t0 = performance.now()

    let aiResponse = ''
    const apiBaseUrl = getApiUrl('/api')

    // Issue #6547: Use MCP endpoint if useMCP is enabled
    if (useMCP) {
      console.log('[AI Agent MCP] Using MCP mode for cross-table operations')

      // Get Integram tokens for MCP context
      const integramToken = integramApiClient.getToken()
      const integramXsrf = integramApiClient.getXsrfToken()
      const activeDatabase = route.params.database || database.value
      const serverURL = integramApiClient.getServer() || 'https://ai2o.ru'

      // Build enhanced system prompt for MCP mode
      const mcpSystemPrompt = `You are an AI assistant with access to the Integram database.
You can read and write data to ANY table in the database using the provided MCP tools.

Current context:
- Database: ${activeDatabase}
- Current table ID: ${typeId.value}
- Current row ID: ${rowId}
- Row data: ${JSON.stringify(rowData, null, 2)}

Available tools:
- integram_get_dictionary: List all tables
- integram_get_type_metadata: Get table structure
- integram_get_object_list: Read data from any table
- integram_create_object: Create new records
- integram_set_object_requisites: Update record fields
- integram_delete_object: Delete records

User request: ${prompt}

Execute the user's request using the appropriate tools. When updating data, use the exact field IDs from the metadata.`

      const response = await fetchWithRetry(`${apiBaseUrl}/mcp/integram/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: prompt,
          systemPrompt: mcpSystemPrompt,
          serverURL: serverURL,
          database: activeDatabase,
          token: integramToken,
          xsrfToken: integramXsrf,
          model: aiModel.includes('deepseek') ? 'deepseek-chat' : aiModel,
          temperature: 0.7,
          maxTokens: 4000,
          conversationHistory: []
        })
      })

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        let errorData = {}
        try { errorData = JSON.parse(bodyText) } catch {}
        throw new Error(errorData.error || errorData.message || `MCP chat request failed (${response.status})${bodyText && !bodyText.startsWith('<') ? ': ' + bodyText.substring(0, 100) : ''}`)
      }

      const result = await response.json()
      aiResponse = result.response || ''
      console.log(`[AI Agent MCP] Tool calls: ${result.toolCallsCount || 0}, Response time: ${(performance.now() - t0).toFixed(0)}ms`)

    } else if (useWebSearch) {
      // Issue #6607: Web search mode - use unified /api/chat endpoint with Tavily
      console.log('[AI Agent Web Search] Using unified chat endpoint with Tavily web search')

      const response = await fetchWithRetry(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: prompt,
          model: aiModel,
          userId: userId,
          enableTools: false, // No MCP tools in web search mode
          enableWebSearch: true, // Enable Tavily web search
          enableEditorTools: false,
          temperature: 0.7,
          maxTokens: 2048,
          stream: false
        })
      })

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        let errorData = {}
        try { errorData = JSON.parse(bodyText) } catch {}
        throw new Error(errorData.error || errorData.message || `AI request failed (${response.status})${bodyText && !bodyText.startsWith('<') ? ': ' + bodyText.substring(0, 100) : ''}`)
      }

      const result = await response.json()
      aiResponse = result.response || result.content || ''
      console.log(`[AI Agent Web Search] Tool calls: ${result.toolCallsExecuted || 0}, Response time: ${(performance.now() - t0).toFixed(0)}ms`)

    } else {
      // Standard mode: Call AI via token-based endpoint (no MCP tools, no web search)
      const response = await fetchWithRetry(`${apiBaseUrl}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: aiModel,
          prompt: prompt,
          application: 'IntegramAIAgent',
          operation: 'ai-agent-execute',
          temperature: 0.7,
          maxTokens: 2048
        })
      })

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        let errorData = {}
        try { errorData = JSON.parse(bodyText) } catch {}
        throw new Error(errorData.error || errorData.message || `AI request failed (${response.status})${bodyText && !bodyText.startsWith('<') ? ': ' + bodyText.substring(0, 100) : ''}`)
      }

      const result = await response.json()
      aiResponse = result.content || result.response || ''
      console.log(`[AI Agent] API response time: ${(performance.now() - t0).toFixed(0)}ms`)
    }

    // Update output field if specified (and NOT in MCP mode where AI handles updates)
    if (outputField && aiResponse && !useMCP) {
      // Find header by termId (new format) or alias (legacy format)
      const outputHeader = headers.value.find(h =>
        String(h.termId) === String(outputField) ||
        h.id === `req_${outputField}` ||
        h.alias === outputField || h.value === outputField || h.val === outputField
      )

      if (outputHeader) {
        // Extract numeric ID from header.id (e.g., "req_248935" -> "248935")
        const numericId = String(outputHeader.id).replace(/^req_/, '')

        // Ensure correct database before update
        integramApiClient.setDatabase(route.params.database || database.value)

        console.log('[AI Agent] Writing to field:', { rowId, numericId, outputField, response: aiResponse.substring(0, 50) })

        const t1 = performance.now()
        await integramApiClient.setObjectRequisites(rowId, {
          [numericId]: aiResponse.trim()
        })
        console.log(`[AI Agent] Field update time: ${(performance.now() - t1).toFixed(0)}ms`)

        // Update local cell without reloading entire table
        // Compare as strings to handle number/string mismatch
        const rowIndex = rows.value.findIndex(r => String(r.id) === String(rowId))
        console.log('[AI Agent] Updating local cell:', { rowIndex, rowId, headerId: outputHeader.id })
        if (rowIndex !== -1) {
          const row = rows.value[rowIndex]

          // Try both 'values' and 'cells' array (different DataTable versions)
          const cellArray = row.values || row.cells || []
          const cell = cellArray.find(v => v.headerId === outputHeader.id)

          if (cell) {
            cell.value = aiResponse.trim()
            console.log('[AI Agent] Cell updated locally:', aiResponse.trim())
          } else {
            console.log('[AI Agent] Cell not found, available headerIds:', cellArray.map(c => c.headerId))
          }
        } else {
          console.log('[AI Agent] Row not found, available row IDs:', rows.value.slice(0, 5).map(r => r.id))
        }

        toast.add({
          severity: 'success',
          summary: 'AI Агент завершил',
          detail: `Поле "${outputField}" обновлено`,
          life: 5000
        })
      } else {
        toast.add({
          severity: 'info',
          summary: 'AI ответ',
          detail: aiResponse,
          life: 8000
        })
      }
    } else if (useMCP) {
      // MCP mode: AI already handled the updates, just show response
      toast.add({
        severity: 'success',
        summary: 'AI Агент (MCP) завершил',
        detail: aiResponse || 'Операция выполнена',
        life: 8000
      })

      // Reload table to show MCP-made changes
      await loadData(currentPage.value)
    } else {
      toast.add({
        severity: 'info',
        summary: 'AI ответ',
        detail: aiResponse,
        life: 8000
      })
    }

    console.log(`[AI Agent] Total time: ${(performance.now() - t0).toFixed(0)}ms`)
  } catch (err) {
    console.error('[handleAIAgentExecute] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка AI Агента',
      detail: err.message,
      life: 8000
    })
  }
}

/**
 * Handle saving AI Agent configuration to attrs
 * @param {Object} params - Save parameters
 * @param {string} params.headerId - Header ID in DataTable
 * @param {string} params.termId - Requisite ID in database
 * @param {Object} params.config - AI config to save
 * @param {string} params.attrs - New attrs string
 */
async function handleAIAgentSaveConfig({ headerId, termId, config, attrs }) {
  try {
    console.log('[handleAIAgentSaveConfig]', { headerId, termId, config, attrs })

    // Find the header
    const header = headers.value.find(h => h.id === headerId)
    const requisiteId = termId || header?.termId

    if (!requisiteId || requisiteId === 'val') {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось найти ID реквизита для сохранения',
        life: 5000
      })
      return
    }

    const activeDatabase = route?.params?.database || database.value || 'kval'
    console.log('[handleAIAgentSaveConfig] Database:', activeDatabase)

    // Issue #6609: Pass user credentials for user-initiated DDL operations
    const userCredentials = getUserCredentialsForDDL(activeDatabase)
    const result = await saveDDLAttrs(requisiteId, attrs, activeDatabase, userCredentials)

    console.log('[handleAIAgentSaveConfig] Result:', result)

    // Update local header attrs without reloading entire table
    const headerIndex = headers.value.findIndex(h => h.id === headerId)
    if (headerIndex !== -1) {
      headers.value[headerIndex].attrs = attrs
    }

    toast.add({
      severity: 'success',
      summary: 'Конфигурация сохранена',
      detail: 'Настройки AI агента обновлены',
      life: 3000
    })
  } catch (err) {
    console.error('[handleAIAgentSaveConfig] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: err.message,
      life: 5000
    })
  }
}

/**
 * Issue #6877: Handle vote button clicks - save updated voters array
 * @param {Object} params - Vote update parameters
 * @param {number} params.rowId - Row ID that was voted on
 * @param {string} params.headerId - Header ID of vote column
 * @param {string} params.value - Updated JSON array of voter IDs
 */
async function handleVoteUpdate({ rowId, headerId, value }) {
  try {
    console.log('[handleVoteUpdate]', { rowId, headerId, value })

    // Find the header to get the requisite ID
    const header = headers.value.find(h => h.id === headerId)
    const requisiteId = header?.termId

    if (!requisiteId || requisiteId === 'val') {
      console.error('[handleVoteUpdate] Invalid requisite ID:', requisiteId)
      return
    }

    // Save the updated voters array to the database
    await integramApiClient.setObjectRequisites(rowId, {
      [requisiteId]: value
    })

    console.log('[handleVoteUpdate] Vote saved successfully')
  } catch (err) {
    console.error('[handleVoteUpdate] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения голоса',
      detail: err.message,
      life: 5000
    })
  }
}

/**
 * Issue #6877: Handle vote icon configuration save
 * @param {Object} params - Vote config parameters
 * @param {string} params.headerId - Header ID of vote column
 * @param {string} params.termId - Requisite ID
 * @param {string} params.attrs - Updated attrs string with new icon
 * @param {string} params.icon - New icon emoji
 */
async function handleVoteSaveConfig({ headerId, termId, attrs, icon }) {
  try {
    console.log('[handleVoteSaveConfig]', { headerId, termId, attrs, icon })

    const requisiteId = termId
    if (!requisiteId || requisiteId === 'val') {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось найти ID реквизита для сохранения',
        life: 5000
      })
      return
    }

    const activeDatabase = route?.params?.database || database.value || 'kval'
    const userCredentials = getUserCredentialsForDDL(activeDatabase)
    await saveDDLAttrs(requisiteId, attrs, activeDatabase, userCredentials)

    // Update local header attrs
    const headerIndex = headers.value.findIndex(h => h.id === headerId)
    if (headerIndex !== -1) {
      headers.value[headerIndex].attrs = attrs
    }

    toast.add({
      severity: 'success',
      summary: 'Иконка обновлена',
      detail: `Новая иконка голосования: ${icon}`,
      life: 3000
    })

    // Reload to show updated icon
    await loadData()
  } catch (err) {
    console.error('[handleVoteSaveConfig] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: err.message,
      life: 5000
    })
  }
}

/**
 * Issue #6854: Create new reference value from dropdown/multiselect
 * @param {Object} params - Create parameters
 * @param {number} params.typeId - Reference table type ID
 * @param {string} params.value - New value to create
 * @param {boolean} params.isMulti - Whether this is from MultiSelect (vs Dropdown)
 * @param {Function} params.onSuccess - Callback with created object
 */
async function handleCreateRefValue({ typeId, value, isMulti, onSuccess }) {
  try {
    console.log('[handleCreateRefValue] Creating new reference value:', { typeId, value, isMulti })

    // Create the new object in the reference table
    const result = await integramApiClient.createObject(typeId, value, {}, null)

    if (!result || !result.id) {
      throw new Error('Не удалось создать значение')
    }

    console.log('[handleCreateRefValue] Created object:', result)

    // Notify other components about the new object
    integramEventBus.emit('object:created', {
      database: database.value,
      typeId: String(typeId),
      objectId: result.id
    })

    // Show success toast
    toast.add({
      severity: 'success',
      summary: 'Значение добавлено в справочник',
      detail: `"${value}" успешно создано`,
      life: 3000
    })

    // Call onSuccess callback to update the field
    if (onSuccess) {
      onSuccess(result)
    }

    // Reload the directory list to include the new value
    // This is handled automatically by the event bus listener in DataTable
  } catch (err) {
    console.error('[handleCreateRefValue] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка создания значения',
      detail: err.message || 'Не удалось создать новое значение',
      life: 5000
    })
  }
}

/**
 * Issue #6838: Handle Select Column Settings Save
 * Save display field and filter condition settings for Select/Multiselect columns
 * @param {Object} params - Save parameters
 * @param {string} params.headerId - Header ID in DataTable
 * @param {string} params.termId - Requisite ID in database
 * @param {Object} params.config - Configuration object
 * @param {string} params.attrs - New attrs string to save
 */
async function handleSelectColumnSaveConfig({ headerId, termId, config, attrs, isMulti }) {
  try {
    console.log('[handleSelectColumnSaveConfig]', { headerId, termId, config, attrs })

    // Find the header
    const header = headers.value.find(h => h.id === headerId)
    const requisiteId = termId || header?.termId

    if (!requisiteId || requisiteId === 'val') {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось найти ID реквизита для сохранения',
        life: 5000
      })
      return
    }

    const activeDatabase = route?.params?.database || database.value || 'kval'
    console.log('[handleSelectColumnSaveConfig] Database:', activeDatabase)

    // Issue #6609: Pass user credentials for user-initiated DDL operations
    const userCredentials = getUserCredentialsForDDL(activeDatabase)
    const result = await saveDDLAttrs(requisiteId, attrs, activeDatabase, userCredentials)

    console.log('[handleSelectColumnSaveConfig] Result:', result)

    // Update local header attrs without reloading entire table
    const headerIndex = headers.value.findIndex(h => h.id === headerId)
    if (headerIndex !== -1) {
      headers.value[headerIndex].attrs = attrs
      // Issue #6839: Also update filterCondition so localHeaders watcher in DataTable preserves it
      headers.value[headerIndex].filterCondition = config?.filterCondition || null
      if (isMulti !== undefined) {
        headers.value[headerIndex].isMulti = isMulti
        headers.value[headerIndex].columnType = isMulti ? 'multi' : 'dir'
      }
    }

    toast.add({
      severity: 'success',
      summary: 'Настройки сохранены',
      detail: 'Параметры колонки обновлены',
      life: 3000
    })
  } catch (err) {
    console.error('[handleSelectColumnSaveConfig] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: err.message,
      life: 5000
    })
  }
}

/**
 * Issue #6838/6839: Load directory type metadata for SelectColumnSettingsDialog
 * Returns the list of requisites (fields) available in the referenced table.
 * For reference fields, also loads the items of the referenced table so the
 * filter builder can show a dropdown instead of a plain text input.
 * @param {Object} params
 * @param {number} params.dirTableId - Directory table ID
 * @param {Function} params.callback - Receives { requisites: [{id, alias, base, refTypeId?, refItems?}] }
 */
async function handleLoadDirectoryMetadata({ dirTableId, callback }) {
  try {
    const metadata = await integramApiClient.getTypeMetadata(dirTableId)
    const requisites = []

    // getTypeMetadata returns: { reqs: [{id, val, ref, ...}] }
    // req.ref is set for reference fields and contains the referenced type ID
    if (metadata?.reqs && Array.isArray(metadata.reqs)) {
      // Build basic requisite list first
      for (const req of metadata.reqs) {
        const alias = req.alias || req.val || `Поле ${req.id}`
        const base = req.base || req.requisite_type_id || 'SHORT'
        const refTypeId = req.ref || null  // ID of the referenced table (if this is a ref field)

        requisites.push({ id: String(req.id), alias, base, refTypeId, refItems: [] })
      }

      // For reference fields: load items from the referenced table in parallel
      await Promise.all(
        requisites
          .filter(r => r.refTypeId)
          .map(async (r) => {
            try {
              const refData = await integramApiClient.getObjectList(r.refTypeId, { LIMIT: 200 })
              r.refItems = (refData?.object || []).map(obj => ({
                id: String(obj.id),
                value: obj.val || String(obj.id)
              }))
            } catch (e) {
              console.warn('[handleLoadDirectoryMetadata] Could not load ref items for', r.refTypeId, e)
            }
          })
      )
    }

    callback({ requisites })
  } catch (err) {
    console.error('[handleLoadDirectoryMetadata] Error loading metadata for', dirTableId, err)
    callback({ requisites: [] })
  }
}

/**
 * Handle header/column actions from DataTable (delete, rename, etc.)
 * @param {Object} params - Action parameters
 * @param {string} params.action - Action type ('delete', 'rename', etc.)
 * @param {string} params.headerId - Header ID in DataTable
 * @param {string} params.termId - Requisite ID in database
 */
async function handleHeaderAction({ action, headerId, termId }) {
  console.log('[handleHeaderAction]', { action, headerId, termId })

  if (action === 'delete') {
    // Find header to get termId if not provided
    const header = headers.value.find(h => h.id === headerId)
    let requisiteId = termId || header?.termId

    console.log('[handleHeaderAction] Delete column:', { headerId, termId, requisiteId, header })

    // Check if trying to delete main column (val) - not allowed
    if (requisiteId === 'val' || headerId === 'val') {
      toast.add({
        severity: 'warn',
        summary: 'Невозможно удалить',
        detail: 'Главную колонку удалить нельзя',
        life: 5000
      })
      return
    }

    // Ensure requisiteId is a valid number (API expects numeric ID)
    // req_order from API returns requisite IDs as strings or numbers
    if (typeof requisiteId === 'string' && requisiteId !== 'val') {
      requisiteId = parseInt(requisiteId, 10)
    }

    if (!requisiteId || isNaN(requisiteId)) {
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не найден ID реквизита для удаления',
        life: 5000
      })
      return
    }

    try {
      // FIRST: Delete requisite via API
      // Legacy uses: intApi('POST','_d_del_req/'+colId(this)+'?JSON','reload')
      console.log('[handleHeaderAction] Calling deleteRequisite API with ID:', requisiteId, 'typeof:', typeof requisiteId)
      const result = await integramApiClient.deleteRequisite(requisiteId, true) // forced=true to delete even with data
      console.log('[handleHeaderAction] API response:', result)

      // Check for API error response
      // Backend returns errors as: [{"error":"message"}] or {"error":"message"}
      const errorMsg = Array.isArray(result)
        ? result[0]?.error
        : result?.error || result?.failed

      if (errorMsg) {
        throw new Error(errorMsg)
      }

      // ONLY AFTER successful API call: Update UI reactively
      const headerIndex = headers.value.findIndex(h => h.id === headerId)
      if (headerIndex !== -1) {
        const deletedHeader = headers.value[headerIndex]
        headers.value.splice(headerIndex, 1)

        toast.add({
          severity: 'success',
          summary: 'Колонка удалена',
          detail: deletedHeader.value || `Колонка #${requisiteId}`,
          life: 3000
        })
      }

      // Remove column data from rows
      rows.value.forEach(row => {
        if (row.values) {
          const cellIndex = row.values.findIndex(v => v.headerId === headerId)
          if (cellIndex !== -1) {
            row.values.splice(cellIndex, 1)
          }
        }
      })
    } catch (err) {
      console.error('[handleHeaderAction] Delete API error:', err)
      toast.add({
        severity: 'error',
        summary: 'Ошибка удаления',
        detail: err.message || 'Не удалось удалить колонку через API',
        life: 5000
      })
    }
  }
}

// ===== Column Conversion: Text ↔ Reference =====
// Issue #6791: Convert text column to reference (dir) and back

const showConvertToRefDialog = ref(false)
const showConvertToTextDialog = ref(false)
const convertColumnHeader = ref(null)
const convertNewTableName = ref('')
const convertUniqueValues = ref([])
const convertProgress = ref(0)
const convertIsProcessing = ref(false)

/**
 * Convert text column to reference (справочник)
 * Creates new table with unique values and converts column to reference type
 */
async function convertTextToReference(headerId, newTableName) {
  convertIsProcessing.value = true
  convertProgress.value = 0

  try {
    const header = headers.value.find(h => h.id === headerId)
    if (!header) {
      throw new Error('Колонка не найдена')
    }

    const requisiteId = header.termId
    if (!requisiteId || requisiteId === 'val') {
      throw new Error('Невозможно конвертировать главную колонку')
    }

    // Step 1: Collect unique values (10%)
    toast.add({
      severity: 'info',
      summary: 'Сбор данных',
      detail: 'Собираем уникальные значения...',
      life: 3000
    })

    const uniqueValues = new Set()
    rows.value.forEach(row => {
      const cell = row.values?.find(v => v.headerId === headerId)
      if (cell?.value && typeof cell.value === 'string' && cell.value.trim()) {
        uniqueValues.add(cell.value.trim())
      }
    })

    const uniqueArray = Array.from(uniqueValues)
    if (uniqueArray.length === 0) {
      throw new Error('Нет данных для конвертации')
    }

    convertProgress.value = 10

    // Step 2: Create new table (20%)
    toast.add({
      severity: 'info',
      summary: 'Создание справочника',
      detail: `Создаём таблицу "${newTableName}"...`,
      life: 3000
    })

    const newTypeResult = await integramApiClient.createType(newTableName, 3) // baseType 3 = SHORT
    const newTypeId = newTypeResult.id

    if (!newTypeId) {
      throw new Error('Не удалось создать новую таблицу')
    }

    convertProgress.value = 20

    // Step 3: Create objects in new table and build mapping (20% → 60%)
    toast.add({
      severity: 'info',
      summary: 'Заполнение справочника',
      detail: `Создаём ${uniqueArray.length} записей...`,
      life: 3000
    })

    const valueToId = {}
    const step = 40 / uniqueArray.length

    for (let i = 0; i < uniqueArray.length; i++) {
      const val = uniqueArray[i]
      const obj = await integramApiClient.createObject(newTypeId, val)
      valueToId[val] = obj.id
      convertProgress.value = 20 + (i + 1) * step
    }

    // Step 4: Change column type to reference (70%)
    toast.add({
      severity: 'info',
      summary: 'Изменение типа колонки',
      detail: 'Меняем тип на справочник...',
      life: 3000
    })

    await integramApiClient.changeRequisiteType(requisiteId, newTypeId)
    convertProgress.value = 70

    // Step 5: Update all rows (70% → 95%)
    toast.add({
      severity: 'info',
      summary: 'Обновление данных',
      detail: `Обновляем ${rows.value.length} строк...`,
      life: 3000
    })

    const rowStep = 25 / rows.value.length

    for (let i = 0; i < rows.value.length; i++) {
      const row = rows.value[i]
      const cell = row.values?.find(v => v.headerId === headerId)
      const textVal = cell?.value

      if (textVal && typeof textVal === 'string' && valueToId[textVal.trim()]) {
        await integramApiClient.setObjectRequisites(row.id, {
          [requisiteId]: valueToId[textVal.trim()]
        })
      }

      convertProgress.value = 70 + (i + 1) * rowStep
    }

    convertProgress.value = 100

    toast.add({
      severity: 'success',
      summary: 'Конвертация завершена',
      detail: `Создана таблица "${newTableName}" с ${uniqueArray.length} значениями`,
      life: 5000
    })

    // Reload table data
    await loadData(1)

  } catch (err) {
    console.error('[convertTextToReference] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка конвертации',
      detail: err.message || 'Не удалось конвертировать колонку',
      life: 5000
    })
  } finally {
    convertIsProcessing.value = false
    convertProgress.value = 0
    showConvertToRefDialog.value = false
  }
}

/**
 * Convert reference column to text (flatten)
 * Replaces reference IDs with text values from referenced table
 */
async function convertReferenceToText(headerId) {
  convertIsProcessing.value = true
  convertProgress.value = 0

  try {
    const header = headers.value.find(h => h.id === headerId)
    if (!header) {
      throw new Error('Колонка не найдена')
    }

    const requisiteId = header.termId
    if (!requisiteId || requisiteId === 'val') {
      throw new Error('Невозможно конвертировать главную колонку')
    }

    if (!header.refType) {
      throw new Error('Это не колонка-справочник')
    }

    // Step 1: Fetch all reference values and build mapping (30%)
    toast.add({
      severity: 'info',
      summary: 'Загрузка справочника',
      detail: 'Читаем значения из таблицы-справочника...',
      life: 3000
    })

    const refObjects = await integramApiClient.getObjectList(header.refType, { LIMIT: 10000 })
    const idToValue = {}

    refObjects.forEach(obj => {
      idToValue[obj.id] = obj.val || String(obj.id)
    })

    convertProgress.value = 30

    // Step 2: Change column type to text (50%)
    toast.add({
      severity: 'info',
      summary: 'Изменение типа колонки',
      detail: 'Меняем тип на текст...',
      life: 3000
    })

    await integramApiClient.changeRequisiteType(requisiteId, 3) // 3 = SHORT (text)
    convertProgress.value = 50

    // Step 3: Update all rows with text values (50% → 95%)
    toast.add({
      severity: 'info',
      summary: 'Обновление данных',
      detail: `Обновляем ${rows.value.length} строк...`,
      life: 3000
    })

    const rowStep = 45 / rows.value.length

    for (let i = 0; i < rows.value.length; i++) {
      const row = rows.value[i]
      const cell = row.values?.find(v => v.headerId === headerId)
      const refId = cell?.value

      if (refId && idToValue[refId]) {
        await integramApiClient.setObjectRequisites(row.id, {
          [requisiteId]: idToValue[refId]
        })
      }

      convertProgress.value = 50 + (i + 1) * rowStep
    }

    convertProgress.value = 100

    toast.add({
      severity: 'success',
      summary: 'Конвертация завершена',
      detail: 'Колонка преобразована в текст',
      life: 5000
    })

    // Reload table data
    await loadData(1)

  } catch (err) {
    console.error('[convertReferenceToText] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка конвертации',
      detail: err.message || 'Не удалось конвертировать колонку',
      life: 5000
    })
  } finally {
    convertIsProcessing.value = false
    convertProgress.value = 0
    showConvertToTextDialog.value = false
  }
}

/**
 * Open dialog to convert text to reference
 */
function openConvertToRefDialog(headerId) {
  const header = headers.value.find(h => h.id === headerId)
  if (!header) return

  convertColumnHeader.value = header

  // Collect unique values
  const uniqueValues = new Set()
  rows.value.forEach(row => {
    const cell = row.values?.find(v => v.headerId === headerId)
    if (cell?.value && typeof cell.value === 'string' && cell.value.trim()) {
      uniqueValues.add(cell.value.trim())
    }
  })

  convertUniqueValues.value = Array.from(uniqueValues)
  convertNewTableName.value = header.value || 'Справочник'
  showConvertToRefDialog.value = true
}

/**
 * Open dialog to convert reference to text
 */
function openConvertToTextDialog(headerId) {
  const header = headers.value.find(h => h.id === headerId)
  if (!header) return

  convertColumnHeader.value = header
  showConvertToTextDialog.value = true
}

/**
 * Handle file upload for FILE (10) and PATH (17) column types
 * Uploads file to server and updates the cell value
 * @param {string} rowId - Object ID (row)
 * @param {string} headerId - Header ID (column in DataTable)
 * @param {string} termId - Requisite ID in database (for _m_save API)
 * @param {number} baseType - Base type (10=FILE, 17=PATH)
 * @param {File} file - File to upload
 * @param {Function} callback - Callback with result
 */
async function handleUploadFile({ rowId, headerId, termId, baseType, file, callback }) {
  try {
    toast.add({
      severity: 'info',
      summary: 'Загрузка файла',
      detail: `Загружаем ${file.name}...`,
      life: 2000
    })

    // Upload file using integramApiClient
    // termId is the requisite ID used in _m_save/{objectId} with key t{termId}
    const result = await integramApiClient.uploadRequisiteFile(rowId, termId, file)

    // Get updated object data from server to retrieve actual file path
    // This is more reliable than using file.name as server may generate different path
    let updatedValue = file.name
    try {
      const objectData = await integramApiClient.getObjectEditData(rowId)
      if (objectData?.reqs?.[termId]) {
        const reqData = objectData.reqs[termId]
        // Server returns value in different formats depending on type
        updatedValue = reqData.value || reqData || file.name
      }
    } catch (fetchErr) {
      console.warn('[handleUploadFile] Could not fetch updated value, using filename:', fetchErr)
    }

    // Reactively update local row data without full page reload
    // DataTable uses rows.values array where each item has { headerId, value, type }
    const rowIndex = rows.value.findIndex(r => r.id === rowId)
    if (rowIndex !== -1) {
      const row = rows.value[rowIndex]
      // Find the cell in values array by headerId
      const cellIndex = row.values?.findIndex(v => v.headerId === headerId)
      if (cellIndex !== -1 && cellIndex !== undefined) {
        // Update value reactively
        rows.value[rowIndex].values[cellIndex].value = updatedValue
      } else if (row.values) {
        // Cell doesn't exist yet - add it
        rows.value[rowIndex].values.push({
          headerId: headerId,
          value: updatedValue,
          type: 10 // FILE type
        })
      }
    }

    toast.add({
      severity: 'success',
      summary: 'Файл загружен',
      detail: file.name,
      life: 3000
    })

    // Call callback with success
    if (callback) {
      callback({ success: true, filename: updatedValue, result })
    }

    // No loadData() - reactive update is sufficient
  } catch (err) {
    console.error('[handleUploadFile] Error:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: err.message || 'Не удалось загрузить файл',
      life: 5000
    })

    if (callback) {
      callback({ success: false, error: err.message })
    }
  }
}

// Issue #5005: ESC key handler for canceling cell edit
const handleGlobalEsc = (event) => {
  if (event.key === 'Escape') {
    // Check if DataTable is actually in edit mode using the exposed method
    if (dataTableRef.value?.isEditing && dataTableRef.value.isEditing()) {
      console.log('[IntegramDataTableWrapper] ESC pressed - canceling cell edit')
      dataTableRef.value.cancelCellEdit()
      // Stop propagation to prevent ESC from being handled elsewhere
      event.stopPropagation()
      event.preventDefault()
    }
  }
}

// Lifecycle — manage global event listeners for both regular and KeepAlive usage.
// With KeepAlive, onMounted/onUnmounted fire once; onActivated/onDeactivated fire on each show/hide.
function addGlobalListeners() {
  document.addEventListener('keydown', handleGlobalEsc)
  document.addEventListener('keydown', handleSearchNavigation)
}

function removeGlobalListeners() {
  document.removeEventListener('keydown', handleGlobalEsc)
  document.removeEventListener('keydown', handleSearchNavigation)
}

// Watch global selector state and reload data when selector value changes
if (props.selectorName) {
  watch(
    () => selectorState.selectors[props.selectorName],
    (newVal, oldVal) => {
      if (newVal !== oldVal) {
        console.log(`[SelectorWatch] Selector "${props.selectorName}" changed: ${oldVal} → ${newVal}`)
        loadData(1)
      }
    }
  )
}

// Issue #6769: Watch selectorState for filter conditions using valueSource='selector'
// or for auto-detected selector binding
watch(
  () => ({ ...selectorState.selectors }),
  () => {
    const hasSelectorConditions = filterConditions.value.some(c => c.valueSource === 'selector' && c.selectorName)
    if (hasSelectorConditions) {
      console.log('[SelectorConditionWatch] selectorState changed, reloading for selector-based conditions')
      currentPage.value = 1
      loadData()
      return
    }
    // Auto-detected selector: reload if autoSelectorName is already known
    if (autoSelectorName.value) {
      console.log(`[AutoSelectorWatch] selectorState changed, reloading for auto-detected selector "${autoSelectorName.value}"`)
      currentPage.value = 1
      loadData()
    }
  },
  { deep: true }
)

onMounted(async () => {
  addGlobalListeners()

  // Initialize block metadata cache from all initial* props
  blockMetadataCache.value = {}
  if (props.initialFilterConditions) blockMetadataCache.value.filterConditions = props.initialFilterConditions
  if (props.initialSelectedColumns) blockMetadataCache.value.selectedColumns = props.initialSelectedColumns
  if (props.initialColumnWidths) blockMetadataCache.value.columnWidths = props.initialColumnWidths
  if (props.initialColumnOrder) blockMetadataCache.value.columnOrder = props.initialColumnOrder
  if (props.initialVirtualColumns) blockMetadataCache.value.virtualColumns = props.initialVirtualColumns

  // Initialize virtual columns from block metadata props
  if (props.initialVirtualColumns && props.initialVirtualColumns.length > 0) {
    virtualColumns.value = props.initialVirtualColumns
  }
  // Initialize column order from block metadata props
  if (props.initialColumnOrder && props.initialColumnOrder.length > 0) {
    columnOrder.value = props.initialColumnOrder
  }

  // Загрузить сохранённые условия фильтра и видимость колонок из DB metadata или localStorage
  loadFilterConditions()
  loadColumnVisibility()
  loadTextWrapSetting()

  // Issue #6514, #6583: Auto-authenticate for kval database in embedded mode
  // The backend kval-proxy handles server-side auth — get session via GET
  // ALWAYS run for kval in embedded mode, regardless of isAuthenticated state,
  // because a previous session may have a different server (e.g. dronedoc.ru)
  // which causes CORS errors when making direct requests from dev.drondoc.ru.
  // We route ALL kval requests through the same-origin kval-proxy to avoid CORS.
  if (props.embedded && database.value === 'kval') {
    try {
      const apiBase = '/api'
      const resp = await fetch(`${apiBase}/kval-proxy/auth`).then(r => r.json()).then(data => ({ data }))
      if (resp.data?.token) {
        // Use proxyPath to route all kval requests through the backend proxy
        // This avoids CORS by keeping requests same-origin (dev.drondoc.ru → dev.drondoc.ru/api/kval-proxy/*)
        integramApiClient.proxyPath = `${apiBase}/kval-proxy`
        integramApiClient.setDatabase('kval')
        integramApiClient.databases = integramApiClient.databases || {}
        // resp.data.id is the system proxy user ID (e.g. 1009 for 'd').
        // Resolve the real kval user object for the current user by login name.
        // Read login from multiple sources: singleton state, databases map, and localStorage
        // (sub-app created via createApp() may have different instance state timing)
        const _sessionLoginFromLS = (() => {
          try { return JSON.parse(localStorage.getItem('integram_session') || '{}')?.databases?.my?.userName } catch { return null }
        })()
        const _lsUserDirect = localStorage.getItem('integram_user') || localStorage.getItem('user_name') || localStorage.getItem('login')
        const currentUserLogin = integramApiClient.databases?.['my']?.userName || integramApiClient.userName || _sessionLoginFromLS || _lsUserDirect
        let resolvedKvalUserId = resp.data.id
        console.log('[IntegramDataTableWrapper] kval auto-auth: login=', currentUserLogin, 'systemId=', resp.data.id, 'userName=', integramApiClient.userName, 'my.userName=', integramApiClient.databases?.['my']?.userName, 'ls.userName=', _sessionLoginFromLS)
        if (currentUserLogin) {
          try {
            const userSearchResp = await fetch(
              `${apiBase}/kval-proxy/object/18?JSON_KV=&F_U=1&F_18=${encodeURIComponent(currentUserLogin)}&LIMIT=10`,
              { headers: { 'X-Authorization': resp.data.token } }
            ).then(r => r.json())
            console.log('[IntegramDataTableWrapper] kval user search response:', JSON.stringify(userSearchResp?.object?.slice(0,3)))
            const matchUser = (userSearchResp?.object || []).find(u => u.val === currentUserLogin)
            if (matchUser) {
              resolvedKvalUserId = matchUser.id
              console.log('[IntegramDataTableWrapper] Resolved kval userId:', resolvedKvalUserId, 'for login:', currentUserLogin)
            } else {
              console.warn('[IntegramDataTableWrapper] User not found in kval type 18 for login:', currentUserLogin, 'objects:', userSearchResp?.object?.map(u => u.val))
            }
          } catch (e) {
            console.warn('[IntegramDataTableWrapper] kval user search failed:', e.message)
          }
        }
        integramApiClient.databases['kval'] = {
          token: resp.data.token,
          xsrfToken: resp.data._xsrf,
          userId: resolvedKvalUserId,
          userName: currentUserLogin || 'd',
          userRole: 'admin',
          ownedDatabases: []
        }
        integramApiClient.token = resp.data.token
        integramApiClient.xsrfToken = resp.data._xsrf
        integramApiClient.userId = resolvedKvalUserId
        kvalAutoAuthed.value = true
        console.log('[IntegramDataTableWrapper] Auto-authenticated with kval via proxy, proxyPath:', integramApiClient.proxyPath)
        await loadData()
        return
      }
    } catch (err) {
      console.warn('[IntegramDataTableWrapper] Kval auto-auth failed:', err.message)
    }
  }

  console.log('[IntegramDataTableWrapper] onMounted: embedded=', props.embedded, 'db=', database.value, 'isAuthenticated=', isAuthenticated.value, 'kvalAutoAuthed=', kvalAutoAuthed.value, 'token?=', !!integramApiClient.token, 'userName=', integramApiClient.userName)
  if (!isAuthenticated.value) {
    router?.replace('/integram/login')
    return
  }

  // Issue #6604/#6627: Obtain a valid token and resolve real user object ID via switchDatabase().
  // Needed for kval too: session.id from /auth or /xsrf (e.g. 1009) differs from the actual
  // user object in type 18 (e.g. 1292598). switchDatabase resolves the correct userId via
  // resolveUserObjectId so __current_user__ filter works correctly.
  const dbVal = database.value?.toLowerCase()
  if (database.value && dbVal !== 'my' && dbVal !== 'a2025') {
    // Issue #6967: Clear cached kval session so switchDatabase always calls the backend.
    // The backend retry-after-newDb logic ensures the real user's token is returned
    // instead of the system user's token from a previous cookie exchange.
    if (dbVal === 'kval' && integramApiClient.databases?.['kval']) {
      delete integramApiClient.databases['kval']
    }
    try {
      await integramApiClient.switchDatabase(database.value)
    } catch (err) {
      console.warn('[IntegramDataTableWrapper] switchDatabase failed for db:', database.value, err.message)
      // Continue anyway — may succeed with my_token fallback already set
    }

    // Issue #6967: After switchDatabase for kval, the userId may be the system proxy user
    // (e.g. 1009 for 'd') instead of the real user (e.g. 1346286 for 'korshunov').
    // This happens when switch-db cookie exchange authenticates as the DB system user.
    // Resolve the real user's kval object ID by searching type 18 with their login name.
    // IMPORTANT: Use kval-proxy (same-origin) to avoid CORS errors — direct requests to
    // ai2o.ru from dev.drondoc.ru are blocked by the browser.
    if (dbVal === 'kval') {
      const _lsLogin = (() => {
        try { return JSON.parse(localStorage.getItem('integram_session') || '{}')?.databases?.my?.userName } catch { return null }
      })()
      const _lsUser = localStorage.getItem('integram_user') || localStorage.getItem('user_name') || localStorage.getItem('login')
      const realLogin = integramApiClient.databases?.['my']?.userName || integramApiClient.userName || _lsLogin || _lsUser
      console.log('[IntegramDataTableWrapper] kval userId check: realLogin=', realLogin, 'currentUserId=', integramApiClient.userId, 'sources:', { dbMy: integramApiClient.databases?.['my']?.userName, userName: integramApiClient.userName, lsSession: _lsLogin, lsUser: _lsUser })
      if (realLogin) {
        try {
          const kvalToken = integramApiClient.databases?.['kval']?.token || integramApiClient.token
          const userSearchResp = await fetch(
            `/api/kval-proxy/object/18?JSON_KV=&F_U=1&F_18=${encodeURIComponent(realLogin)}&LIMIT=10`,
            { headers: kvalToken ? { 'X-Authorization': kvalToken } : {} }
          ).then(r => r.json())
          const matchUser = (userSearchResp?.object || []).find(u => u.val === realLogin)
          if (matchUser && String(matchUser.id) !== String(integramApiClient.userId)) {
            console.log(`[IntegramDataTableWrapper] Corrected kval userId: ${integramApiClient.userId} → ${matchUser.id} for login: ${realLogin}`)
            integramApiClient.userId = matchUser.id
            if (integramApiClient.databases['kval']) {
              integramApiClient.databases['kval'].userId = matchUser.id
            }
          }
        } catch (e) {
          console.warn('[IntegramDataTableWrapper] kval userId resolution failed:', e.message)
        }
      }
    }
  }

  await loadData()

  // Issue #6742: Subscribe to WS sync channel for this table
  if (database.value && typeId.value) {
    integramSync.subscribe([{ database: database.value, typeId: String(typeId.value) }])
  }

  // Issue #6742: Listen to local EventBus so table updates immediately when
  // another component (e.g. kanban) saves an object on the same page.
  integramEventBus.on('object:updated', _handleExternalObjectUpdated)
  integramEventBus.on('object:created', _handleExternalObjectCreated)
  integramEventBus.on('object:deleted', _handleExternalObjectDeleted)
})

// KeepAlive lifecycle: re-add listeners when component becomes visible again
onActivated(() => {
  addGlobalListeners()
})

// KeepAlive lifecycle: remove listeners when component is hidden (another tab selected)
onDeactivated(() => {
  removeGlobalListeners()
})

// Watch for typeId changes (from route or prop).
// When used inside KeepAlive (tab scenario), typeId comes from props and stays stable.
// This watcher mainly handles standalone usage where typeId might change via route params.
watch(typeId, async (newTypeId, oldTypeId) => {
  if (newTypeId && newTypeId !== oldTypeId) {
    currentPage.value = 1
    rows.value = []
    allRows.value = []
    totalCount.value = 0
    await loadData()
  }
})

// Фильтрация теперь применяется только по кнопке "Применить" (applyFilter)
// Watcher удалён чтобы избежать XHR запросов при каждом вводе символа в инпут

// Issue #6742: Handle external object updates (from kanban or other tabs/pages)
function _handleExternalObjectUpdated({ database: db, typeId: tId, objectId, requisites, displayLabels }) {
  // Only process events for this table
  if (db !== database.value || String(tId) !== String(typeId.value)) return

  // Update a row in the given array (rows or allRows)
  function _patchRow(arr) {
    const rowIndex = arr.findIndex(r => String(r.id) === String(objectId))
    if (rowIndex === -1) return
    for (const [reqId, val] of Object.entries(requisites || {})) {
      const headerId = reqId === 'val' ? 'val' : `req_${reqId}`
      const cell = arr[rowIndex].values.find(v => v.headerId === headerId)
      if (!cell) continue
      const header = headers.value.find(h => h.id === headerId)
      if (header?.dirTableId) {
        // Reference field: val is objectId; update dirRowId and text from displayLabels
        cell.dirRowId = parseInt(val) || null
        if (displayLabels?.[reqId] !== undefined) {
          cell.value = displayLabels[reqId]
        } else {
          // Fallback: look for the label in another row with same dirRowId
          const newId = parseInt(val)
          if (newId) {
            const sameRef = arr.find((r, i) => {
              if (i === rowIndex) return false
              const c = r.values.find(v => v.headerId === headerId)
              return c && c.dirRowId === newId && c.value
            })
            if (sameRef) {
              cell.value = sameRef.values.find(v => v.headerId === headerId).value
            }
          }
        }
      } else {
        cell.value = val != null ? String(val) : ''
      }
    }
  }

  // filteredRows shows allRows when allDataLoaded, otherwise rows — update both
  _patchRow(rows.value)
  if (allRows.value.length > 0) _patchRow(allRows.value)
  // Force Vue to re-evaluate computed properties that depend on rows/allRows.
  // In-place cell mutations don't always invalidate higher-level computeds
  // (filteredRows/paginatedRows), so we trigger them explicitly to ensure
  // the DataTable re-renders with the updated cell values.
  triggerRef(rows)
  if (allRows.value.length > 0) triggerRef(allRows)
}

// Handle row creation in another component showing the same table
function _handleExternalObjectCreated({ database: db, typeId: tId, _sourceId }) {
  if (db !== database.value || String(tId) !== String(typeId.value)) return
  if (_sourceId === _componentId) return // skip own optimistic-insert events
  loadData()
}

// Handle row deletion in another component showing the same table
function _handleExternalObjectDeleted({ database: db, typeId: tId, objectId }) {
  if (db !== database.value || String(tId) !== String(typeId.value)) return
  function _removeRow(arr) {
    const idx = arr.findIndex(r => String(r.id) === String(objectId))
    if (idx !== -1) arr.splice(idx, 1)
  }
  _removeRow(rows.value)
  if (allRows.value.length > 0) _removeRow(allRows.value)
  triggerRef(rows)
  if (allRows.value.length > 0) triggerRef(allRows)
}

// Cleanup on unmount
// Update topbar breadcrumb when table name loads (only for non-embedded, standalone views)
watch(typeData, (val) => {
  if (!props.embedded && val?.val) {
    setExtra([{ label: val.val, icon: 'pi pi-bars' }])
  }
})

onUnmounted(() => {
  // Clear topbar extra breadcrumb when leaving table view
  if (!props.embedded) clearExtra()

  removeGlobalListeners()

  // Issue #6742: Remove EventBus listeners
  integramEventBus.off('object:updated', _handleExternalObjectUpdated)
  integramEventBus.off('object:created', _handleExternalObjectCreated)
  integramEventBus.off('object:deleted', _handleExternalObjectDeleted)

  // Issue #6583: Clear proxy mode so other components use normal URL builder
  if (integramApiClient.proxyPath) {
    integramApiClient.proxyPath = null
  }

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }

  // Clean up directory loading interval (prevents phantom API calls after unmount)
  if (dirLoadProgressInterval) {
    clearInterval(dirLoadProgressInterval)
    dirLoadProgressInterval = null
  }

  // Abort any in-progress background loading
  if (isBackgroundLoading.value) {
    backgroundLoadingAborted.value = true
    isBackgroundLoading.value = false
  }

  // Release large data arrays to allow GC
  allRows.value = []
  rows.value = []
})
</script>

<style scoped>
.integram-datatable-wrapper {
  padding: 0 1rem 1rem 1rem;
  overflow: visible; /* allow row-left-actions to extend beyond table left boundary */
}

.breadcrumb-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breadcrumb-row-crumb {
  flex: 1;
  min-width: 0;
}

.table-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  overflow: hidden;
}

.table-header-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

.button-active {
  background-color: var(--primary-color) !important;
  color: var(--primary-color-text) !important;
}

/* Header styles */
.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.records-badge {
  background-color: var(--surface-hover);
  color: var(--text-color-secondary);
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  vertical-align: super;
  margin-top: -0.5rem;
}

.header-search {
  width: 180px;
  min-width: 120px;
  max-width: 180px;
  flex-shrink: 1;
}

.header-search :deep(.p-inputtext) {
  width: 100% !important;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  font-size: 0.875rem;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--surface-border);
  margin: 0 4px;
}

/* Responsive header */
@media screen and (max-width: 768px) {
  .header-search {
    width: 150px;
  }

  .table-title {
    font-size: 1rem;
  }
}

@media screen and (max-width: 576px) {
  .header-search {
    display: none;
  }
}

:deep(.coda-style-datatable) {
  max-height: calc(100vh - 250px) !important;
  min-height: 400px;
  overflow: auto;
}

:deep(.coda-style-datatable .table-container) {
  max-height: calc(100vh - 280px) !important;
  min-height: 350px;
  overflow: auto;
}

/* Embedded mode: fixed height = 20 standard rows (720px) + toolbar
   Issue #6805: Each embedded table/cards block has fixed height = 20 × 36px = 720px for data area.
   Content scrolls inside the block via overflow-y: auto. */
.embedded-mode :deep(.coda-style-datatable) {
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible;
}

.embedded-mode :deep(.coda-style-datatable .table-container) {
  height: 720px !important;  /* BLOCK_DATA_HEIGHT = 20 × 36px */
  max-height: 720px !important;
  min-height: 720px !important;
  overflow-x: auto;
  overflow-y: auto;  /* Scroll inside block instead of expanding */
}

/* Embedded paginator */
.embedded-paginator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  font-size: 0.85rem;
  color: var(--text-color-secondary, #6b7280);
}

.embedded-paginator-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 6px;
  background: transparent;
  color: var(--text-color, #37352f);
  cursor: pointer;
  transition: background 0.15s;
}

.embedded-paginator-btn:hover:not(:disabled) {
  background: var(--surface-hover, #f3f4f6);
}

.embedded-paginator-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.embedded-paginator-info {
  font-weight: 500;
}

.embedded-paginator-total {
  opacity: 0.6;
  margin-left: 0.25rem;
}

/* Filter dialog styles - Integram style */
.filter-empty-state {
  text-align: center;
  padding: 2rem 1rem;
}

.filter-conditions-list {
  max-height: 60vh;
  overflow-y: auto;
}

.filter-condition-item {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.filter-condition-item:last-child {
  margin-bottom: 0;
}

.condition-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.condition-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.condition-fields {
  /* Container for fields */
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

/* Add column type vertical list */
.add-column-type-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}

.add-column-type-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
  font-size: 0.9rem;
  color: var(--text-color);
}

.add-column-type-item:hover {
  background: var(--surface-hover);
}

.add-column-type-item.selected {
  background: var(--primary-50, #ede9fe);
  color: var(--primary-color);
  font-weight: 600;
}

.add-column-type-icon {
  font-size: 1rem;
  width: 1.4rem;
  text-align: center;
  flex-shrink: 0;
}

.add-column-type-label {
  flex: 1;
}

.add-column-type-empty {
  padding: 8px 12px;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

/* Nested table dialog styles */
.nested-table-dialog :deep(.p-dialog-content) {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  overflow: hidden;
}

.nested-table-content {
  min-height: 300px;
  max-height: 60vh;
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nested-table-content :deep(.integram-datatable-wrapper) {
  padding: 0;
}

.nested-table-content :deep(.p-card) {
  box-shadow: none;
  border: none;
}

.nested-table-content :deep(.p-card-body) {
  padding: 0;
}

.nested-table-content :deep(.coda-style-datatable) {
  max-height: 50vh !important;
  min-height: 200px;
  overflow: auto !important;
}

.nested-table-content :deep(.p-datatable-wrapper) {
  overflow: auto !important;
  max-height: 50vh !important;
}

.nested-table-content :deep(.integram-datatable-wrapper) {
  overflow: auto !important;
  max-height: 100% !important;
  flex: 1;
}

/* Background loading overlay - fixed at bottom of screen */
.bg-loading-overlay {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: auto;
  max-width: 500px;
  min-width: 350px;
}

.bg-loading-indicator {
  background: var(--p-surface-0);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.bg-loading-indicator .pi-spinner {
  color: var(--p-primary-color);
  font-size: 1.25rem;
}

.bg-loading-indicator .font-medium {
  font-weight: 500;
  color: var(--p-text-color);
}

.bg-loading-indicator .text-sm {
  font-size: 0.875rem;
  color: var(--p-text-color-secondary);
}

/* Slide up animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
}

/* Row Density (Phase 2 - Feature Roadmap) */
.row-density-compact :deep(tr) {
  height: 24px !important;
}

.row-density-compact :deep(td),
.row-density-compact :deep(th) {
  padding: 2px 8px !important;
  font-size: 0.875rem;
}

.row-density-comfortable :deep(tr) {
  height: 32px !important;
}

.row-density-comfortable :deep(td),
.row-density-comfortable :deep(th) {
  padding: 4px 12px !important;
}

.row-density-spacious :deep(tr) {
  height: 48px !important;
}

.row-density-spacious :deep(td),
.row-density-spacious :deep(th) {
  padding: 8px 16px !important;
  font-size: 1rem;
}

/* Search with Navigation (Phase 2) */
.search-with-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-navigation-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.5rem;
  background: var(--surface-card);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.search-counter {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  padding: 0 0.5rem;
}

/* Help Dialog Styles */
.help-content {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.help-section {
  margin-bottom: 1.5rem;
}

.help-section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.help-section-header i {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.help-section-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.help-info-block {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
}

.help-info-block h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.help-info-block p {
  margin: 0;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.help-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
  color: var(--text-color-secondary);
  line-height: 1.8;
}

.help-list li {
  margin-bottom: 0.25rem;
}

.help-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.help-card {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s ease;
}

.help-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.help-card-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.help-card-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.help-card-desc {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.help-toolbar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.help-toolbar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.help-toolbar-item i {
  color: var(--primary-color);
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.help-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.help-shortcut {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
}

.help-shortcut kbd {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  background: var(--surface-hover);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.help-shortcut span {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.help-card-desc kbd {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  background: var(--surface-hover);
  border: 1px solid var(--surface-border);
  border-radius: 3px;
}

/* Help Dialog customization */
:deep(.help-dialog .p-dialog-content) {
  padding: 1.5rem;
}

/* Settings Dialog Styles */
:deep(.settings-dialog .p-dialog-content) {
  padding: 1.5rem;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1.25rem;
}

.settings-section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.settings-section-header i {
  color: var(--primary-color);
  font-size: 1.1rem;
}

.settings-section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.settings-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.settings-option-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.settings-option-label {
  font-weight: 500;
  color: var(--text-color);
  cursor: pointer;
}

.settings-option-desc {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
}

.settings-info-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-radius: 6px;
  margin-top: 0.5rem;
}

.settings-info-note i {
  color: var(--blue-500);
  font-size: 0.9rem;
}

.settings-info-note span {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

/* Date Style Selection Grid */
.date-style-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.date-style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--surface-ground);
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.date-style-card:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.date-style-card.active {
  border-color: var(--primary-color);
  background: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.date-style-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  font-size: 0.9rem;
  color: var(--text-color);
}

.date-style-preview .date-dir-preview {
  display: inline-block;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  color: var(--text-color);
  padding: 3px 10px;
  border-radius: 12px;
  text-align: center;
  font-weight: normal;
  white-space: nowrap;
  font-size: 0.85rem;
}

.date-style-preview .date-dir-preview.today {
  background: linear-gradient(135deg, var(--green-50) 0%, var(--green-100) 100%);
  border-color: var(--green-200);
  color: var(--green-700);
}

.date-style-preview .date-nested-preview {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  background: linear-gradient(135deg, var(--p-green-50, var(--green-50)) 0%, var(--p-green-100, var(--green-100)) 100%);
  border: 1px solid var(--p-green-200, var(--green-200));
  color: var(--p-green-700, var(--green-700));
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: normal;
}

.date-style-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-color);
}

.date-style-desc {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-align: center;
  line-height: 1.3;
}

@media (max-width: 480px) {
  .date-style-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Compact Nested Card ─────────────────────────────────── */
.nested-card-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.nested-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
  max-height: 400px;
  overflow: hidden;
}

.nested-card-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

/* Issue #6651: Subordinate cards scrolling — single scroll context on the list */
.nested-card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.nested-card-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  min-height: 32px;
}
.nested-card-item:hover {
  background: var(--surface-hover);
}
.nested-card-item.editing {
  background: var(--surface-ground);
}

.nested-card-rec-val {
  flex: 1;
  font-size: 0.875rem;
  cursor: text;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nested-card-item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.nested-card-item:hover .nested-card-item-actions {
  opacity: 1;
}

.nested-card-edit-input {
  flex: 1;
  font-size: 0.875rem;
}

.nested-card-edit-actions {
  display: flex;
  gap: 2px;
}

.nca-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background 0.15s;
}
.nca-btn.ok {
  background: var(--p-green-100, var(--green-100));
  color: var(--p-green-700, var(--green-700));
}
.nca-btn.ok:hover {
  background: var(--p-green-200, var(--green-200));
}
.nca-btn.cancel {
  background: var(--surface-hover);
  color: var(--text-color-secondary);
}
.nca-btn.cancel:hover {
  background: var(--surface-300);
}
.nca-btn.edit {
  background: transparent;
  color: var(--text-color-secondary);
}
.nca-btn.edit:hover {
  background: var(--surface-hover);
  color: var(--text-color);
}
.nca-btn.del {
  background: transparent;
  color: var(--p-red-400, var(--red-400));
}
.nca-btn.del:hover {
  background: var(--p-red-50, var(--red-50));
}

.nested-card-add {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--surface-border);
}

.nested-card-add-input {
  flex: 1;
  font-size: 0.875rem;
}

/* =====================================================
   DARK THEME OVERRIDES
   ===================================================== */

/* Search navigation controls */
.app-dark .search-navigation-controls {
  background: var(--p-surface-800, #1e293b);
  border-color: var(--p-surface-600, #475569);
}

/* Help shortcut kbd */
.app-dark .help-shortcut kbd,
.app-dark .help-card-desc kbd {
  background: var(--p-surface-700, #334155);
  border-color: var(--p-surface-500, #64748b);
  color: var(--p-surface-200, #e2e8f0);
}

/* Date style preview (in settings dialog) */
.app-dark .date-style-preview .date-dir-preview {
  background: linear-gradient(135deg, var(--p-surface-700, #334155) 0%, var(--p-surface-800, #1e293b) 100%);
  border-color: var(--p-surface-600, #475569);
}

.app-dark .date-style-preview .date-dir-preview.today {
  background: linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.25) 100%);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--p-green-300, #86efac);
}

.app-dark .date-style-preview .date-nested-preview {
  background: linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.25) 100%);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--p-green-300, #86efac);
}

/* Delete button hover in dark */
.app-dark .nca-btn.del:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* Records count badge */
.app-dark .records-badge {
  background-color: var(--p-surface-700, #334155);
  color: var(--p-surface-300, #cbd5e1);
}

/* Background loading indicator */
.app-dark .bg-loading-indicator {
  background: var(--p-surface-800, #1e293b);
  border-color: var(--p-surface-600, #475569);
}

/* Search navigation controls border */
.app-dark .search-navigation-controls {
  border-color: var(--p-surface-600, #475569);
}

/* Nested card action buttons */
.app-dark .nca-btn.ok {
  background: rgba(34, 197, 94, 0.2);
  color: var(--p-green-300, #86efac);
}

.app-dark .nca-btn.ok:hover {
  background: rgba(34, 197, 94, 0.3);
}

.app-dark .nca-btn.cancel {
  background: var(--p-surface-700, #334155);
  color: var(--p-surface-300, #cbd5e1);
}

.app-dark .nca-btn.cancel:hover {
  background: var(--p-surface-600, #475569);
}

.app-dark .nca-btn.edit:hover {
  background: var(--p-surface-700, #334155);
}

/* Nested card add section border */
.app-dark .nested-card-add {
  border-top-color: var(--p-surface-600, #475569);
}
</style>
