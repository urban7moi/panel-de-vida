import Link from "next/link";
import { GearIcon } from "./icons";

export default function SettingsLink() {
  return (
    <Link href="/ajustes" className="gear-btn" aria-label="Ajustes">
      <GearIcon size={20} />
    </Link>
  );
}
