import { AppIcon } from "./AppIcon";

export type ProfileAvatarKind = "default" | "emoji" | "image";

export function profileAvatarKind(value: string | null): ProfileAvatarKind {
  if (value?.startsWith("data:image/")) return "image";
  if (value) return "emoji";
  return "default";
}

export function ProfileAvatarContent({
  value,
  defaultIconSize = 62,
}: {
  value: string | null;
  defaultIconSize?: number;
}) {
  const kind = profileAvatarKind(value);

  if (kind === "image") {
    return <img src={value ?? ""} alt="" />;
  }
  if (kind === "emoji") {
    return <span className="profile-avatar-emoji">{value}</span>;
  }
  return <AppIcon name="user" size={defaultIconSize} />;
}
