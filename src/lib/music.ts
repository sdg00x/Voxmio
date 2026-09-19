export const CHORDS = [
  { name: "C", notes: [60, 64, 67], key: "1" },
  { name: "Am", notes: [57, 60, 64], key: "2" },
  { name: "F", notes: [53, 57, 60], key: "3" },
  { name: "G", notes: [55, 59, 62], key: "4" },
];
export function zoneAt(x: number) {
  return Math.max(0, Math.min(3, Math.floor(x * 4)));
}
export function frequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}
export function extension(mime: string) {
  return mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
// Require a stable zone for 180 ms. Re-entering after loss of hand re-arms it.
export class ZoneGate {
  candidate = -1;
  since = 0;
  played = -1;
  update(zone: number | null, now: number): number | null {
    if (zone === null) {
      this.candidate = this.played = -1;
      return null;
    }
    if (zone !== this.candidate) {
      this.candidate = zone;
      this.since = now;
    }
    if (now - this.since >= 180 && zone !== this.played) {
      this.played = zone;
      return zone;
    }
    return null;
  }
}
