import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Постоянный список ручных ключевых слов на компанию для чекера позиций
// (см. docs/refactor-plans/position-checker.md, коммит 1) — переиспользуется
// при каждой проверке без повторного ввода. Авто-ключевое слово из категории
// карточки сюда никогда не пишется — читается заново при каждой проверке
// (см. Decision Document плана).
@Entity('tracked_keywords')
export class TrackedKeyword {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  keyword!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
