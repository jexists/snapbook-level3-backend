import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Reservation } from '../reservations/reservation.entity.js';

export type AiNoteStatus = 'done' | 'failed' | 'no_key';

/** GPT가 손님 요청 글을 정리한 결과 */
export interface AiNoteContent {
  purpose: string;
  mood: string;
  outfit: string;
  cautions: string;
  checklist: string[];
}

@Entity('ai_notes')
export class AiNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reservation_id', type: 'integer' })
  reservationId: number;

  @OneToOne('Reservation', (reservation: Reservation) => reservation.aiNote, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @Column({ type: 'varchar', length: 10 })
  status: AiNoteStatus;

  @Column({ type: 'jsonb', nullable: true })
  content: AiNoteContent | null;

  @Column({ name: 'one_line', type: 'varchar', length: 200, nullable: true })
  oneLine: string | null;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;
}
