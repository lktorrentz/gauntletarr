// Loghi da homarr-labs/dashboard-icons (Apache-2.0, /svg), usati a scopo
// identificativo — marchi dei rispettivi proprietari, nessuna affiliazione
// implicita (stesso principio del loro stesso README). Radarr in
// particolare non ha uno sfondo proprio (tratti quasi neri su trasparente,
// invisibili su una card scura): il riquadro bianco qui sotto è uniforme
// per tutti e quattro i loghi, non solo per compensare quel caso.
export function ServiceLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center">
      <img src={src} alt={alt} className="size-full object-contain" />
    </div>
  );
}
