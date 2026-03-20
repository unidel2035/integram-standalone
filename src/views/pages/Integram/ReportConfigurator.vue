<template>
  <div class="report-configurator">
    <!-- Breadcrumb -->
    <IntegramBreadcrumb :items="breadcrumbItems" />

    <Card>
      <template #title>
        <div class="flex align-items-center justify-content-between">
          <div class="flex align-items-center gap-2">
            <i class="pi pi-cog text-2xl"></i>
            <span>Конфигуратор умных отчетов</span>
          </div>
          <div class="flex gap-2">
            <Button
              icon="pi pi-book"
              label="Шаблоны"
              outlined
              size="small"
              @click="showTemplatesDialog = true"
              v-tooltip.bottom="'Готовые шаблоны отчетов'"
            />
            <Button
              icon="pi pi-plus"
              label="Создать отчет"
              size="small"
              @click="createNewReport"
            />
          </div>
        </div>
      </template>

      <template #content>
        <!-- Main Layout: Sidebar + Content -->
        <div class="configurator-layout">
          <!-- Left Sidebar: Report List -->
          <div class="configurator-sidebar">
            <div class="sidebar-header mb-3">
              <IconField iconPosition="left" class="w-full">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model="searchQuery"
                  placeholder="Поиск отчетов..."
                  class="w-full"
                />
              </IconField>
            </div>

            <!-- Filter Chips -->
            <div class="flex flex-column gap-2 mb-3">
              <Chip
                :class="{ 'chip-active': activeFilter === 'all' }"
                label="Все отчеты"
                @click="activeFilter = 'all'"
                class="cursor-pointer"
              />
              <Chip
                :class="{ 'chip-active': activeFilter === 'my' }"
                @click="activeFilter = 'my'"
                class="cursor-pointer"
              >
                <i class="pi pi-user mr-2"></i>
                Мои отчеты
              </Chip>
              <Chip
                :class="{ 'chip-active': activeFilter === 'favorites' }"
                @click="activeFilter = 'favorites'"
                class="cursor-pointer"
              >
                <i class="pi pi-star-fill mr-2"></i>
                Избранное
              </Chip>
              <Chip
                :class="{ 'chip-active': activeFilter === 'shared' }"
                @click="activeFilter = 'shared'"
                class="cursor-pointer"
              >
                <i class="pi pi-share-alt mr-2"></i>
                Общие
              </Chip>
            </div>

            <!-- Reports List -->
            <div class="reports-list">
              <div v-if="loadingReports" class="text-center py-4">
                <ProgressSpinner style="width: 30px; height: 30px" />
              </div>

              <div
                v-for="report in filteredReports"
                :key="report.id"
                class="report-item"
                :class="{ 'report-item-active': selectedReport?.id === report.id }"
                @click="selectReport(report)"
              >
                <div class="flex align-items-start justify-content-between">
                  <div class="flex-1">
                    <div class="font-medium mb-1">{{ report.name || 'Безымянный отчет' }}</div>
                    <div class="text-sm text-color-secondary">ID: {{ report.id }}</div>
                    <div v-if="report.description" class="text-sm text-color-secondary mt-1">
                      {{ report.description }}
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <Button
                      icon="pi pi-star"
                      :class="{ 'p-button-warning': report.favorite }"
                      text
                      rounded
                      size="small"
                      @click.stop="toggleFavorite(report)"
                    />
                    <Button
                      icon="pi pi-ellipsis-v"
                      text
                      rounded
                      size="small"
                      @click.stop="showReportMenu($event, report)"
                    />
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="!loadingReports && filteredReports.length === 0" class="text-center py-5">
                <i class="pi pi-inbox text-4xl text-color-secondary mb-2 block"></i>
                <p class="text-color-secondary m-0">Отчеты не найдены</p>
              </div>
            </div>
          </div>

          <!-- Right Content: Configuration Panel -->
          <div class="configurator-content">
            <!-- No Report Selected -->
            <div v-if="!selectedReport" class="empty-state">
              <i class="pi pi-cog text-6xl text-color-secondary mb-3 block"></i>
              <h3 class="m-0 mb-2">Выберите отчет для настройки</h3>
              <p class="text-color-secondary m-0 mb-4">
                Выберите отчет из списка слева или создайте новый
              </p>
              <Button
                label="Создать новый отчет"
                icon="pi pi-plus"
                @click="createNewReport"
              />
            </div>

            <!-- Report Configuration -->
            <div v-else class="report-configuration">
              <!-- Configuration Tabs -->
              <TabView v-model:activeIndex="activeConfigTab">
                <!-- General Settings -->
                <TabPanel header="Основные">
                  <div class="config-section">
                    <div class="form-group mb-4">
                      <label for="reportName" class="form-label">Название отчета *</label>
                      <InputText
                        id="reportName"
                        v-model="selectedReport.name"
                        class="w-full"
                        placeholder="Введите название отчета"
                        @change="markAsModified"
                      />
                    </div>

                    <div class="form-group mb-4">
                      <label for="reportDescription" class="form-label">Описание</label>
                      <Textarea
                        id="reportDescription"
                        v-model="selectedReport.description"
                        rows="3"
                        class="w-full"
                        placeholder="Краткое описание отчета"
                        @change="markAsModified"
                      />
                    </div>

                    <div class="form-group mb-4">
                      <label class="form-label">Категория</label>
                      <Dropdown
                        v-model="selectedReport.category"
                        :options="reportCategories"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Выберите категорию"
                        class="w-full"
                        @change="markAsModified"
                      />
                    </div>

                    <div class="form-group mb-4">
                      <label class="form-label">Теги</label>
                      <Chips
                        v-model="selectedReport.tags"
                        separator=","
                        class="w-full"
                        placeholder="Добавить теги"
                        @add="markAsModified"
                        @remove="markAsModified"
                      />
                    </div>

                    <Divider />

                    <div class="flex gap-3">
                      <div class="field-checkbox">
                        <Checkbox
                          inputId="isPublic"
                          v-model="selectedReport.isPublic"
                          :binary="true"
                          @change="markAsModified"
                        />
                        <label for="isPublic" class="ml-2">Общий доступ</label>
                      </div>
                      <div class="field-checkbox">
                        <Checkbox
                          inputId="isTemplate"
                          v-model="selectedReport.isTemplate"
                          :binary="true"
                          @change="markAsModified"
                        />
                        <label for="isTemplate" class="ml-2">Сохранить как шаблон</label>
                      </div>
                    </div>
                  </div>
                </TabPanel>

                <!-- Query Builder -->
                <TabPanel header="Запрос">
                  <div class="config-section">
                    <!-- Query Mode Toggle -->
                    <div class="flex justify-content-between align-items-center mb-3">
                      <label class="form-label">Режим построения запроса</label>
                      <SelectButton
                        v-model="queryMode"
                        :options="queryModeOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="markAsModified"
                      />
                    </div>

                    <!-- SQL Mode -->
                    <div v-if="queryMode === 'sql'">
                      <Textarea
                        v-model="selectedReport.sqlQuery"
                        rows="15"
                        class="w-full font-mono"
                        placeholder="SELECT * FROM ..."
                        @change="markAsModified"
                      />
                      <div class="flex gap-2 mt-2">
                        <Button
                          label="Выполнить"
                          icon="pi pi-play"
                          size="small"
                          @click="executeQuery"
                          :loading="executingQuery"
                        />
                        <Button
                          label="Форматировать"
                          icon="pi pi-align-left"
                          size="small"
                          outlined
                          @click="formatSQL"
                        />
                        <Button
                          label="Объяснить"
                          icon="pi pi-info-circle"
                          size="small"
                          outlined
                          @click="explainQuery"
                        />
                      </div>
                    </div>

                    <!-- Visual Query Builder Mode -->
                    <div v-else-if="queryMode === 'visual'">
                      <div class="visual-query-builder">
                        <!-- FROM Table -->
                        <div class="form-group mb-3">
                          <label class="form-label">FROM (Таблица)</label>
                          <Dropdown
                            v-model="queryConfig.fromTable"
                            :options="availableTables"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Выберите таблицу"
                            :filter="true"
                            class="w-full"
                            @change="onTableChange"
                          />
                        </div>

                        <!-- SELECT Columns -->
                        <div class="form-group mb-3">
                          <label class="form-label">SELECT (Колонки)</label>
                          <MultiSelect
                            v-model="queryConfig.selectedColumns"
                            :options="availableColumns"
                            optionLabel="name"
                            optionValue="id"
                            placeholder="Выберите колонки"
                            :filter="true"
                            class="w-full"
                            display="chip"
                            @change="markAsModified"
                          />
                        </div>

                        <!-- WHERE Conditions -->
                        <div class="form-group mb-3">
                          <div class="flex justify-content-between align-items-center mb-2">
                            <label class="form-label">WHERE (Условия)</label>
                            <Button
                              label="Добавить условие"
                              icon="pi pi-plus"
                              size="small"
                              outlined
                              @click="addWhereCondition"
                            />
                          </div>
                          <div
                            v-for="(condition, index) in queryConfig.whereConditions"
                            :key="index"
                            class="flex gap-2 mb-2"
                          >
                            <Dropdown
                              v-model="condition.column"
                              :options="availableColumns"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Колонка"
                              class="flex-1"
                              @change="markAsModified"
                            />
                            <Dropdown
                              v-model="condition.operator"
                              :options="whereOperators"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="Оператор"
                              style="width: 150px"
                              @change="markAsModified"
                            />
                            <InputText
                              v-model="condition.value"
                              placeholder="Значение"
                              class="flex-1"
                              @change="markAsModified"
                            />
                            <Button
                              icon="pi pi-trash"
                              severity="danger"
                              text
                              rounded
                              size="small"
                              @click="removeWhereCondition(index)"
                            />
                          </div>
                        </div>

                        <!-- ORDER BY -->
                        <div class="form-group mb-3">
                          <label class="form-label">ORDER BY (Сортировка)</label>
                          <div class="flex gap-2">
                            <Dropdown
                              v-model="queryConfig.orderByColumn"
                              :options="availableColumns"
                              optionLabel="name"
                              optionValue="id"
                              placeholder="Колонка"
                              class="flex-1"
                              @change="markAsModified"
                            />
                            <Dropdown
                              v-model="queryConfig.orderByDirection"
                              :options="[
                                { label: 'ASC ↑', value: 'ASC' },
                                { label: 'DESC ↓', value: 'DESC' }
                              ]"
                              optionLabel="label"
                              optionValue="value"
                              placeholder="Направление"
                              style="width: 120px"
                              @change="markAsModified"
                            />
                          </div>
                        </div>

                        <!-- LIMIT -->
                        <div class="form-group mb-3">
                          <label class="form-label">LIMIT (Ограничение)</label>
                          <InputNumber
                            v-model="queryConfig.limit"
                            placeholder="Количество записей"
                            class="w-full"
                            @change="markAsModified"
                          />
                        </div>

                        <Divider />

                        <div class="flex gap-2">
                          <Button
                            label="Выполнить запрос"
                            icon="pi pi-play"
                            @click="executeVisualQuery"
                            :loading="executingQuery"
                          />
                          <Button
                            label="Показать SQL"
                            icon="pi pi-code"
                            outlined
                            @click="showGeneratedSQL"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Natural Language Mode -->
                    <div v-else-if="queryMode === 'natural'">
                      <div class="natural-query-builder">
                        <label class="form-label mb-2">Опишите, какие данные вам нужны</label>
                        <Textarea
                          v-model="naturalQueryInput"
                          rows="5"
                          class="w-full"
                          placeholder="Например: 'Покажи все заказы за последние 30 дней с суммой больше 1000 рублей'"
                          @change="markAsModified"
                        />
                        <div class="flex gap-2 mt-2">
                          <Button
                            label="Сгенерировать запрос"
                            icon="pi pi-bolt"
                            @click="generateQueryFromNatural"
                            :loading="generatingQuery"
                          />
                          <Button
                            label="Пример"
                            icon="pi pi-lightbulb"
                            outlined
                            @click="showNaturalQueryExamples"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabPanel>

                <!-- Display Settings -->
                <TabPanel header="Отображение">
                  <div class="config-section">
                    <div class="form-group mb-4">
                      <label class="form-label">Режим отображения</label>
                      <SelectButton
                        v-model="selectedReport.displayMode"
                        :options="displayModeOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="markAsModified"
                      />
                    </div>

                    <div class="form-group mb-4">
                      <label class="form-label">Плотность строк</label>
                      <SelectButton
                        v-model="selectedReport.rowDensity"
                        :options="rowDensityOptions"
                        optionLabel="label"
                        optionValue="value"
                        @change="markAsModified"
                      />
                    </div>

                    <Divider />

                    <div class="form-group mb-4">
                      <label class="form-label">Включить функции</label>
                      <div class="flex flex-column gap-2">
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enableInlineEdit"
                            v-model="selectedReport.features.inlineEdit"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enableInlineEdit" class="ml-2">Inline редактирование</label>
                        </div>
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enableExport"
                            v-model="selectedReport.features.export"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enableExport" class="ml-2">Экспорт (CSV, Excel, PDF)</label>
                        </div>
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enableFilters"
                            v-model="selectedReport.features.filters"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enableFilters" class="ml-2">Фильтры колонок</label>
                        </div>
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enableSort"
                            v-model="selectedReport.features.sort"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enableSort" class="ml-2">Сортировка</label>
                        </div>
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enablePagination"
                            v-model="selectedReport.features.pagination"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enablePagination" class="ml-2">Пагинация</label>
                        </div>
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="enableSelection"
                            v-model="selectedReport.features.selection"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="enableSelection" class="ml-2">Выделение строк</label>
                        </div>
                      </div>
                    </div>

                    <Divider />

                    <div class="form-group mb-4">
                      <label class="form-label">Размер страницы (по умолчанию)</label>
                      <InputNumber
                        v-model="selectedReport.defaultPageSize"
                        :min="10"
                        :max="1000"
                        :step="10"
                        class="w-full"
                        @change="markAsModified"
                      />
                    </div>
                  </div>
                </TabPanel>

                <!-- Columns Configuration -->
                <TabPanel header="Колонки">
                  <div class="config-section">
                    <div class="flex justify-content-between align-items-center mb-3">
                      <label class="form-label">Настройка колонок</label>
                      <Button
                        label="Автоопределение"
                        icon="pi pi-sync"
                        size="small"
                        outlined
                        @click="autoDetectColumns"
                      />
                    </div>

                    <DataTable
                      :value="selectedReport.columns"
                      :reorderableColumns="true"
                      @row-reorder="onColumnReorder"
                      class="columns-table mb-3"
                    >
                      <Column rowReorder headerStyle="width: 3rem" />
                      <Column field="name" header="Название">
                        <template #body="{ data }">
                          <InputText
                            v-model="data.name"
                            class="w-full"
                            @change="markAsModified"
                          />
                        </template>
                      </Column>
                      <Column field="alias" header="Алиас">
                        <template #body="{ data }">
                          <InputText
                            v-model="data.alias"
                            class="w-full"
                            @change="markAsModified"
                          />
                        </template>
                      </Column>
                      <Column field="type" header="Тип">
                        <template #body="{ data }">
                          <Dropdown
                            v-model="data.type"
                            :options="columnTypes"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                            @change="markAsModified"
                          />
                        </template>
                      </Column>
                      <Column field="width" header="Ширина">
                        <template #body="{ data }">
                          <InputNumber
                            v-model="data.width"
                            suffix="px"
                            class="w-full"
                            @change="markAsModified"
                          />
                        </template>
                      </Column>
                      <Column field="visible" header="Видимость">
                        <template #body="{ data }">
                          <Checkbox
                            v-model="data.visible"
                            :binary="true"
                            @change="markAsModified"
                          />
                        </template>
                      </Column>
                      <Column headerStyle="width: 4rem">
                        <template #body="{ data, index }">
                          <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            rounded
                            size="small"
                            @click="removeColumn(index)"
                          />
                        </template>
                      </Column>
                    </DataTable>

                    <Button
                      label="Добавить колонку"
                      icon="pi pi-plus"
                      outlined
                      @click="addColumn"
                    />
                  </div>
                </TabPanel>

                <!-- Scheduling & Automation -->
                <TabPanel header="Автоматизация">
                  <div class="config-section">
                    <div class="form-group mb-4">
                      <div class="field-checkbox">
                        <Checkbox
                          inputId="enableSchedule"
                          v-model="selectedReport.schedule.enabled"
                          :binary="true"
                          @change="markAsModified"
                        />
                        <label for="enableSchedule" class="ml-2 font-medium">
                          Автоматическое обновление отчета
                        </label>
                      </div>
                    </div>

                    <div v-if="selectedReport.schedule.enabled">
                      <div class="form-group mb-4">
                        <label class="form-label">Частота обновления</label>
                        <Dropdown
                          v-model="selectedReport.schedule.frequency"
                          :options="scheduleFrequencies"
                          optionLabel="label"
                          optionValue="value"
                          class="w-full"
                          @change="markAsModified"
                        />
                      </div>

                      <div class="form-group mb-4">
                        <label class="form-label">Время запуска</label>
                        <Calendar
                          v-model="selectedReport.schedule.time"
                          timeOnly
                          class="w-full"
                          @change="markAsModified"
                        />
                      </div>

                      <Divider />

                      <div class="form-group mb-4">
                        <div class="field-checkbox">
                          <Checkbox
                            inputId="emailNotifications"
                            v-model="selectedReport.schedule.emailNotifications"
                            :binary="true"
                            @change="markAsModified"
                          />
                          <label for="emailNotifications" class="ml-2">
                            Отправлять уведомления на email
                          </label>
                        </div>
                      </div>

                      <div v-if="selectedReport.schedule.emailNotifications" class="form-group mb-4">
                        <label class="form-label">Email получателей</label>
                        <Chips
                          v-model="selectedReport.schedule.emailRecipients"
                          separator=","
                          class="w-full"
                          placeholder="email@example.com"
                          @change="markAsModified"
                        />
                      </div>
                    </div>
                  </div>
                </TabPanel>
              </TabView>

              <!-- Action Buttons -->
              <Divider />
              <div class="flex justify-content-between">
                <div class="flex gap-2">
                  <Button
                    label="Сохранить"
                    icon="pi pi-save"
                    @click="saveReport"
                    :loading="saving"
                    :disabled="!isModified"
                  />
                  <Button
                    label="Отменить"
                    icon="pi pi-times"
                    outlined
                    @click="cancelChanges"
                    :disabled="!isModified"
                  />
                </div>
                <div class="flex gap-2">
                  <Button
                    label="Предпросмотр"
                    icon="pi pi-eye"
                    outlined
                    @click="previewReport"
                  />
                  <Button
                    label="Удалить отчет"
                    icon="pi pi-trash"
                    severity="danger"
                    outlined
                    @click="confirmDeleteReport"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Context Menu for Reports -->
    <ContextMenu ref="reportContextMenu" :model="reportMenuItems" />

    <!-- Templates Dialog -->
    <Dialog
      v-model:visible="showTemplatesDialog"
      header="Шаблоны отчетов"
      :style="{ width: '50rem' }"
      :modal="true"
    >
      <div class="templates-grid">
        <Card
          v-for="template in reportTemplates"
          :key="template.id"
          class="template-card"
          @click="applyTemplate(template)"
        >
          <template #header>
            <i :class="template.icon" class="text-4xl text-primary"></i>
          </template>
          <template #title>
            {{ template.name }}
          </template>
          <template #content>
            <p class="text-sm">{{ template.description }}</p>
          </template>
          <template #footer>
            <Button
              label="Использовать"
              icon="pi pi-check"
              size="small"
              @click.stop="applyTemplate(template)"
            />
          </template>
        </Card>
      </div>
    </Dialog>

    <!-- SQL Preview Dialog -->
    <Dialog
      v-model:visible="showSQLDialog"
      header="Сгенерированный SQL"
      :style="{ width: '50rem' }"
      :modal="true"
    >
      <pre class="sql-preview">{{ generatedSQL }}</pre>
      <template #footer>
        <Button
          label="Копировать"
          icon="pi pi-copy"
          @click="copySQL"
        />
        <Button
          label="Закрыть"
          text
          @click="showSQLDialog = false"
        />
      </template>
    </Dialog>

    <!-- Query Results Dialog -->
    <Dialog
      v-model:visible="showQueryResults"
      header="Результаты запроса"
      :style="{ width: '80rem' }"
      :modal="true"
      maximizable
    >
      <DataTable
        :value="queryResults"
        :paginator="true"
        :rows="20"
        responsiveLayout="scroll"
      >
        <Column
          v-for="col in queryResultColumns"
          :key="col.field"
          :field="col.field"
          :header="col.header"
        />
      </DataTable>
      <template #footer>
        <div class="flex justify-content-between align-items-center">
          <span class="text-sm text-color-secondary">
            Найдено записей: {{ queryResults.length }}
          </span>
          <Button
            label="Закрыть"
            text
            @click="showQueryResults = false"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue'
import integramService from '@/services/integramApiClient'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Database from route
const database = computed(() => route.params.database || 'my')

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: 'Integram', to: `/integram/${database.value}` },
  { label: 'Конфигуратор отчетов', icon: 'pi pi-cog' }
])

// State
const loadingReports = ref(false)
const reports = ref([])
const selectedReport = ref(null)
const activeFilter = ref('all')
const searchQuery = ref('')
const isModified = ref(false)
const saving = ref(false)
const executingQuery = ref(false)
const generatingQuery = ref(false)
const activeConfigTab = ref(0)
const queryMode = ref('visual')
const showTemplatesDialog = ref(false)
const showSQLDialog = ref(false)
const showQueryResults = ref(false)
const reportContextMenu = ref(null)
const naturalQueryInput = ref('')
const generatedSQL = ref('')
const queryResults = ref([])
const queryResultColumns = ref([])

// Query Configuration
const queryConfig = ref({
  fromTable: null,
  selectedColumns: [],
  whereConditions: [],
  orderByColumn: null,
  orderByDirection: 'ASC',
  limit: 100
})

// Available Tables and Columns (to be loaded from Integram)
const availableTables = ref([])
const availableColumns = ref([])

// Options
const queryModeOptions = [
  { label: 'SQL', value: 'sql' },
  { label: 'Визуальный', value: 'visual' },
  { label: 'На языке', value: 'natural' }
]

const reportCategories = [
  { label: 'Аналитика', value: 'analytics' },
  { label: 'Финансы', value: 'finance' },
  { label: 'Продажи', value: 'sales' },
  { label: 'HR', value: 'hr' },
  { label: 'Операции', value: 'operations' },
  { label: 'Другое', value: 'other' }
]

const displayModeOptions = [
  { label: 'Таблица', value: 'table' },
  { label: 'Карточки', value: 'cards' },
  { label: 'Список', value: 'list' }
]

const rowDensityOptions = [
  { label: 'Компактный', value: 'compact' },
  { label: 'Обычный', value: 'normal' },
  { label: 'Комфортный', value: 'comfortable' }
]

const whereOperators = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: 'LIKE', value: 'LIKE' },
  { label: 'NOT LIKE', value: 'NOT LIKE' },
  { label: 'IN', value: 'IN' },
  { label: 'NOT IN', value: 'NOT IN' },
  { label: 'IS NULL', value: 'IS NULL' },
  { label: 'IS NOT NULL', value: 'IS NOT NULL' }
]

const columnTypes = [
  { label: 'Текст', value: 'text' },
  { label: 'Число', value: 'number' },
  { label: 'Дата', value: 'date' },
  { label: 'Дата/время', value: 'datetime' },
  { label: 'Булево', value: 'boolean' },
  { label: 'Ссылка', value: 'reference' }
]

const scheduleFrequencies = [
  { label: 'Каждый час', value: 'hourly' },
  { label: 'Ежедневно', value: 'daily' },
  { label: 'Еженедельно', value: 'weekly' },
  { label: 'Ежемесячно', value: 'monthly' }
]

const reportTemplates = [
  {
    id: 1,
    name: 'Простой список',
    description: 'Базовая таблица с фильтрами и сортировкой',
    icon: 'pi pi-list',
    config: {
      displayMode: 'table',
      features: {
        inlineEdit: false,
        export: true,
        filters: true,
        sort: true,
        pagination: true,
        selection: false
      }
    }
  },
  {
    id: 2,
    name: 'Редактируемая таблица',
    description: 'Таблица с возможностью редактирования',
    icon: 'pi pi-pencil',
    config: {
      displayMode: 'table',
      features: {
        inlineEdit: true,
        export: true,
        filters: true,
        sort: true,
        pagination: true,
        selection: true
      }
    }
  },
  {
    id: 3,
    name: 'Аналитический отчет',
    description: 'Отчет с агрегациями и группировками',
    icon: 'pi pi-chart-bar',
    config: {
      displayMode: 'table',
      features: {
        inlineEdit: false,
        export: true,
        filters: true,
        sort: true,
        pagination: false,
        selection: false
      }
    }
  },
  {
    id: 4,
    name: 'Карточный вид',
    description: 'Отображение данных в виде карточек',
    icon: 'pi pi-th-large',
    config: {
      displayMode: 'cards',
      features: {
        inlineEdit: false,
        export: true,
        filters: true,
        sort: true,
        pagination: true,
        selection: false
      }
    }
  }
]

// Computed
const filteredReports = computed(() => {
  let filtered = reports.value

  // Apply filter
  if (activeFilter.value === 'my') {
    filtered = filtered.filter(r => r.owner === 'current_user')
  } else if (activeFilter.value === 'favorites') {
    filtered = filtered.filter(r => r.favorite)
  } else if (activeFilter.value === 'shared') {
    filtered = filtered.filter(r => r.isPublic)
  }

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(r =>
      r.name?.toLowerCase().includes(query) ||
      r.id?.toString().includes(query) ||
      r.description?.toLowerCase().includes(query)
    )
  }

  return filtered
})

const reportMenuItems = computed(() => [
  {
    label: 'Открыть',
    icon: 'pi pi-external-link',
    command: () => openReport(selectedReport.value)
  },
  {
    label: 'Дублировать',
    icon: 'pi pi-copy',
    command: () => duplicateReport(selectedReport.value)
  },
  {
    label: 'Экспорт конфигурации',
    icon: 'pi pi-download',
    command: () => exportReportConfig(selectedReport.value)
  },
  { separator: true },
  {
    label: 'Удалить',
    icon: 'pi pi-trash',
    command: () => confirmDeleteReport()
  }
])

// Methods
async function loadReports() {
  loadingReports.value = true
  try {
    // Load reports from Integram (type 22 - Запросы/Reports)
    const response = await integramService.getObjectList(22, {
      F_U: 1,
      LIMIT: 1000
    })

    reports.value = response.objects?.map(obj => ({
      id: obj.id,
      name: obj.val || obj.value,
      description: obj.description,
      category: obj.category,
      tags: obj.tags || [],
      isPublic: obj.isPublic || false,
      isTemplate: obj.isTemplate || false,
      favorite: obj.favorite || false,
      owner: obj.owner || 'current_user',
      sqlQuery: obj.sqlQuery || '',
      displayMode: obj.displayMode || 'table',
      rowDensity: obj.rowDensity || 'normal',
      features: obj.features || {
        inlineEdit: false,
        export: true,
        filters: true,
        sort: true,
        pagination: true,
        selection: false
      },
      columns: obj.columns || [],
      defaultPageSize: obj.defaultPageSize || 50,
      schedule: obj.schedule || {
        enabled: false,
        frequency: 'daily',
        time: null,
        emailNotifications: false,
        emailRecipients: []
      }
    })) || []
  } catch (error) {
    logger.error('Failed to load reports:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить список отчетов',
      life: 5000
    })
  } finally {
    loadingReports.value = false
  }
}

async function loadAvailableTables() {
  try {
    const dict = await integramService.getDictionary()
    availableTables.value = dict.types?.map(t => ({
      id: t.id,
      name: t.name || t.val
    })) || []
  } catch (error) {
    logger.error('Failed to load tables:', error)
  }
}

async function onTableChange() {
  if (!queryConfig.value.fromTable) return

  try {
    const metadata = await integramService.getTypeMetadata(queryConfig.value.fromTable)
    availableColumns.value = metadata.requisites?.map(r => ({
      id: r.id,
      name: r.alias || r.name || r.val,
      type: r.type
    })) || []
  } catch (error) {
    logger.error('Failed to load columns:', error)
  }
}

function selectReport(report) {
  selectedReport.value = { ...report }
  isModified.value = false
}

function createNewReport() {
  selectedReport.value = {
    id: null,
    name: '',
    description: '',
    category: 'other',
    tags: [],
    isPublic: false,
    isTemplate: false,
    favorite: false,
    sqlQuery: '',
    displayMode: 'table',
    rowDensity: 'normal',
    features: {
      inlineEdit: false,
      export: true,
      filters: true,
      sort: true,
      pagination: true,
      selection: false
    },
    columns: [],
    defaultPageSize: 50,
    schedule: {
      enabled: false,
      frequency: 'daily',
      time: null,
      emailNotifications: false,
      emailRecipients: []
    }
  }
  isModified.value = false
  activeConfigTab.value = 0
}

function markAsModified() {
  isModified.value = true
}

function toggleFavorite(report) {
  report.favorite = !report.favorite
  // Save to backend
  saveReportField(report.id, 'favorite', report.favorite)
}

function showReportMenu(event, report) {
  selectedReport.value = report
  reportContextMenu.value.show(event)
}

async function saveReport() {
  if (!selectedReport.value) return

  saving.value = true
  try {
    if (selectedReport.value.id) {
      // Update existing report
      await integramService.setObjectRequisites(selectedReport.value.id, {
        name: selectedReport.value.name,
        description: selectedReport.value.description,
        category: selectedReport.value.category,
        tags: selectedReport.value.tags,
        isPublic: selectedReport.value.isPublic,
        isTemplate: selectedReport.value.isTemplate,
        sqlQuery: selectedReport.value.sqlQuery,
        displayMode: selectedReport.value.displayMode,
        rowDensity: selectedReport.value.rowDensity,
        features: selectedReport.value.features,
        columns: selectedReport.value.columns,
        defaultPageSize: selectedReport.value.defaultPageSize,
        schedule: selectedReport.value.schedule
      })

      toast.add({
        severity: 'success',
        summary: 'Сохранено',
        detail: 'Отчет успешно обновлен',
        life: 3000
      })
    } else {
      // Create new report
      const result = await integramService.createObject(22, selectedReport.value.name, {
        description: selectedReport.value.description,
        category: selectedReport.value.category,
        tags: selectedReport.value.tags,
        isPublic: selectedReport.value.isPublic,
        isTemplate: selectedReport.value.isTemplate,
        sqlQuery: selectedReport.value.sqlQuery,
        displayMode: selectedReport.value.displayMode,
        rowDensity: selectedReport.value.rowDensity,
        features: selectedReport.value.features,
        columns: selectedReport.value.columns,
        defaultPageSize: selectedReport.value.defaultPageSize,
        schedule: selectedReport.value.schedule
      })

      selectedReport.value.id = result.id

      toast.add({
        severity: 'success',
        summary: 'Создано',
        detail: 'Новый отчет успешно создан',
        life: 3000
      })
    }

    isModified.value = false
    await loadReports()
  } catch (error) {
    logger.error('Failed to save report:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message || 'Не удалось сохранить отчет',
      life: 5000
    })
  } finally {
    saving.value = false
  }
}

async function saveReportField(reportId, field, value) {
  try {
    await integramService.setObjectRequisites(reportId, { [field]: value })
  } catch (error) {
    logger.error('Failed to save report field:', error)
  }
}

function cancelChanges() {
  if (selectedReport.value?.id) {
    const original = reports.value.find(r => r.id === selectedReport.value.id)
    if (original) {
      selectedReport.value = { ...original }
    }
  } else {
    selectedReport.value = null
  }
  isModified.value = false
}

async function confirmDeleteReport() {
  if (!selectedReport.value) return

  if (confirm(`Удалить отчет "${selectedReport.value.name}"?`)) {
    try {
      await integramService.deleteObject(selectedReport.value.id)
      toast.add({
        severity: 'success',
        summary: 'Удалено',
        detail: 'Отчет успешно удален',
        life: 3000
      })
      selectedReport.value = null
      await loadReports()
    } catch (error) {
      logger.error('Failed to delete report:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось удалить отчет',
        life: 5000
      })
    }
  }
}

function addWhereCondition() {
  queryConfig.value.whereConditions.push({
    column: null,
    operator: '=',
    value: ''
  })
  markAsModified()
}

function removeWhereCondition(index) {
  queryConfig.value.whereConditions.splice(index, 1)
  markAsModified()
}

function addColumn() {
  if (!selectedReport.value.columns) {
    selectedReport.value.columns = []
  }
  selectedReport.value.columns.push({
    name: 'Новая колонка',
    alias: '',
    type: 'text',
    width: 150,
    visible: true
  })
  markAsModified()
}

function removeColumn(index) {
  selectedReport.value.columns.splice(index, 1)
  markAsModified()
}

function onColumnReorder(event) {
  markAsModified()
}

async function executeQuery() {
  executingQuery.value = true
  try {
    // Execute SQL query
    const result = await integramService.executeReport(selectedReport.value.id || 0, {
      customSQL: selectedReport.value.sqlQuery
    })

    queryResults.value = result.rows || []
    queryResultColumns.value = result.headers?.map(h => ({
      field: h.field,
      header: h.value || h.alias
    })) || []

    showQueryResults.value = true

    toast.add({
      severity: 'success',
      summary: 'Выполнено',
      detail: `Найдено записей: ${queryResults.value.length}`,
      life: 3000
    })
  } catch (error) {
    logger.error('Failed to execute query:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка выполнения',
      detail: error.message || 'Не удалось выполнить запрос',
      life: 5000
    })
  } finally {
    executingQuery.value = false
  }
}

async function executeVisualQuery() {
  executingQuery.value = true
  try {
    // Build SQL from visual config
    const sql = buildSQLFromConfig()
    selectedReport.value.sqlQuery = sql
    await executeQuery()
  } catch (error) {
    logger.error('Failed to execute visual query:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message,
      life: 5000
    })
  } finally {
    executingQuery.value = false
  }
}

function buildSQLFromConfig() {
  const config = queryConfig.value

  if (!config.fromTable) {
    throw new Error('Выберите таблицу')
  }

  if (!config.selectedColumns || config.selectedColumns.length === 0) {
    throw new Error('Выберите хотя бы одну колонку')
  }

  const table = availableTables.value.find(t => t.id === config.fromTable)
  const columns = config.selectedColumns
    .map(colId => {
      const col = availableColumns.value.find(c => c.id === colId)
      return col?.name || colId
    })
    .join(', ')

  let sql = `SELECT ${columns}\nFROM ${table.name}`

  // WHERE
  if (config.whereConditions.length > 0) {
    const conditions = config.whereConditions
      .filter(c => c.column && c.operator)
      .map(c => {
        const col = availableColumns.value.find(col => col.id === c.column)
        const colName = col?.name || c.column
        if (c.operator === 'IS NULL' || c.operator === 'IS NOT NULL') {
          return `${colName} ${c.operator}`
        }
        return `${colName} ${c.operator} '${c.value}'`
      })
      .join(' AND ')

    if (conditions) {
      sql += `\nWHERE ${conditions}`
    }
  }

  // ORDER BY
  if (config.orderByColumn) {
    const col = availableColumns.value.find(c => c.id === config.orderByColumn)
    sql += `\nORDER BY ${col?.name || config.orderByColumn} ${config.orderByDirection}`
  }

  // LIMIT
  if (config.limit) {
    sql += `\nLIMIT ${config.limit}`
  }

  return sql
}

function showGeneratedSQL() {
  try {
    generatedSQL.value = buildSQLFromConfig()
    showSQLDialog.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message,
      life: 3000
    })
  }
}

function copySQL() {
  navigator.clipboard.writeText(generatedSQL.value)
  toast.add({
    severity: 'success',
    summary: 'Скопировано',
    detail: 'SQL запрос скопирован в буфер обмена',
    life: 2000
  })
}

function formatSQL() {
  // Simple SQL formatter
  if (selectedReport.value.sqlQuery) {
    selectedReport.value.sqlQuery = selectedReport.value.sqlQuery
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim()

    markAsModified()
  }
}

function explainQuery() {
  toast.add({
    severity: 'info',
    summary: 'Функция в разработке',
    detail: 'Объяснение запроса будет добавлено позже',
    life: 3000
  })
}

async function generateQueryFromNatural() {
  generatingQuery.value = true
  try {
    toast.add({
      severity: 'info',
      summary: 'Функция в разработке',
      detail: 'AI-генерация запросов будет добавлена в следующей версии',
      life: 3000
    })
  } finally {
    generatingQuery.value = false
  }
}

function showNaturalQueryExamples() {
  naturalQueryInput.value = 'Покажи все заказы за последний месяц с суммой больше 5000 рублей'
}

function applyTemplate(template) {
  if (selectedReport.value) {
    Object.assign(selectedReport.value, template.config)
    markAsModified()
    toast.add({
      severity: 'success',
      summary: 'Шаблон применен',
      detail: `Применен шаблон "${template.name}"`,
      life: 2000
    })
  }
  showTemplatesDialog.value = false
}

function autoDetectColumns() {
  // Auto-detect columns from query or table
  toast.add({
    severity: 'info',
    summary: 'Функция в разработке',
    detail: 'Автоопределение колонок будет добавлено позже',
    life: 3000
  })
}

function previewReport() {
  if (selectedReport.value?.id) {
    const url = `/integram/${database.value}/requests/${selectedReport.value.id}`
    window.open(url, '_blank')
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Сохраните отчет',
      detail: 'Сначала сохраните отчет для предпросмотра',
      life: 3000
    })
  }
}

function openReport(report) {
  const url = `/integram/${database.value}/requests/${report.id}`
  router.push(url)
}

function duplicateReport(report) {
  selectedReport.value = {
    ...report,
    id: null,
    name: `${report.name} (копия)`,
    favorite: false
  }
  isModified.value = true
  toast.add({
    severity: 'info',
    summary: 'Отчет дублирован',
    detail: 'Отредактируйте и сохраните копию',
    life: 3000
  })
}

function exportReportConfig(report) {
  const config = JSON.stringify(report, null, 2)
  const blob = new Blob([config], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report_${report.id}_config.json`
  a.click()
  URL.revokeObjectURL(url)

  toast.add({
    severity: 'success',
    summary: 'Экспортировано',
    detail: 'Конфигурация отчета сохранена',
    life: 2000
  })
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadReports(),
    loadAvailableTables()
  ])

  // Load report from route if specified
  if (route.query.reportId) {
    const reportId = parseInt(route.query.reportId)
    const report = reports.value.find(r => r.id === reportId)
    if (report) {
      selectReport(report)
    }
  }
})
</script>

<style scoped>
.report-configurator {
  padding: 1rem;
}

.configurator-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.5rem;
  min-height: 600px;
}

.configurator-sidebar {
  background: var(--surface-ground);
  border-radius: var(--border-radius);
  padding: 1rem;
  height: fit-content;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.sidebar-header {
  position: sticky;
  top: 0;
  background: var(--surface-ground);
  z-index: 1;
  padding-bottom: 0.5rem;
}

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.report-item {
  padding: 0.75rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.report-item:hover {
  background: var(--surface-hover);
  border-color: var(--primary-color);
}

.report-item-active {
  background: var(--primary-50);
  border-color: var(--primary-color);
}

.chip-active {
  background: var(--primary-color) !important;
  color: var(--primary-color-text) !important;
}

.configurator-content {
  background: var(--surface-card);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  min-height: 600px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 3rem;
  text-align: center;
}

.config-section {
  padding: 1rem 0;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-label.required::after {
  content: ' *';
  color: var(--red-500);
}

.visual-query-builder {
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: var(--border-radius);
}

.natural-query-builder {
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: var(--border-radius);
}

.columns-table {
  font-size: 0.9rem;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.template-card {
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sql-preview {
  background: var(--surface-ground);
  padding: 1rem;
  border-radius: var(--border-radius);
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
}
</style>
