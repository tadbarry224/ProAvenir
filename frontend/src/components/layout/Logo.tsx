export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5" aria-label="Retour à l'accueil">
      <span className="logo-mark">
        <span />
      </span>
      <span className="font-display text-[21px] font-extrabold tracking-[-0.04em] text-[#0c2340]">
        Pro<span className="text-[#15966f]">Avenir</span>
      </span>
    </button>
  );
}
