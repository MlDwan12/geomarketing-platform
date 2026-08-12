import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Снимок результата проверки позиции компании в выдаче 2ГИС/Яндекса по
// одному ключевому слову (см. docs/refactor-plans/position-checker.md,
// коммит 2). История, не перезапись — на одну companyId+keyword много строк
// во времени, это и есть сама цель фичи (тренд), не побочный эффект. position
// — индекс совпадения в топ-10 выдачи (0 — первое место), null — не найдено
// в топ-10 (см. Decision Document плана — не 0, не sentinel).
@Entity('position_check_results')
export class PositionCheckResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  keyword!: string;

  // 'auto' — слово взято из card.fields.mainCategory на момент проверки,
  // 'manual' — слово из TrackedKeyword. Хранится на каждой записи истории
  // (не на TrackedKeyword — та сущность только про ручные слова).
  @Column({ type: 'text' })
  source!: 'auto' | 'manual';

  @Column({ type: 'text' })
  provider!: '2gis' | 'yandex';

  @Column({ type: 'int', nullable: true })
  position!: number | null;

  @CreateDateColumn()
  checkedAt!: Date;
}
