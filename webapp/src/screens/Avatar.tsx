import type { Profile } from "../api";

/** Фото анкеты или цветная заглушка с инициалом. */
export function Avatar({ user, className = "" }: { user: Pick<Profile, "name" | "photos" | "id">; className?: string }) {
  const photo = user.photos[0];
  if (photo) return <img className={`avatar ${className}`} src={photo} alt={user.name} />;
  const hue = (user.id * 47) % 360;
  return (
    <div className={`avatar placeholder ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${(hue + 40) % 360} 70% 45%))` }}>
      {user.name.slice(0, 1)}
    </div>
  );
}
