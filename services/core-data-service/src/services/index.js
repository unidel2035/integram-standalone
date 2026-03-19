/**
 * @integram/core-data-service - Services Index
 *
 * 23 сервиса — полная микросхема памяти для AI-агентов.
 *
 * Слои:
 *   Данные:    Object, Query, Schema, Type, Validation, Batch, Transaction
 *   Поиск:     Search (text+vector), Vector (cosine), AutoEmbedding
 *   Связи:     Link (ассоциации), Ontology (RDF/OWL)
 *   Время:     Temporal (версии), Event (события), Audit (аудит)
 *   Память:    UnifiedMemory (единый API), Narrative (рассказы), SemanticField (поле агента)
 *   Мечта:     MemoryConsolidation (сон), EmotionalWeight (важность), Multimodal (картинки/звук)
 *   Сеть:      MemoryFederation (синхронизация), RealtimeSubscriptions (подписки)
 */

// ── Данные ───────────────────────────────────────────────────────────────────
import { ObjectService } from './ObjectService.js';
import { QueryService } from './QueryService.js';
import { SchemaService } from './SchemaService.js';
import { TypeService } from './TypeService.js';
import { ValidationService } from './ValidationService.js';
import { TransactionService } from './TransactionService.js';
import { BatchService } from './BatchService.js';

// ── Поиск ────────────────────────────────────────────────────────────────────
import { SearchService } from './SearchService.js';
import { VectorService } from './VectorService.js';
import { AutoEmbeddingHook } from './AutoEmbeddingHook.js';

// ── Связи ────────────────────────────────────────────────────────────────────
import { LinkService } from './LinkService.js';
import { OntologyService } from './OntologyService.js';

// ── Время ────────────────────────────────────────────────────────────────────
import { TemporalService } from './TemporalService.js';
import { EventService } from './EventService.js';
import { AuditService } from './AuditService.js';

// ── Память ───────────────────────────────────────────────────────────────────
import { UnifiedMemoryService } from './UnifiedMemoryService.js';
import { NarrativeMemory } from './NarrativeMemory.js';
import { SemanticField } from './SemanticField.js';

// ── Мечта ────────────────────────────────────────────────────────────────────
import { MemoryConsolidation } from './MemoryConsolidation.js';
import { EmotionalWeight } from './EmotionalWeight.js';
import { MultimodalMemory } from './MultimodalMemory.js';

// ── Сеть ─────────────────────────────────────────────────────────────────────
import { MemoryFederation } from './MemoryFederation.js';
import { RealtimeSubscriptions } from './RealtimeSubscriptions.js';

// ── Экспорт ──────────────────────────────────────────────────────────────────
export { ObjectService } from './ObjectService.js';
export { QueryService } from './QueryService.js';
export { SchemaService } from './SchemaService.js';
export { TypeService } from './TypeService.js';
export { ValidationService } from './ValidationService.js';
export { TransactionService, TRANSACTION_ACTIONS, TX_STATUS } from './TransactionService.js';
export { BatchService } from './BatchService.js';
export { SearchService } from './SearchService.js';
export { VectorService } from './VectorService.js';
export { AutoEmbeddingHook } from './AutoEmbeddingHook.js';
export { LinkService } from './LinkService.js';
export { OntologyService } from './OntologyService.js';
export { TemporalService } from './TemporalService.js';
export { EventService, EVENT_ACTIONS } from './EventService.js';
export { AuditService, AUDIT_ACTIONS } from './AuditService.js';
export { UnifiedMemoryService } from './UnifiedMemoryService.js';
export { NarrativeMemory } from './NarrativeMemory.js';
export { SemanticField } from './SemanticField.js';
export { MemoryConsolidation } from './MemoryConsolidation.js';
export { EmotionalWeight } from './EmotionalWeight.js';
export { MultimodalMemory } from './MultimodalMemory.js';
export { MemoryFederation } from './MemoryFederation.js';
export { RealtimeSubscriptions } from './RealtimeSubscriptions.js';

export default {
  // Данные
  ObjectService, QueryService, SchemaService, TypeService, ValidationService, TransactionService, BatchService,
  // Поиск
  SearchService, VectorService, AutoEmbeddingHook,
  // Связи
  LinkService, OntologyService,
  // Время
  TemporalService, EventService, AuditService,
  // Память
  UnifiedMemoryService, NarrativeMemory, SemanticField,
  // Мечта
  MemoryConsolidation, EmotionalWeight, MultimodalMemory,
  // Сеть
  MemoryFederation, RealtimeSubscriptions,
};
