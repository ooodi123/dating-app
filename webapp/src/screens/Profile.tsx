import { useState } from "react";
import { api, errorText, type MeResponse } from "../api";
import { haptic } from "../tg";

interface Props {
  state: MeResponse;
  onSaved: () => void;
  onPremium?: () => void;
  onboarding?: boolean;
}

const SUGGESTED_INTERESTS = [
  "путешествия", "кофе", "спорт", "бег", "йога", "книги", "кино", "сериалы", "музыка", "джаз",
  "концерты", "танцы", "кулинария", "вино", "горы", "море", "собаки", "кошки", "IT", "фотография",
  "выставки", "стендап", "игры", "театр",
];

/** Сжимаем фото на клиенте до 1080px JPEG, чтобы не грузить сервер. */
async function toJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProfileScreen({ state, onSaved, onPremium, onboarding }: Props) {
  const me = state.me;
  const [form, setForm] = useState({
    name: me.name,
    age: me.age ?? 18,
    gender: me.gender ?? "m",
    lookingFor: me.lookingFor,
    ageMin: me.ageMin,
    ageMax: me.ageMax,
    city: me.city,
    bio: me.bio,
    interests: me.interests,
  });
  const [photos, setPhotos] = useState(me.photos);
  const [notes, setNotes] = useState("");
  const [bios, setBios] = useState<string[] | "loading" | null>(null);
  const [status, setStatus] = useState("");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleInterest = (i: string) =>
    set("interests", form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i].slice(0, 15));

  async function save() {
    if (!form.name.trim()) return setStatus("Укажи имя");
    try {
      await api("/api/me", { method: "PUT", body: { ...form, age: Number(form.age), ageMin: Number(form.ageMin), ageMax: Number(form.ageMax) } });
      haptic("success");
      setStatus("Сохранено ✓");
      onSaved();
    } catch (e) {
      setStatus(errorText(e));
    }
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const r = await api<{ photos: string[] }>("/api/me/photos", { method: "POST", body: { dataUrl: await toJpeg(file) } });
      setPhotos(r.photos);
    } catch (e) {
      setStatus(errorText(e));
    }
  }

  async function removePhoto(idx: number) {
    const r = await api<{ photos: string[] }>(`/api/me/photos/${idx}`, { method: "DELETE" });
    setPhotos(r.photos);
  }

  async function aiBio() {
    setBios("loading");
    try {
      // Сохраняем черновик, чтобы AI видел актуальные интересы
      if (form.name.trim()) await api("/api/me", { method: "PUT", body: form });
      const r = await api<{ bios: string[] }>("/api/ai/bio", { method: "POST", body: { notes } });
      setBios(r.bios);
    } catch (e) {
      setBios(null);
      setStatus(errorText(e));
    }
  }

  return (
    <div className="profile">
      {!onboarding && (
        <div className="feed-head">
          <h2>Профиль</h2>
          {me.premium ? <span className="badge">✨ Premium</span> : <button className="btn small" onClick={onPremium}>✨ Premium</button>}
        </div>
      )}

      <section>
        <label>Фото</label>
        <div className="photos">
          {photos.map((p, i) => (
            <div key={p} className="photo">
              <img src={p} alt="" />
              <button onClick={() => removePhoto(i)}>✕</button>
            </div>
          ))}
          {photos.length < 6 && (
            <label className="photo add">
              +
              <input type="file" accept="image/*" hidden onChange={(e) => addPhoto(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </section>

      <section className="fields">
        <label>Имя<input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={40} /></label>
        <label>Возраст<input type="number" min={18} max={99} value={form.age} onChange={(e) => set("age", Number(e.target.value))} /></label>
        <label>Город<input value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={60} /></label>
        <label>
          Я
          <select value={form.gender} onChange={(e) => set("gender", e.target.value as "m" | "f")}>
            <option value="m">Парень</option>
            <option value="f">Девушка</option>
          </select>
        </label>
        <label>
          Ищу
          <select value={form.lookingFor} onChange={(e) => set("lookingFor", e.target.value as "m" | "f" | "any")}>
            <option value="f">Девушек</option>
            <option value="m">Парней</option>
            <option value="any">Всех</option>
          </select>
        </label>
        <label>
          Возраст от / до
          <span className="pair">
            <input type="number" min={18} max={99} value={form.ageMin} onChange={(e) => set("ageMin", Number(e.target.value))} />
            <input type="number" min={18} max={99} value={form.ageMax} onChange={(e) => set("ageMax", Number(e.target.value))} />
          </span>
        </label>
      </section>

      <section>
        <label>Интересы</label>
        <div className="chips">
          {SUGGESTED_INTERESTS.map((i) => (
            <button key={i} className={form.interests.includes(i) ? "chip common" : "chip"} onClick={() => toggleInterest(i)}>{i}</button>
          ))}
        </div>
      </section>

      <section>
        <label>О себе<textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={500} rows={4} /></label>
        {state.limits.aiEnabled && (
          <div className="ai-box">
            <b>✨ AI напишет за тебя</b>
            <textarea placeholder="Пара фактов о себе: чем занимаешься, что любишь, кого ищешь" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
            <button className="btn small" onClick={aiBio} disabled={bios === "loading"}>{bios === "loading" ? "Пишу…" : "Сгенерировать"}</button>
            {Array.isArray(bios) &&
              bios.map((b) => (
                <button key={b} className="suggestion" onClick={() => { set("bio", b.slice(0, 500)); setBios(null); }}>{b}</button>
              ))}
          </div>
        )}
      </section>

      <button className="btn wide" onClick={save}>{onboarding ? "Готово, к анкетам →" : "Сохранить"}</button>
      {status && <p className="muted center">{status}</p>}
    </div>
  );
}
