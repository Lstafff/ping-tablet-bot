import { motion, useReducedMotion } from "motion/react";
import { type FormEvent } from "react";

import type { Profile } from "../../api/types";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { ScorePair } from "../../components/ScoreDisplay";
import { easeInOut, easeOut } from "../../lib/motion";
import { gamesCount, userName, winRate } from "../../lib/player";
import { levelIndexFor, playerLevels } from "./playerLevels";
import "./profile.css";

function formatProfileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  const dayAndMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  return `${dayAndMonth} ${date.getFullYear()}`;
}

function FntrBadge({ className = "" }: { className?: string }) {
  return <span className={`fntr-badge${className ? ` ${className}` : ""}`}>ФНТР</span>;
}

export function ProfileScreen(props: { profile: Profile; editing: boolean; nameInput: string; submitting: boolean; onLevel(): void; onAvatarEdit(): void; onNameInput(value: string): void; onSaveName(event: FormEvent<HTMLFormElement>): void }) {
  const { profile } = props;
  const reduceMotion = useReducedMotion();
  return (
    <>
      <section className="profile-hero family-profile-hero">
        <div className="profile-avatar-wrap">
          <motion.span
            className="profile-avatar"
            layoutId={reduceMotion ? undefined : "profile-avatar-surface"}
            transition={{ layout: { duration: 0.24, ease: easeInOut } }}
            aria-hidden="true"
          >
            <ProfileAvatarContent value={profile.user.avatar_value} />
          </motion.span>
          {profile.user.rating_is_fnt ? <FntrBadge className="profile-avatar-fntr-badge" /> : null}
          {props.editing ? <motion.button className="profile-avatar-edit modal-icon-button" type="button" aria-label="Изменить аватар" initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.94)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }} onClick={props.onAvatarEdit}><AppIcon name="pencil" size={14} /></motion.button> : null}
        </div>
        {props.editing ? <form id="profile-name-form" className="profile-name-form" onSubmit={props.onSaveName}>
          <input autoFocus value={props.nameInput} onChange={(event) => props.onNameInput(event.target.value)} maxLength={64} aria-label="Имя профиля" />
        </form> : <MorphingHeading>{userName(profile.user)}</MorphingHeading>}
        <p>{profile.user.username ? `@${profile.user.username}` : "Игрок Telegram"}</p>
      </section>

      <div className={props.editing ? "profile-locked-content profile-locked-content-disabled" : "profile-locked-content"} aria-disabled={props.editing}>
        <div className="profile-divider"><span>Статистика</span></div>

        <section className="profile-metrics" aria-label="Статистика игрока">
          <div className="profile-metric"><span>Всего игр</span><strong><AnimatedNumber value={gamesCount(profile.stats)} animateOnMount /></strong></div>
          <div className="profile-metrics-divider" aria-hidden="true" />
          <div className="profile-metric"><span>Процент побед</span><strong><AnimatedNumber value={winRate(profile.stats)} animateOnMount />%</strong></div>
        </section>

        <dl className="profile-facts profile-detailed-facts">
          <div><dt><AppIcon name="calendar" size={21} /><span>Начал играть</span></dt><dd>{formatProfileDate(profile.user.created_at)}</dd></div>
          <div><dt><AppIcon name="chart" size={21} /><span>Уровень игры</span></dt><dd><button className="profile-fact-link" type="button" onClick={props.onLevel} disabled={props.editing}><span>{playerLevels[levelIndexFor(profile)].name}</span><AppIcon name="chevron-right" size={21} /></button></dd></div>
          <div><dt><AppIcon name="crown" size={21} /><span>Победы</span></dt><dd><AnimatedNumber value={profile.stats.wins} animateOnMount /></dd></div>
          <div><dt><AppIcon name="circle-minus" size={21} /><span>Поражения</span></dt><dd><AnimatedNumber value={profile.stats.losses} animateOnMount /></dd></div>
          <div><dt><AppIcon name="circle-pile" size={21} /><span>Всего мячей</span></dt><dd><ScorePair left={<AnimatedNumber value={profile.stats.points_for} animateOnMount />} right={<AnimatedNumber value={profile.stats.points_against} animateOnMount />} /></dd></div>
          <div><dt><AppIcon name="zap" size={21} /><span>Текущая серия</span></dt><dd><AnimatedNumber value={profile.extended_stats.win_streak} animateOnMount /></dd></div>
          <div><dt><AppIcon name="clock" size={21} /><span>Овертаймы</span></dt><dd><ScorePair left={<AnimatedNumber value={profile.extended_stats.overtime_wins} animateOnMount />} right={<AnimatedNumber value={profile.extended_stats.overtime_losses} animateOnMount />} /></dd></div>
        </dl>
      </div>
    </>
  );
}

export function LevelsScreen(props: {
  profile: Profile;
  ratingValue: string;
  ratingSubmitting: boolean;
  onRatingValue(value: string): void;
  onRatingSave(event: FormEvent<HTMLFormElement>): void;
  onRatingClear(): void;
}) {
  const { profile } = props;
  const currentIndex = levelIndexFor(profile);
  const current = playerLevels[currentIndex];
  const next = playerLevels[currentIndex + 1];
  return (
    <>
      <section className="levels-hero">
        <span className="level-hero-icon" aria-hidden="true">
          {current.emoji}
          {profile.user.rating_is_fnt ? <FntrBadge className="level-icon-fntr-badge" /> : null}
        </span>
        <MorphingHeading>{current.name}</MorphingHeading>
        <strong>{profile.user.elo_rating} elo</strong>
        <small>{next ? `До следующего уровня — ${Math.max(0, next.threshold - profile.user.elo_rating)} elo` : "Максимальный уровень"}</small>
      </section>
      <section className="levels-list" aria-label="Уровни игроков">
        {playerLevels.map((level, index) => (
          <div className={index === currentIndex ? "level-row level-row-current" : "level-row"} key={level.name}>
            <span className="level-emoji" aria-hidden="true">{level.emoji}</span>
            <span><strong>{level.name}</strong><small>{level.detail}</small></span>
            {index === currentIndex ? <AppIcon name="check" size={20} strokeWidth={3} /> : null}
          </div>
        ))}
      </section>
      <section className="rating-editor levels-rating-editor" aria-label="Рейтинг ФНТР">
        <form className="inline-form rating-form" onSubmit={props.onRatingSave}>
          <label className="visually-hidden" htmlFor="rating">Рейтинг или ссылка на профиль ФНТР</label>
          <input
            id="rating"
            value={props.ratingValue}
            onChange={(event) => props.onRatingValue(event.target.value)}
            placeholder="Рейтинг или ссылка ФНТР"
            required
          />
          <button className="primary-button" type="submit" disabled={props.ratingSubmitting}>
            {props.ratingSubmitting ? "Добавляем…" : "Добавить"}
          </button>
        </form>
        {profile.user.rating ? (
          <button className="text-button danger-text" type="button" onClick={props.onRatingClear} disabled={props.ratingSubmitting}>
            Сбросить
          </button>
        ) : null}
      </section>
    </>
  );
}
