import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiNote } from '../ai-notes/ai-note.entity.js';
import { Customer } from '../customers/customer.entity.js';
import { ShootType } from '../shoot-types/shoot-type.entity.js';
import type {
  ReservationChannel,
  ReservationStatus,
} from './reservation.constants.js';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'integer' })
  customerId: number;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'shoot_type_id', type: 'integer' })
  shootTypeId: number;

  @ManyToOne(() => ShootType)
  @JoinColumn({ name: 'shoot_type_id' })
  shootType: ShootType;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'integer' })
  headcount: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  purpose: string | null;

  @Column({
    name: 'special_request',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  specialRequest: string | null;

  @Column({ type: 'varchar', length: 20, default: 'online' })
  channel: ReservationChannel;

  @Column({ name: 'terms_agreed_at', type: 'timestamptz', nullable: true })
  termsAgreedAt: Date | null;

  @Column({ name: 'price_at_booking', type: 'integer' })
  priceAtBooking: number;

  @Column({ type: 'varchar', length: 30, default: 'confirmed' })
  status: ReservationStatus;

  @Column({ name: 'changed_from_id', type: 'integer', nullable: true })
  changedFromId: number | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => AiNote, (note) => note.reservation)
  aiNote: AiNote | null;
}
