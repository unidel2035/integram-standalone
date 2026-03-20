<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEditMode ? 'Настройка карты' : 'Добавить карту'"
    :style="{ width: '750px' }"
    :closable="true"
    @hide="handleCancel"
  >
    <div class="map-config-content">
      <!-- Tabs: Основные / Источник данных -->
      <TabView v-model:activeIndex="activeTab">
        <!-- Tab 1: Basic settings -->
        <TabPanel header="Основные">
          <!-- Title -->
          <div class="field mb-4">
            <label for="map-title" class="block font-semibold mb-2">
              <i class="pi pi-bookmark mr-2"></i>Заголовок (опционально)
            </label>
            <InputText
              id="map-title"
              v-model="config.title"
              placeholder="Например: Расположение офиса"
              class="w-full"
            />
          </div>

          <!-- Center coordinates -->
          <div class="field mb-4">
            <label class="block font-semibold mb-2">
              <i class="pi pi-map-marker mr-2"></i>Центр карты
            </label>
            <div class="grid">
              <div class="col-6">
                <label for="lat" class="block text-sm mb-1">Широта</label>
                <InputNumber
                  id="lat"
                  v-model="config.center.lat"
                  :min-fraction-digits="4"
                  :max-fraction-digits="6"
                  :min="-90"
                  :max="90"
                  class="w-full"
                />
              </div>
              <div class="col-6">
                <label for="lng" class="block text-sm mb-1">Долгота</label>
                <InputNumber
                  id="lng"
                  v-model="config.center.lng"
                  :min-fraction-digits="4"
                  :max-fraction-digits="6"
                  :min="-180"
                  :max="180"
                  class="w-full"
                />
              </div>
            </div>
            <small class="text-color-secondary mt-1 block">
              {{ config.center.lat.toFixed(4) }}, {{ config.center.lng.toFixed(4) }}
            </small>
          </div>

          <!-- Zoom -->
          <div class="field mb-4">
            <label for="zoom" class="block font-semibold mb-2">
              <i class="pi pi-search-plus mr-2"></i>Масштаб: {{ config.zoom }}
            </label>
            <Slider
              id="zoom"
              v-model="config.zoom"
              :min="1"
              :max="18"
              :step="1"
              class="w-full"
            />
            <div class="flex justify-content-between text-sm text-color-secondary mt-1">
              <span>Мир (1)</span>
              <span>Улица (18)</span>
            </div>
          </div>

          <!-- Height -->
          <div class="field mb-4">
            <label for="height" class="block font-semibold mb-2">
              <i class="pi pi-arrows-v mr-2"></i>Высота блока
            </label>
            <Dropdown
              id="height"
              v-model="config.height"
              :options="heightOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <!-- Markers -->
          <div class="field mb-4">
            <div class="flex justify-content-between align-items-center mb-2">
              <label class="font-semibold">
                <i class="pi pi-map-marker mr-2"></i>Маркеры
              </label>
              <Button
                label="Добавить маркер"
                icon="pi pi-plus"
                size="small"
                outlined
                @click="addMarker"
              />
            </div>

            <div v-if="config.markers.length === 0" class="text-center p-4 border-1 border-dashed surface-border border-round">
              <i class="pi pi-map-marker text-4xl text-color-secondary mb-2"></i>
              <p class="text-color-secondary m-0">Нет маркеров. Добавьте вручную или подключите базу данных.</p>
            </div>

            <div v-else class="markers-list">
              <div
                v-for="(marker, index) in config.markers"
                :key="index"
                class="marker-item p-3 mb-2 border-1 surface-border border-round"
              >
                <div class="flex justify-content-between align-items-start mb-2">
                  <span class="font-semibold">Маркер {{ index + 1 }}</span>
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    size="small"
                    @click="removeMarker(index)"
                  />
                </div>
                <div class="grid">
                  <div class="col-4">
                    <label class="block text-sm mb-1">Широта</label>
                    <InputNumber
                      v-model="marker.lat"
                      :min-fraction-digits="4"
                      :max-fraction-digits="6"
                      :min="-90"
                      :max="90"
                      class="w-full"
                    />
                  </div>
                  <div class="col-4">
                    <label class="block text-sm mb-1">Долгота</label>
                    <InputNumber
                      v-model="marker.lng"
                      :min-fraction-digits="4"
                      :max-fraction-digits="6"
                      :min="-180"
                      :max="180"
                      class="w-full"
                    />
                  </div>
                  <div class="col-4">
                    <label class="block text-sm mb-1">Цвет</label>
                    <Dropdown
                      v-model="marker.color"
                      :options="markerColors"
                      option-label="label"
                      option-value="value"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3 border-round surface-ground text-sm text-color-secondary">
            <i class="pi pi-info-circle mr-1"></i>
            На карте: маркеры, полигоны/кривые, линейка, переключение слоёв
          </div>
        </TabPanel>

        <!-- Tab 2: Data Source (Integram DB) -->
        <TabPanel header="Источник данных">
          <div class="field mb-3">
            <div class="flex align-items-center gap-2 mb-3">
              <InputSwitch v-model="dataSourceEnabled" />
              <label class="font-semibold">Загружать данные из базы Integram</label>
            </div>
          </div>

          <template v-if="dataSourceEnabled">
            <!-- Database -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-database mr-2"></i>База данных
              </label>
              <div class="flex gap-2">
                <InputText
                  v-model="ds.database"
                  placeholder="kval"
                  class="flex-grow-1"
                />
                <Button
                  icon="pi pi-refresh"
                  :loading="loadingTables"
                  size="small"
                  title="Загрузить список таблиц"
                  @click="handleLoadTables"
                />
              </div>
            </div>

            <!-- Objects Table — Dropdown -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-table mr-2"></i>Таблица объектов
              </label>
              <div class="flex gap-2">
                <Dropdown
                  v-model="ds.objectsTypeId"
                  :options="tablesList"
                  option-label="label"
                  option-value="value"
                  filter
                  :filter-fields="['label', 'idStr']"
                  :loading="loadingTables"
                  :placeholder="loadingTables ? 'Загрузка...' : (tablesList.length ? 'Выберите таблицу' : 'Нажмите обновить')"
                  class="flex-grow-1"
                  :show-clear="true"
                  @change="onTableSelected"
                >
                  <template #option="{ option }">
                    <div class="flex justify-content-between w-full">
                      <span>{{ option.label }}</span>
                      <span class="text-color-secondary text-sm ml-2">ID: {{ option.value }}</span>
                    </div>
                  </template>
                  <template #value="{ value }">
                    <span v-if="value">
                      {{ getTableLabel(value) }}
                      <span class="text-color-secondary text-sm ml-1">({{ value }})</span>
                    </span>
                    <span v-else class="text-color-secondary">Выберите таблицу</span>
                  </template>
                </Dropdown>
                <Button
                  label="Найти поля"
                  icon="pi pi-search"
                  :loading="discovering"
                  :disabled="!ds.objectsTypeId"
                  size="small"
                  @click="handleDiscover"
                />
              </div>
              <small v-if="discoverResult" class="block mt-1" :class="discoverResult.found ? 'text-green-500' : 'text-orange-500'">
                <i :class="discoverResult.found ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'" class="mr-1"></i>
                {{ discoverMessage }}
              </small>
            </div>

            <!-- Discovered structure info -->
            <div v-if="discoverResult && discoverResult.found" class="p-3 mb-3 border-round surface-ground">
              <div class="text-sm font-semibold mb-2">Обнаруженная структура:</div>
              <div class="text-sm" v-for="(step, i) in discoverResult.path" :key="i">
                <span class="text-color-secondary">{{ i > 0 ? '\u00A0\u00A0'.repeat(i) + '\u2192 ' : '' }}</span>
                <span>{{ step.name }}</span>
                <span class="text-color-secondary ml-1">(ID: {{ step.typeId }})</span>
              </div>
            </div>

            <!-- Intermediate Type ID (for 3-level hierarchy) -->
            <div v-if="ds.intermediateTypeId || subTablesList.length > 1" class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-sitemap mr-2"></i>Промежуточная таблица
              </label>
              <Dropdown
                v-model="ds.intermediateTypeId"
                :options="subTablesList"
                option-label="label"
                option-value="value"
                :loading="loadingSubTables"
                :placeholder="loadingSubTables ? 'Загрузка...' : (subTablesList.length ? 'Выберите подтаблицу' : 'Нет подтаблиц')"
                class="w-full"
                :show-clear="true"
                filter
              >
                <template #option="{ option }">
                  <div class="flex justify-content-between w-full">
                    <span>{{ option.label }}</span>
                    <span class="text-color-secondary text-sm ml-2">ID: {{ option.value }}</span>
                  </div>
                </template>
                <template #value="{ value }">
                  <span v-if="value">
                    {{ subTablesList.find(t => t.value === value)?.label || `ID: ${value}` }}
                    <span class="text-color-secondary text-sm ml-1">({{ value }})</span>
                  </span>
                  <span v-else class="text-color-secondary">Промежуточная таблица (опционально)</span>
                </template>
              </Dropdown>
              <small class="text-color-secondary block mt-1">Подтаблица между объектами и точками (если 3 уровня)</small>
            </div>

            <!-- Points Type ID -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-map-marker mr-2"></i>Таблица точек
              </label>
              <Dropdown
                v-model="ds.pointsTypeId"
                :options="subTablesList"
                option-label="label"
                option-value="value"
                :loading="loadingSubTables"
                :placeholder="loadingSubTables ? 'Загрузка...' : (subTablesList.length ? 'Выберите подтаблицу' : (ds.objectsTypeId ? 'Нет подтаблиц' : 'Сначала выберите таблицу'))"
                class="w-full"
                :show-clear="true"
                filter
              >
                <template #option="{ option }">
                  <div class="flex justify-content-between w-full">
                    <span>{{ option.label }}</span>
                    <span class="text-color-secondary text-sm ml-2">ID: {{ option.value }}</span>
                  </div>
                </template>
                <template #value="{ value }">
                  <span v-if="value">
                    {{ subTablesList.find(t => t.value === value)?.label || `ID: ${value}` }}
                    <span class="text-color-secondary text-sm ml-1">({{ value }})</span>
                  </span>
                  <span v-else class="text-color-secondary">Выберите подтаблицу с точками</span>
                </template>
              </Dropdown>
              <small class="text-color-secondary block mt-1">
                Подтаблица с координатами. Оставьте пустым, если координаты на основной таблице.
              </small>
            </div>

            <!-- Lat / Lng requisite IDs -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-compass mr-2"></i>Поля координат
              </label>
              <div class="grid">
                <div class="col-6">
                  <label class="block text-sm mb-1">Широта</label>
                  <Dropdown
                    v-model="ds.latReqId"
                    :options="reqsOfPointsList.length ? reqsOfPointsList : reqsOfObjectsList"
                    option-label="label"
                    option-value="value"
                    :loading="loadingPointReqs || loadingObjectReqs"
                    :placeholder="(loadingPointReqs || loadingObjectReqs) ? 'Загрузка...' : 'Выберите поле'"
                    class="w-full"
                    :show-clear="true"
                    filter
                  >
                    <template #option="{ option }">
                      <div class="flex justify-content-between w-full">
                        <span>{{ option.label }}</span>
                        <span class="text-color-secondary text-sm ml-2">{{ option.value }}</span>
                      </div>
                    </template>
                    <template #value="{ value }">
                      <span v-if="value">
                        {{ (reqsOfPointsList.length ? reqsOfPointsList : reqsOfObjectsList).find(r => r.value === value)?.label || `ID: ${value}` }}
                      </span>
                      <span v-else class="text-color-secondary">Широта</span>
                    </template>
                  </Dropdown>
                </div>
                <div class="col-6">
                  <label class="block text-sm mb-1">Долгота</label>
                  <Dropdown
                    v-model="ds.lngReqId"
                    :options="reqsOfPointsList.length ? reqsOfPointsList : reqsOfObjectsList"
                    option-label="label"
                    option-value="value"
                    :loading="loadingPointReqs || loadingObjectReqs"
                    :placeholder="(loadingPointReqs || loadingObjectReqs) ? 'Загрузка...' : 'Выберите поле'"
                    class="w-full"
                    :show-clear="true"
                    filter
                  >
                    <template #option="{ option }">
                      <div class="flex justify-content-between w-full">
                        <span>{{ option.label }}</span>
                        <span class="text-color-secondary text-sm ml-2">{{ option.value }}</span>
                      </div>
                    </template>
                    <template #value="{ value }">
                      <span v-if="value">
                        {{ (reqsOfPointsList.length ? reqsOfPointsList : reqsOfObjectsList).find(r => r.value === value)?.label || `ID: ${value}` }}
                      </span>
                      <span v-else class="text-color-secondary">Долгота</span>
                    </template>
                  </Dropdown>
                </div>
              </div>
            </div>

            <!-- Marker type / Radius / Height requisite IDs -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-sliders-v mr-2"></i>Поля типа и параметров объектов
              </label>
              <div class="grid">
                <div class="col-4">
                  <label class="block text-sm mb-1">Тип объекта</label>
                  <Dropdown
                    v-model="ds.markerTypeReqId"
                    :options="reqsOfObjectsList"
                    option-label="label"
                    option-value="value"
                    :loading="loadingObjectReqs"
                    :placeholder="loadingObjectReqs ? 'Загрузка...' : 'Тип (Точка/Линия…)'"
                    class="w-full"
                    :show-clear="true"
                    filter
                  >
                    <template #option="{ option }">
                      <div class="flex justify-content-between w-full">
                        <span>{{ option.label }}</span>
                        <span class="text-color-secondary text-sm ml-2">{{ option.value }}</span>
                      </div>
                    </template>
                    <template #value="{ value }">
                      <span v-if="value">{{ reqsOfObjectsList.find(r => r.value === value)?.label || `ID: ${value}` }}</span>
                      <span v-else class="text-color-secondary">Тип объекта</span>
                    </template>
                  </Dropdown>
                </div>
                <div class="col-4">
                  <label class="block text-sm mb-1">Радиус, км</label>
                  <Dropdown
                    v-model="ds.radiusReqId"
                    :options="reqsOfObjectsList"
                    option-label="label"
                    option-value="value"
                    :loading="loadingObjectReqs"
                    :placeholder="loadingObjectReqs ? 'Загрузка...' : 'Поле радиуса'"
                    class="w-full"
                    :show-clear="true"
                    filter
                  >
                    <template #option="{ option }">
                      <div class="flex justify-content-between w-full">
                        <span>{{ option.label }}</span>
                        <span class="text-color-secondary text-sm ml-2">{{ option.value }}</span>
                      </div>
                    </template>
                    <template #value="{ value }">
                      <span v-if="value">{{ reqsOfObjectsList.find(r => r.value === value)?.label || `ID: ${value}` }}</span>
                      <span v-else class="text-color-secondary">Радиус (км)</span>
                    </template>
                  </Dropdown>
                </div>
                <div class="col-4">
                  <label class="block text-sm mb-1">Высота, м</label>
                  <Dropdown
                    v-model="ds.heightReqId"
                    :options="reqsOfObjectsList"
                    option-label="label"
                    option-value="value"
                    :loading="loadingObjectReqs"
                    :placeholder="loadingObjectReqs ? 'Загрузка...' : 'Поле высоты'"
                    class="w-full"
                    :show-clear="true"
                    filter
                  >
                    <template #option="{ option }">
                      <div class="flex justify-content-between w-full">
                        <span>{{ option.label }}</span>
                        <span class="text-color-secondary text-sm ml-2">{{ option.value }}</span>
                      </div>
                    </template>
                    <template #value="{ value }">
                      <span v-if="value">{{ reqsOfObjectsList.find(r => r.value === value)?.label || `ID: ${value}` }}</span>
                      <span v-else class="text-color-secondary">Высота (м)</span>
                    </template>
                  </Dropdown>
                </div>
              </div>
              <small class="text-color-secondary block mt-1">
                Тип объекта: справочник «Точка / Линия / Полигон / Высотный объект».
                Радиус — числовое поле (км), Высота — числовое поле (м).
              </small>
            </div>

            <!-- Coordinate format -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">Формат координат</label>
              <Dropdown
                v-model="ds.coordFormat"
                :options="coordFormatOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <!-- Parent Object Filter -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-filter mr-2"></i>Фильтр по родителю (опционально)
              </label>
              <InputNumber
                v-model="ds.parentObjectId"
                placeholder="ID родительского объекта"
                class="w-full"
                :use-grouping="false"
              />
              <small class="text-color-secondary block mt-1">
                Загружать точки только для конкретного объекта
              </small>
            </div>

            <!-- Selector Filter -->
            <div class="field mb-3">
              <label class="block font-semibold mb-2">
                <i class="pi pi-sliders-h mr-2"></i>Фильтр по Selector
              </label>
              <div class="grid">
                <div class="col-6">
                  <InputText
                    v-model="ds.selectorName"
                    placeholder="Имя Selector'а"
                    class="w-full"
                  />
                  <small class="text-color-secondary block mt-1">Атрибут name у блока Selector</small>
                </div>
                <div class="col-6">
                  <InputText
                    v-model="ds.selectorReqId"
                    placeholder="ID поля или __val__"
                    class="w-full"
                  />
                  <small class="text-color-secondary block mt-1">Поле для фильтрации (reqId или __val__)</small>
                </div>
              </div>
              <small v-if="ds.selectorName" class="text-blue-500 block mt-1">
                <i class="pi pi-info-circle mr-1"></i>Карта будет фильтроваться когда Selector «{{ ds.selectorName }}» активен
              </small>
            </div>

            <!-- Test load button -->
            <div class="flex gap-2 mb-3">
              <Button
                label="Загрузить данные"
                icon="pi pi-download"
                :loading="loadingData"
                @click="handleLoadData"
              />
              <span v-if="loadedCount !== null" class="flex align-items-center text-sm">
                <i class="pi pi-check-circle text-green-500 mr-1"></i>
                Загружено точек: {{ loadedCount }}
              </span>
            </div>

            <!-- Error message -->
            <div v-if="loadError" class="p-3 mb-3 border-round status-error text-sm">
              <i class="pi pi-exclamation-triangle mr-1"></i>
              {{ loadError }}
            </div>
          </template>

          <div v-else class="text-center p-4 text-color-secondary">
            <i class="pi pi-database text-4xl mb-2" style="display:block;"></i>
            <p class="m-0">Включите переключатель для подключения к базе данных Integram.</p>
            <p class="m-0 mt-1 text-sm">Карта будет загружать маркеры из таблицы с координатами.</p>
          </div>
        </TabPanel>

        <!-- Tab 3: Cadastral boundaries -->
        <TabPanel header="Кадастр">
          <!-- Load from database -->
          <div v-if="dataSourceEnabled && ds.objectsTypeId" class="field mb-4">
            <label class="block font-semibold mb-2">
              <i class="pi pi-database mr-2"></i>Загрузить из базы данных
            </label>
            <div class="flex gap-2 mb-2">
              <Dropdown
                v-model="selectedCadastralTable"
                :options="cadastralSubTables"
                option-label="label"
                option-value="value"
                :loading="loadingCadastralSubTables"
                :placeholder="cadastralSubTables.length ? 'Выберите подтаблицу' : 'Нажмите обновить'"
                class="flex-grow-1"
                :show-clear="true"
              >
                <template #option="{ option }">
                  <div class="flex justify-content-between w-full">
                    <span>{{ option.label }}</span>
                    <span class="text-color-secondary text-sm ml-2">ID: {{ option.value }}</span>
                  </div>
                </template>
              </Dropdown>
              <Button
                icon="pi pi-refresh"
                :loading="loadingCadastralSubTables"
                size="small"
                title="Загрузить подтаблицы"
                @click="handleLoadCadastralSubTables"
              />
            </div>
            <div class="flex gap-2 mb-3">
              <Button
                label="Загрузить из БД"
                icon="pi pi-database"
                :loading="loadingCadastralFromDb"
                :disabled="!selectedCadastralTable"
                size="small"
                @click="handleLoadCadastralFromDb"
              />
              <small class="flex align-items-center text-color-secondary">
                {{ ds.database }} / {{ getTableLabel(ds.objectsTypeId) }}
              </small>
            </div>
          </div>
          <div v-else class="p-3 mb-4 border-round surface-ground text-sm text-color-secondary">
            <i class="pi pi-info-circle mr-1"></i>
            Для загрузки из БД сначала настройте источник данных (таб "Источник данных").
          </div>

          <!-- Manual input -->
          <div class="field mb-3">
            <label class="block font-semibold mb-2">
              <i class="pi pi-pencil mr-2"></i>Или введите вручную
            </label>
            <textarea
              v-model="cadastralText"
              class="w-full p-inputtext p-component"
              rows="4"
              placeholder="Кадастровые номера (по одному на строку):&#10;38:07:020104:1&#10;38:07:020104:2"
              style="resize: vertical; font-family: monospace;"
            ></textarea>
          </div>

          <div class="flex gap-2 mb-3 align-items-center">
            <Button
              label="Загрузить границы"
              icon="pi pi-download"
              :loading="loadingCadastral"
              :disabled="!cadastralText?.trim()"
              @click="handleLoadCadastral"
            />
            <span v-if="cadastralLoadedCount !== null" class="text-sm">
              <i class="pi pi-check-circle text-green-500 mr-1"></i>
              Загружено полигонов: {{ cadastralLoadedCount }}
            </span>
          </div>

          <!-- Results -->
          <div v-if="cadastralResults.length > 0" class="mb-3">
            <div class="text-sm font-semibold mb-2">Результаты:</div>
            <div
              v-for="r in cadastralResults"
              :key="r.cadastralNumber"
              class="p-2 mb-1 border-round text-sm"
              :class="r.hasGeometry ? 'status-success' : (r.found ? 'status-warning' : 'status-error')"
            >
              <i :class="r.hasGeometry ? 'pi pi-check-circle' : (r.found ? 'pi pi-exclamation-circle' : 'pi pi-times-circle')" class="mr-1"></i>
              <strong>{{ r.cadastralNumber }}</strong>
              <span v-if="r.address" class="ml-2">{{ r.address }}</span>
              <span v-if="r.area" class="ml-2">({{ r.area }} m²)</span>
              <span v-if="r.error" class="ml-2">{{ r.error }}</span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="cadastralError" class="p-3 mb-3 border-round status-error text-sm">
            <i class="pi pi-exclamation-triangle mr-1"></i>
            {{ cadastralError }}
          </div>

          <div class="p-3 border-round surface-ground text-sm text-color-secondary">
            <i class="pi pi-info-circle mr-1"></i>
            Границы загружаются из Публичной кадастровой карты (ПКК Росреестр).
            Полигоны будут отображены на карте синим цветом.
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="flex justify-content-end gap-2">
        <Button
          label="Отмена"
          icon="pi pi-times"
          outlined
          @click="handleCancel"
        />
        <Button
          label="Применить"
          icon="pi pi-check"
          @click="handleApply"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputSwitch from 'primevue/inputswitch'
import Dropdown from 'primevue/dropdown'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import integramApiClient from '@/services/integramApiClient'
import * as docBlocksApi from '@/services/docBlocksApiService'
// Services are dynamically imported where used to avoid chunk conflicts with BlockDocumentEditor.vue

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  initialConfig: {
    type: Object,
    default: () => ({
      center: { lat: 55.7558, lng: 37.6173 },
      zoom: 10,
      markers: [],
      height: 300,
      title: '',
      dataSource: null
    })
  },
  isEditMode: {
    type: Boolean,
    default: false
  },
  database: {
    type: String,
    default: 'kval'
  }
})

const emit = defineEmits(['update:modelValue', 'apply', 'cancel'])

// State
const visible = ref(props.modelValue)
const config = ref(normalizeConfig(props.initialConfig))
const activeTab = ref(0)

// Data source state
const dataSourceEnabled = ref(!!props.initialConfig?.dataSource)
const ds = ref(normalizeDataSource(props.initialConfig?.dataSource))
const discovering = ref(false)
const discoverResult = ref(null)
const discoverMessage = ref('')
const loadingData = ref(false)
const loadedCount = ref(null)
const loadError = ref(null)

// Tables list for dropdown
const tablesList = ref([])
const loadingTables = ref(false)

// Sub-tables and requisites for field dropdowns
const subTablesList = ref([])       // Sub-tables of objectsTypeId (for pointsTypeId / intermediateTypeId)
const loadingSubTables = ref(false)
const reqsOfObjectsList = ref([])   // Requisites of objectsTypeId (for markerTypeReqId, radiusReqId, heightReqId)
const loadingObjectReqs = ref(false)
const reqsOfPointsList = ref([])    // Requisites of pointsTypeId (for latReqId, lngReqId)
const loadingPointReqs = ref(false)

// Cadastral state
const cadastralText = ref('')
const loadingCadastral = ref(false)
const cadastralLoadedCount = ref(null)
const cadastralResults = ref([])
const cadastralError = ref(null)
const cadastralSubTables = ref([])
const selectedCadastralTable = ref(null)
const loadingCadastralFromDb = ref(false)
const loadingCadastralSubTables = ref(false)

// Options
const markerColors = [
  { label: 'Красный', value: '#ff0000' },
  { label: 'Синий', value: '#0066ff' },
  { label: 'Зелёный', value: '#00cc44' },
  { label: 'Оранжевый', value: '#ff8800' },
  { label: 'Фиолетовый', value: '#9900cc' }
]

const heightOptions = [
  { label: '200px - Компактная', value: 200 },
  { label: '300px - Средняя', value: 300 },
  { label: '400px - Большая', value: 400 },
  { label: '500px - Очень большая', value: 500 }
]

const coordFormatOptions = [
  { label: 'Авто-определение', value: 'auto' },
  { label: 'Десятичные градусы (55.7558)', value: 'decimal' },
  { label: 'Градусы-минуты-секунды (56\u00B004\'40")', value: 'dms' }
]

function normalizeDataSource(raw) {
  return {
    database: raw?.database || props.database || 'kval',
    objectsTypeId: raw?.objectsTypeId || null,
    pointsTypeId: raw?.pointsTypeId || null,
    intermediateTypeId: raw?.intermediateTypeId || null,
    latReqId: raw?.latReqId || null,
    lngReqId: raw?.lngReqId || null,
    parentObjectId: raw?.parentObjectId || null,
    coordFormat: raw?.coordFormat || 'auto',
    selectorName: raw?.selectorName || null,
    selectorReqId: raw?.selectorReqId || null,
    markerTypeReqId: raw?.markerTypeReqId || null,
    radiusReqId: raw?.radiusReqId || null,
    heightReqId: raw?.heightReqId || null
  }
}

function normalizeConfig(raw) {
  const cfg = { ...raw }

  if (Array.isArray(cfg.center)) {
    cfg.center = { lat: cfg.center[0], lng: cfg.center[1] }
  }
  if (!cfg.center || typeof cfg.center.lat !== 'number') {
    cfg.center = { lat: 55.7558, lng: 37.6173 }
  }

  cfg.markers = (cfg.markers || []).map(m => {
    if (m.latlng) {
      return { lat: m.latlng[0], lng: m.latlng[1], color: m.color || '#ff0000' }
    }
    return { lat: m.lat ?? 0, lng: m.lng ?? 0, color: m.color || '#ff0000', label: m.label || '' }
  })

  cfg.zoom = cfg.zoom || 10
  cfg.height = cfg.height || 300
  cfg.title = cfg.title || ''
  cfg.polygons = cfg.polygons || []

  return cfg
}

/** Load tables list from Integram dictionary */
async function handleLoadTables() {
  const db = ds.value.database
  if (!db) return

  loadingTables.value = true
  tablesList.value = []

  try {
    // Try backend proxy first (docBlocksApi.getTables)
    let tables = {}
    try {
      const response = await docBlocksApi.getTables(db)
      tables = response.tables || {}
    } catch (_) {
      // Fallback: direct Integram API
      if (integramApiClient.currentDatabase !== db) {
        await integramApiClient.switchDatabase(db)
      }
      const dictData = await integramApiClient.getDictionary()
      // Parse dictionary response — format varies
      if (dictData && dictData.dict_type) {
        const ids = dictData.dict_type.id || []
        const names = dictData.dict_type.val || []
        for (let i = 0; i < ids.length; i++) {
          tables[ids[i]] = names[i] || `Table ${ids[i]}`
        }
      }
    }

    tablesList.value = Object.entries(tables)
      .map(([id, name]) => ({
        label: String(name),
        value: parseInt(id),
        idStr: String(id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  } catch (err) {
    console.error('Failed to load tables:', err)
    loadError.value = 'Не удалось загрузить список таблиц: ' + err.message
  } finally {
    loadingTables.value = false
  }
}

/** Get table label by ID from loaded list */
function getTableLabel(typeId) {
  const found = tablesList.value.find(t => t.value === typeId)
  return found ? found.label : `Table ${typeId}`
}

/** When table selected from dropdown — auto-discover and reload sub-tables/reqs */
function onTableSelected() {
  // Reset discovered fields when table changes
  discoverResult.value = null
  discoverMessage.value = ''
  ds.value.pointsTypeId = null
  ds.value.intermediateTypeId = null
  ds.value.latReqId = null
  ds.value.lngReqId = null
  ds.value.markerTypeReqId = null
  ds.value.radiusReqId = null
  ds.value.heightReqId = null
  subTablesList.value = []
  reqsOfObjectsList.value = []
  reqsOfPointsList.value = []
  if (ds.value.objectsTypeId) {
    loadSubTables(ds.value.objectsTypeId)
    loadObjectReqs(ds.value.objectsTypeId)
  }
}

/** Load sub-tables of objectsTypeId for pointsTypeId / intermediateTypeId dropdowns */
async function loadSubTables(typeId) {
  if (!typeId || !ds.value.database) return
  loadingSubTables.value = true
  subTablesList.value = []
  try {
    const db = ds.value.database
    if (integramApiClient.currentDatabase !== db) {
      await integramApiClient.switchDatabase(db)
    }
    const metadata = await integramApiClient.getTypeMetadata(typeId)
    const reqs = metadata.reqs || []
    subTablesList.value = reqs
      .filter(req => req.arr_id)
      .map(req => ({
        label: (req.val || `Подтаблица ${req.arr_id}`).replace(/<[^>]*>/g, '').trim(),
        value: parseInt(req.arr_id),
        idStr: String(req.arr_id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  } catch (err) {
    console.error('[MapBlockConfig] Failed to load sub-tables:', err)
  } finally {
    loadingSubTables.value = false
  }
}

/** Load requisites of objectsTypeId for markerTypeReqId / radiusReqId / heightReqId dropdowns */
async function loadObjectReqs(typeId) {
  if (!typeId || !ds.value.database) return
  loadingObjectReqs.value = true
  reqsOfObjectsList.value = []
  try {
    const db = ds.value.database
    if (integramApiClient.currentDatabase !== db) {
      await integramApiClient.switchDatabase(db)
    }
    const metadata = await integramApiClient.getTypeMetadata(typeId)
    const reqs = metadata.reqs || []
    reqsOfObjectsList.value = reqs
      .filter(req => !req.arr_id) // Only leaf requisites, not sub-table links
      .map(req => ({
        label: (req.val || `Реквизит ${req.id}`).replace(/<[^>]*>/g, '').trim(),
        value: parseInt(req.id),
        idStr: String(req.id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  } catch (err) {
    console.error('[MapBlockConfig] Failed to load object requisites:', err)
  } finally {
    loadingObjectReqs.value = false
  }
}

/** Load requisites of pointsTypeId for latReqId / lngReqId dropdowns */
async function loadPointReqs(typeId) {
  if (!typeId || !ds.value.database) return
  loadingPointReqs.value = true
  reqsOfPointsList.value = []
  try {
    const db = ds.value.database
    if (integramApiClient.currentDatabase !== db) {
      await integramApiClient.switchDatabase(db)
    }
    const metadata = await integramApiClient.getTypeMetadata(typeId)
    const reqs = metadata.reqs || []
    reqsOfPointsList.value = reqs
      .filter(req => !req.arr_id)
      .map(req => ({
        label: (req.val || `Реквизит ${req.id}`).replace(/<[^>]*>/g, '').trim(),
        value: parseInt(req.id),
        idStr: String(req.id)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  } catch (err) {
    console.error('[MapBlockConfig] Failed to load point requisites:', err)
  } finally {
    loadingPointReqs.value = false
  }
}

// Watch visibility
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal) {
    config.value = normalizeConfig(props.initialConfig)
    dataSourceEnabled.value = !!props.initialConfig?.dataSource
    ds.value = normalizeDataSource(props.initialConfig?.dataSource)
    discoverResult.value = null
    loadedCount.value = null
    loadError.value = null
    // Restore cadastral data source
    selectedCadastralTable.value = props.initialConfig?.cadastralDataSource?.cadastralTypeId || null
    cadastralText.value = ''
    cadastralResults.value = []
    cadastralLoadedCount.value = null
    cadastralError.value = null
    // Auto-load tables when opening with data source enabled
    if (dataSourceEnabled.value && ds.value.database && tablesList.value.length === 0) {
      handleLoadTables()
    }
    // Load sub-tables and reqs for already-configured typeIds
    if (dataSourceEnabled.value && ds.value.objectsTypeId) {
      loadSubTables(ds.value.objectsTypeId)
      loadObjectReqs(ds.value.objectsTypeId)
    }
    if (dataSourceEnabled.value && ds.value.pointsTypeId) {
      loadPointReqs(ds.value.pointsTypeId)
    }
  }
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// Auto-load tables when data source is enabled
watch(dataSourceEnabled, (newVal) => {
  if (newVal && ds.value.database && tablesList.value.length === 0) {
    handleLoadTables()
  }
})

// Load sub-tables and object requisites when objectsTypeId changes
watch(() => ds.value.objectsTypeId, (newTypeId) => {
  subTablesList.value = []
  reqsOfObjectsList.value = []
  if (newTypeId) {
    loadSubTables(newTypeId)
    loadObjectReqs(newTypeId)
  }
})

// Load point requisites when pointsTypeId changes
watch(() => ds.value.pointsTypeId, (newTypeId) => {
  reqsOfPointsList.value = []
  if (newTypeId) {
    loadPointReqs(newTypeId)
  }
})

// Auto-load cadastral sub-tables when switching to Кадастр tab (index 2)
watch(activeTab, (newTab) => {
  if (newTab === 2 && dataSourceEnabled.value && ds.value.objectsTypeId && cadastralSubTables.value.length === 0) {
    handleLoadCadastralSubTables()
  }
})

// Marker operations
function addMarker() {
  config.value.markers.push({
    lat: config.value.center.lat,
    lng: config.value.center.lng,
    color: '#ff0000'
  })
}

function removeMarker(index) {
  config.value.markers.splice(index, 1)
}

// Auto-discover coordinate fields
async function handleDiscover() {
  if (!ds.value.objectsTypeId) return

  discovering.value = true
  discoverResult.value = null
  discoverMessage.value = ''
  loadError.value = null

  try {
    // Ensure correct database before discovering fields
    const db = ds.value.database
    if (db && integramApiClient.currentDatabase !== db) {
      await integramApiClient.switchDatabase(db)
    }

    const { deepDiscoverCoordinateFields } = await import('@/services/integramMapDataService')
    const result = await deepDiscoverCoordinateFields(ds.value.objectsTypeId)
    discoverResult.value = result

    if (result.found) {
      // Auto-fill discovered fields
      ds.value.pointsTypeId = result.pointsTypeId
      ds.value.intermediateTypeId = result.intermediateTypeId
      ds.value.latReqId = result.latReqId
      ds.value.lngReqId = result.lngReqId
      // Load point requisites for lat/lng dropdowns
      if (result.pointsTypeId) loadPointReqs(result.pointsTypeId)

      const pathStr = result.path.map(p => p.name).join(' \u2192 ')
      discoverMessage.value = `Найдены координаты: ${pathStr}`
    } else {
      discoverMessage.value = 'Координаты не найдены автоматически. Укажите ID полей вручную.'
      if (result.subTypes && result.subTypes.length > 0) {
        discoverMessage.value += ` Подтаблицы: ${result.subTypes.map(s => s.name + ' (' + s.typeId + ')').join(', ')}`
      }
    }
  } catch (err) {
    discoverMessage.value = 'Ошибка: ' + err.message
    discoverResult.value = { found: false }
  } finally {
    discovering.value = false
  }
}

// Load data from database
async function handleLoadData() {
  if (!ds.value.objectsTypeId || !ds.value.latReqId || !ds.value.lngReqId) {
    loadError.value = 'Выберите таблицу объектов и укажите поля координат (широта/долгота)'
    return
  }

  loadingData.value = true
  loadedCount.value = null
  loadError.value = null

  try {
    const { loadMapMarkers } = await import('@/services/integramMapDataService')
    const markers = await loadMapMarkers(ds.value)
    loadedCount.value = markers.length

    if (markers.length > 0) {
      config.value.markers = markers.map(m => ({
        lat: m.lat,
        lng: m.lng,
        color: m.color || '#ff0000',
        label: m.label || '',
        objectId: m.objectId,
        parentId: m.parentId
      }))

      config.value.center = { lat: markers[0].lat, lng: markers[0].lng }
      config.value.zoom = 14

      if (markers.length > 1) {
        const lats = markers.map(m => m.lat)
        const lngs = markers.map(m => m.lng)
        const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))

        config.value.center = {
          lat: (Math.min(...lats) + Math.max(...lats)) / 2,
          lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
        }

        if (span > 10) config.value.zoom = 5
        else if (span > 5) config.value.zoom = 7
        else if (span > 1) config.value.zoom = 9
        else if (span > 0.1) config.value.zoom = 12
        else if (span > 0.01) config.value.zoom = 14
        else config.value.zoom = 16
      }
    }
  } catch (err) {
    loadError.value = err.message || 'Ошибка загрузки данных'
  } finally {
    loadingData.value = false
  }
}

// Load sub-tables for cadastral number selection
async function handleLoadCadastralSubTables() {
  if (!ds.value.objectsTypeId || !ds.value.database) {
    cadastralError.value = 'Сначала настройте источник данных (таб "Источник данных"): выберите базу и таблицу объектов'
    return
  }

  loadingCadastralSubTables.value = true
  cadastralSubTables.value = []
  cadastralError.value = null

  try {
    const db = ds.value.database
    if (integramApiClient.currentDatabase !== db) {
      await integramApiClient.switchDatabase(db)
    }

    const metadata = await integramApiClient.getTypeMetadata(ds.value.objectsTypeId)
    const reqs = metadata.reqs || []

    // Collect sub-tables (requisites with arr_id)
    const subTables = reqs
      .filter(req => req.arr_id)
      .map(req => ({
        label: (req.val || `Подтаблица ${req.id}`).replace(/<[^>]*>/g, '').trim(),
        value: parseInt(req.arr_id),
        reqId: parseInt(req.id)
      }))

    cadastralSubTables.value = subTables

    if (subTables.length === 0) {
      cadastralError.value = 'У выбранной таблицы нет подтаблиц'
    }
  } catch (err) {
    cadastralError.value = 'Ошибка загрузки подтаблиц: ' + err.message
  } finally {
    loadingCadastralSubTables.value = false
  }
}

// Load cadastral numbers from DB sub-table
async function handleLoadCadastralFromDb() {
  if (!selectedCadastralTable.value) {
    cadastralError.value = 'Выберите подтаблицу с кадастровыми номерами'
    return
  }

  loadingCadastralFromDb.value = true
  cadastralError.value = null

  try {
    const { loadCadastralNumbers } = await import('@/services/integramMapDataService')
    const numbers = await loadCadastralNumbers({
      database: ds.value.database,
      objectsTypeId: ds.value.objectsTypeId,
      cadastralTypeId: selectedCadastralTable.value,
      parentObjectId: ds.value.parentObjectId
    })

    if (numbers.length === 0) {
      cadastralError.value = 'Кадастровые номера не найдены в выбранной подтаблице'
      return
    }

    // Populate textarea and auto-load boundaries
    cadastralText.value = numbers.join('\n')
    await handleLoadCadastral()
  } catch (err) {
    cadastralError.value = 'Ошибка загрузки из БД: ' + err.message
  } finally {
    loadingCadastralFromDb.value = false
  }
}

// Load cadastral boundaries
async function handleLoadCadastral() {
  const { parseCadastralNumbers, fetchCadastralBoundaries } = await import('@/services/cadastralService')
  const numbers = parseCadastralNumbers(cadastralText.value)
  if (numbers.length === 0) {
    cadastralError.value = 'Не найдено корректных кадастровых номеров. Формат: XX:XX:XXXXXXX:X'
    return
  }

  loadingCadastral.value = true
  cadastralLoadedCount.value = null
  cadastralResults.value = []
  cadastralError.value = null

  try {
    const data = await fetchCadastralBoundaries(numbers)
    cadastralResults.value = data.results || []
    cadastralLoadedCount.value = data.polygons.length

    if (data.polygons.length > 0) {
      // Merge cadastral polygons into config
      const existing = (config.value.polygons || []).filter(p => !p.id?.startsWith('cadastral-'))
      config.value.polygons = [...existing, ...data.polygons]

      // Auto-center on first polygon
      const firstPoint = data.polygons[0].points[0]
      if (firstPoint) {
        config.value.center = { lat: firstPoint.lat, lng: firstPoint.lng }
        config.value.zoom = 15
      }

      // Fit all polygon bounds
      if (data.polygons.length > 0) {
        const allPoints = data.polygons.flatMap(p => p.points)
        const lats = allPoints.map(p => p.lat)
        const lngs = allPoints.map(p => p.lng)
        config.value.center = {
          lat: (Math.min(...lats) + Math.max(...lats)) / 2,
          lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
        }
        const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
        if (span > 1) config.value.zoom = 9
        else if (span > 0.1) config.value.zoom = 12
        else if (span > 0.01) config.value.zoom = 15
        else config.value.zoom = 17
      }
    }
  } catch (err) {
    cadastralError.value = err.message || 'Ошибка загрузки кадастровых границ'
  } finally {
    loadingCadastral.value = false
  }
}

// Apply
function handleApply() {
  const result = {
    center: { ...config.value.center },
    zoom: config.value.zoom,
    markers: config.value.markers.map(m => ({ ...m })),
    polygons: config.value.polygons || [],
    curves: [],
    height: config.value.height,
    title: config.value.title,
    dataSource: dataSourceEnabled.value ? { ...ds.value } : null,
    cadastralDataSource: selectedCadastralTable.value ? {
      cadastralTypeId: selectedCadastralTable.value
    } : null
  }
  emit('apply', result)
  visible.value = false
}

// Cancel
function handleCancel() {
  emit('cancel')
  visible.value = false
}
</script>

<style scoped>
.map-config-content {
  max-height: 70vh;
  overflow-y: auto;
}

.markers-list {
  max-height: 300px;
  overflow-y: auto;
}

.marker-item {
  background: var(--p-surface-100, #f4f4f5);
  transition: background 0.2s, border-color 0.2s;
}

.marker-item:hover {
  background: var(--surface-hover);
  border-color: var(--primary-color) !important;
}

.app-dark .marker-item {
  background: var(--p-surface-800, #27272a);
}

.app-dark .marker-item:hover {
  background: var(--p-surface-700, #3f3f46);
}

/* Theme-adaptive status indicators */
.status-success {
  background: rgba(16, 185, 129, 0.12);
  color: var(--p-green-600, #16a34a);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-warning {
  background: rgba(234, 179, 8, 0.12);
  color: var(--p-amber-700, #a16207);
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.status-error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--p-red-600, #dc2626);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.app-dark .status-success {
  color: var(--p-green-300, #86efac);
}

.app-dark .status-warning {
  color: var(--p-amber-200, #fde68a);
}

.app-dark .status-error {
  color: var(--p-red-300, #fca5a5);
}

:deep(.p-inputnumber) {
  display: flex;
  width: 100%;
}

:deep(.p-inputnumber-input) {
  flex: 1;
}
</style>
