/** Message d'erreur affiché sous un champ ; n'affiche rien s'il n'y a pas d'erreur. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <small id={id} className="mt-1.5 block text-xs font-medium text-red-600">
      {message}
    </small>
  );
}
